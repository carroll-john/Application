import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { sanitizeRedirectPath } from "../lib/authCallback";

export default function AuthCallback() {
  const location = useLocation();
  const { isAuthorizedCompanyUser, isBypassedInDev, isLoading } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    new URLSearchParams(location.search).get("redirect"),
  );

  // The Supabase client establishes the session from the magic-link URL during
  // initialisation. Wait for that to resolve before deciding where to send the
  // user, otherwise a valid sign-in would be bounced back to /sign-in.
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

  if (isAuthorizedCompanyUser || isBypassedInDev) {
    return <Navigate replace to={redirectPath} />;
  }

  return (
    <Navigate
      replace
      to={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
    />
  );
}
