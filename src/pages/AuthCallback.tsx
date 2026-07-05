import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import {
  parseRecoveryTokenHashFromUrl,
  sanitizeRedirectPath,
  withoutRecoveryTokenHashParams,
} from "../lib/authCallback";
import { supabase } from "../lib/supabase";

type RecoveryVerifyState = "none" | "pending" | "done" | "error";

export default function AuthCallback() {
  const location = useLocation();
  const { isAuthenticated, isLoading, isPasswordRecovery } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    new URLSearchParams(location.search).get("redirect"),
  );
  const callbackHref = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}${location.pathname}${location.search}`
        : "",
    [location.pathname, location.search],
  );
  const recoveryToken = useMemo(
    () => parseRecoveryTokenHashFromUrl(callbackHref),
    [callbackHref],
  );
  const [recoveryVerifyState, setRecoveryVerifyState] =
    useState<RecoveryVerifyState>(recoveryToken ? "pending" : "none");

  useEffect(() => {
    if (recoveryVerifyState !== "pending" || !recoveryToken || !supabase) {
      return;
    }

    void supabase.auth
      .verifyOtp({
        token_hash: recoveryToken.tokenHash,
        type: "recovery",
      })
      .then(({ error }) => {
        if (error) {
          setRecoveryVerifyState("error");
          return;
        }

        setRecoveryVerifyState("done");

        if (typeof window !== "undefined") {
          const nextUrl = withoutRecoveryTokenHashParams(window.location.href);

          if (nextUrl !== window.location.href) {
            window.history.replaceState(window.history.state, "", nextUrl);
          }
        }
      });
  }, [recoveryToken, recoveryVerifyState]);

  if (recoveryVerifyState === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm">
          <LoadingSpinner />
          <span>Verifying reset link...</span>
        </div>
      </div>
    );
  }

  if (recoveryVerifyState === "error") {
    const params = new URLSearchParams({
      redirect: redirectPath,
      error: "access_denied",
      error_code: "otp_expired",
    });

    return <Navigate replace to={`/sign-in?${params.toString()}`} />;
  }

  // Handles email confirmation links after sign-up. The Supabase client picks up
  // the session from the URL via detectSessionInUrl.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm">
          <LoadingSpinner />
          <span>Signing you in...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isPasswordRecovery) {
      const params = new URLSearchParams({
        recovery: "1",
        redirect: redirectPath,
      });

      return <Navigate replace to={`/sign-in?${params.toString()}`} />;
    }

    return <Navigate replace to={redirectPath} />;
  }

  return (
    <Navigate
      replace
      to={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
    />
  );
}
