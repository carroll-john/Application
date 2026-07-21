import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { activeBrand, isUcBrand } from "../lib/brand";

interface AppBrandHeaderProps {
  children?: ReactNode;
  maxWidthClassName?: string;
  showApplicantProfileLink?: boolean;
}

function StudyNextChevron({ size = 16 }: { size?: number }) {
  const width = Math.round(size * 0.5);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-baseline gap-px"
      style={{ marginInline: 4, transform: "translateY(-1px)" }}
    >
      {[0, 1, 2].map((index) => (
        <svg
          key={index}
          fill="var(--sn-mint)"
          height={size}
          style={{ display: "block" }}
          viewBox="0 0 11 22"
          width={width}
        >
          <polygon points="0,2 6,2 11,11 6,20 0,20 5,11" />
        </svg>
      ))}
    </span>
  );
}

function StudyNextWordmark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-baseline text-white"
      style={{
        font: `500 ${size}px/1 var(--font-body, "Figtree", sans-serif)`,
        letterSpacing: "-0.01em",
      }}
    >
      <span>Study</span>
      <StudyNextChevron size={Math.round(size * 0.78)} />
      <span>
        Next.
        <sup
          style={{
            display: "inline-block",
            fontSize: "0.32em",
            fontWeight: 500,
            marginLeft: 1,
            transform: "translateY(-0.6em)",
          }}
        >
          ®
        </sup>
      </span>
    </span>
  );
}

export function AppBrandHeader({
  children,
  maxWidthClassName = "max-w-7xl",
  showApplicantProfileLink = true,
}: AppBrandHeaderProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const canShowAccountLink =
    showApplicantProfileLink &&
    location.pathname !== "/profile" &&
    location.pathname !== "/applicant-profile" &&
    location.pathname !== "/sign-in" &&
    location.pathname !== "/auth/callback";
  const accountLinkPath = isAuthenticated
    ? "/profile"
    : `/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <header className="border-b border-[var(--brand-header-border)] bg-[var(--brand-header)] text-[var(--brand-header-text)] shadow-[var(--brand-header-shadow)]">
      <div
        className={`mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}
      >
        <NavLink
          aria-label="Go to course browse"
          className="inline-flex items-center gap-3 transition hover:opacity-90"
          to="/"
        >
          {isUcBrand ? (
            <img
              alt={activeBrand.logo?.alt}
              className="h-auto w-[190px] sm:w-[230px]"
              src={activeBrand.logo?.fullColour}
            />
          ) : (
            <StudyNextWordmark />
          )}
          <span className="hidden h-6 items-center rounded-full bg-[var(--brand-service-bg)] px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-service-text)] sm:inline-flex">
            {activeBrand.serviceLabel}
          </span>
        </NavLink>
        <div className="flex items-center gap-3">
          {canShowAccountLink ? (
            <NavLink
              className={({ isActive }) =>
                `inline-flex rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                  isActive
                    ? "border-transparent bg-[var(--sn-yellow)] text-[var(--sn-navy)] shadow-[var(--shadow-cta-yellow)] hover:bg-[var(--keypath-yellow-hover)]"
                    : "border-[var(--brand-header-link-border)] bg-transparent text-[var(--brand-header-text)] hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-strong)]"
                }`
              }
              to={accountLinkPath}
            >
              {isAuthenticated ? "Profile" : "Log in"}
            </NavLink>
          ) : null}
          {children ? <div className="shrink-0">{children}</div> : null}
        </div>
      </div>
    </header>
  );
}
