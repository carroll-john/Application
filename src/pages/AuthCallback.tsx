import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { sanitizeRedirectPath } from "../lib/authCallback";

export default function AuthCallback() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    new URLSearchParams(location.search).get("redirect"),
  );

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
    return <Navigate replace to={redirectPath} />;
  }

  return (
    <Navigate
      replace
      to={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
    />
  );
}
