import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { AuthPanel } from "../features/auth";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { sanitizeRedirectPath } from "../lib/authCallback";

export default function SignIn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isPasswordRecovery } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    new URLSearchParams(location.search).get("redirect"),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm">
          <LoadingSpinner />
          <span>Loading sign in...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !isPasswordRecovery) {
    return <Navigate replace to={redirectPath} />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppBrandHeader maxWidthClassName="max-w-6xl" />
      <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--cta-secondary)]">
              Applicant account
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Sign in or create your application account
            </h1>
            <p className="text-lg leading-8 text-slate-600">
              Sign in or create an applicant account with your email and
              password to continue your application securely from this device.
            </p>
          </div>

          <SurfaceCard className="p-8 sm:p-10">
            <AuthPanel
              context="route"
              onAuthenticated={() => navigate(redirectPath, { replace: true })}
            />
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
