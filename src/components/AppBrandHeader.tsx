import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AppBrandHeaderProps {
  children?: ReactNode;
  maxWidthClassName?: string;
  showApplicantProfileLink?: boolean;
}

export function AppBrandHeader({
  children,
  maxWidthClassName = "max-w-7xl",
  showApplicantProfileLink = true,
}: AppBrandHeaderProps) {
  const location = useLocation();
  const { isAuthorizedCompanyUser, isBypassedInDev } = useAuth();
  const isSignedIn = isBypassedInDev || isAuthorizedCompanyUser;
  const canShowAccountLink =
    showApplicantProfileLink &&
    location.pathname !== "/profile" &&
    location.pathname !== "/applicant-profile" &&
    location.pathname !== "/sign-in" &&
    location.pathname !== "/auth/callback";
  const accountLinkPath = isSignedIn ? "/profile" : `/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}
      >
        <NavLink
          aria-label="Go to course browse"
          className="inline-flex h-10 items-center rounded-2xl bg-[#084E74] px-4 text-white transition hover:bg-[#063d5a]"
          to="/"
        >
          <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.24em]">
            KEYPATH
          </span>
          <span className="ml-2 hidden text-[0.62rem] font-semibold uppercase tracking-[0.14em] sm:inline">
            APPLY
          </span>
        </NavLink>
        <div className="flex items-center gap-3">
          {canShowAccountLink ? (
            <NavLink
              className={({ isActive }) =>
                `inline-flex rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                  isActive
                    ? "border-[#084E74] bg-[#084E74] text-white"
                    : "border-slate-300 bg-white text-[#084E74] hover:border-[#084E74]/60 hover:bg-[#F2F8FB]"
                }`
              }
              to={accountLinkPath}
            >
              {isSignedIn ? "Profile" : "Log in"}
            </NavLink>
          ) : null}
          {children ? <div className="shrink-0">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
