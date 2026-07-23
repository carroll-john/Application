import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { activeBrand, isUcBrand } from "../lib/brand";

interface AppBrandHeaderProps {
  children?: ReactNode;
  maxWidthClassName?: string;
  showApplicantProfileLink?: boolean;
}

const UC_LINKS = {
  accessibility: "https://www.canberra.edu.au/about-uc/website-accessibility/",
  apply: "https://www.canberra.edu.au/future-students/apply-to-uc",
  contact: "https://www.canberra.edu.au/about-uc/contacts",
  futureStudents: "https://www.canberra.edu.au/future-students/",
  safeCommunity: "https://www.canberra.edu.au/safe-community",
} as const;

interface UcBrandHeaderProps {
  accountLinkPath: string;
  canShowAccountLink: boolean;
  children?: ReactNode;
  isAuthenticated: boolean;
  maxWidthClassName: string;
}

function UcBrandHeader({
  accountLinkPath,
  canShowAccountLink,
  children,
  isAuthenticated,
  maxWidthClassName,
}: UcBrandHeaderProps) {
  return (
    <header
      className="bg-[var(--brand-header)] text-[var(--brand-header-text)]"
      data-uc-brand-header
    >
      <div
        className="bg-[var(--brand-header-utility)] text-[var(--brand-header-utility-text)]"
        data-uc-utility-bar
      >
        <div
          className={`mx-auto flex min-h-9 items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8 ${maxWidthClassName}`}
        >
          <nav
            aria-label="University accessibility links"
            className="hidden items-center gap-3 sm:flex"
          >
            <a
              className="transition-colors hover:text-white"
              href={UC_LINKS.accessibility}
            >
              Accessibility and language
            </a>
            <span aria-hidden="true" className="text-white/45">
              |
            </span>
            <a
              className="transition-colors hover:text-white"
              href={UC_LINKS.safeCommunity}
            >
              Safe Community
            </a>
          </nav>
          <span className="font-medium sm:hidden">Online applications</span>
          <nav
            aria-label="University quick links"
            className="ml-auto flex items-center gap-4"
          >
            <a
              className="hidden transition-colors hover:text-white md:inline"
              href={UC_LINKS.futureStudents}
            >
              Future students
            </a>
            <a
              className="hidden transition-colors hover:text-white md:inline"
              href={UC_LINKS.contact}
            >
              Contact UC
            </a>
            <span className="font-medium text-white">Applications</span>
          </nav>
        </div>
      </div>

      <div className="border-b border-[var(--brand-header-border)] shadow-[var(--brand-header-shadow)]">
        <div
          className={`mx-auto flex min-h-[88px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}
        >
          <NavLink
            aria-label="Go to course browse"
            className="inline-flex shrink-0 items-center transition hover:opacity-90"
            to="/"
          >
            <img
              alt={activeBrand.logo?.alt}
              className="h-auto w-[170px] sm:w-[220px]"
              src={activeBrand.logo?.fullColour}
            />
          </NavLink>
          <span
            aria-hidden="true"
            className="hidden h-9 border-l border-[var(--brand-header-border)] sm:block"
          />
          <span className="hidden text-sm font-semibold text-[var(--brand-accent-strong)] sm:inline">
            Online applications
          </span>

          <nav
            aria-label="Application navigation"
            className="ml-auto hidden items-center gap-7 text-sm font-semibold lg:flex"
          >
            <NavLink
              className={({ isActive }) =>
                `border-b-2 py-2 transition-colors ${
                  isActive
                    ? "border-[var(--brand-accent)] text-[var(--brand-accent-strong)]"
                    : "border-transparent hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-strong)]"
                }`
              }
              end
              to="/"
            >
              Courses
            </NavLink>
            <a
              className="border-b-2 border-transparent py-2 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-strong)]"
              href={UC_LINKS.futureStudents}
            >
              Future students
            </a>
            <a
              className="border-b-2 border-transparent py-2 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-strong)]"
              href={UC_LINKS.apply}
            >
              How to apply
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 lg:gap-3">
            {canShowAccountLink ? (
              <NavLink
                className="inline-flex rounded-full bg-[var(--brand-accent-strong)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--cta-primary-hover)] sm:px-4 sm:py-2.5 sm:text-sm"
                to={accountLinkPath}
              >
                {isAuthenticated ? "Profile" : "Log in"}
              </NavLink>
            ) : null}
            {children ? <div className="shrink-0">{children}</div> : null}
          </div>
        </div>
      </div>
    </header>
  );
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

  if (isUcBrand) {
    return (
      <UcBrandHeader
        accountLinkPath={accountLinkPath}
        canShowAccountLink={canShowAccountLink}
        isAuthenticated={isAuthenticated}
        maxWidthClassName={maxWidthClassName}
      >
        {children}
      </UcBrandHeader>
    );
  }

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
          <StudyNextWordmark />
          <span className="brand-service-label hidden h-6 items-center rounded-full bg-[var(--brand-service-bg)] px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-service-text)] sm:inline-flex">
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
