import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import {
  parseRecoveryTokenHashFromUrl,
  sanitizeRedirectPath,
} from "../lib/authCallback";

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

  // Recovery emails land here with token_hash. Forward to sign-in so the user
  // sees the new-password form immediately; verifyOtp runs on submit (Safe Links
  // prefetch does not submit forms).
  if (recoveryToken) {
    const params = new URLSearchParams(location.search);
    params.set("recovery", "1");

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
