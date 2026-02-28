import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthorizedCompanyUser,
    isBypassedInDev,
    isConfigured,
    isLoading,
    session,
  } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isConfigured && !isBypassedInDev) {
      return;
    }

    if ((!session || !isAuthorizedCompanyUser) && !isBypassedInDev) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const redirectPath = params.get("redirect") || "/dashboard";
    navigate(redirectPath, { replace: true });
  }, [
    isAuthorizedCompanyUser,
    isBypassedInDev,
    isConfigured,
    isLoading,
    location.search,
    navigate,
    session,
  ]);

  if (isBypassedInDev) {
    return <Navigate replace to="/dashboard" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm">
        <LoadingSpinner />
        <span>Signing you in...</span>
      </div>
    </div>
  );
}
