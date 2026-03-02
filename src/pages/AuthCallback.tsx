import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sanitizeRedirectPath } from "../lib/authCallback";

export default function AuthCallback() {
  const location = useLocation();
  const { isAuthorizedCompanyUser, isBypassedInDev } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    new URLSearchParams(location.search).get("redirect"),
  );

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
