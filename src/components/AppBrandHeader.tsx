import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { activeBrand } from "../lib/brand";

interface AppBrandHeaderProps {
  children?: ReactNode;
  maxWidthClassName?: string;
  showApplicantProfileLink?: boolean;
  variant?: "application" | "marketing";
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

function StudyNextWordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-baseline text-white"
      style={{
        font: `500 ${size}px/1 var(--font-body, "Montserrat", sans-serif)`,
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
  variant = "application",
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

  if (variant === "marketing") {
    return (
      <header
        className="border-b border-white/5 bg-[var(--brand-header)] text-white"
        data-studynext-brand-header
        data-studynext-marketing-header
      >
        <div
          className={`mx-auto flex min-h-[88px] items-center justify-between gap-8 px-5 sm:px-6 lg:px-8 ${maxWidthClassName}`}
        >
          <NavLink
            aria-label="StudyNext – go to course discovery"
            className="inline-flex shrink-0 items-center transition hover:opacity-90"
            to="/"
          >
            <StudyNextWordmark size={30} />
          </NavLink>

          <nav
            aria-label="StudyNext course discovery"
            className="hidden items-center gap-10 text-sm font-semibold md:flex"
          >
            {[
              { href: "#course-catalogue", label: "Courses" },
              { href: "#course-catalogue", label: "Institutions" },
              { href: "#experience-assessment", label: "Resources" },
            ].map((item) => (
              <a
                key={item.label}
                className="inline-flex items-center gap-2 rounded-md px-1 py-2 text-white/95 transition hover:text-[var(--sn-mint)]"
                href={item.href}
              >
                {item.label}
                <ChevronDown aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </a>
            ))}
          </nav>

          <a
            className="inline-flex rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--sn-mint)] hover:text-[var(--sn-mint)] md:hidden"
            href="#course-catalogue"
          >
            Courses
          </a>
        </div>
      </header>
    );
  }

  return (
    <header
      className="border-b border-[var(--brand-header-border)] bg-[var(--brand-header)] text-[var(--brand-header-text)] shadow-[var(--brand-header-shadow)]"
      data-studynext-brand-header
    >
      <div
        className={`mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}
      >
        <NavLink
          aria-label="StudyNext Apply – go to course browse"
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
                `inline-flex rounded-full border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
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
