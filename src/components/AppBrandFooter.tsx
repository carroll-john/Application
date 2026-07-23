import { NavLink } from "react-router-dom";
import { activeBrand, isUcBrand } from "../lib/brand";

const UC_FOOTER_LINKS = {
  accessibility: "https://www.canberra.edu.au/about-uc/website-accessibility/",
  apply: "https://www.canberra.edu.au/future-students/apply-to-uc",
  contact: "https://www.canberra.edu.au/about-uc/contacts",
  futureStudents: "https://www.canberra.edu.au/future-students/",
  privacy: "https://policies.canberra.edu.au/document/view-current.php?id=124",
  safeCommunity: "https://www.canberra.edu.au/safe-community",
} as const;

function FooterLink({
  children,
  href,
  onDark = false,
}: {
  children: string;
  href: string;
  onDark?: boolean;
}) {
  return (
    <a
      className={`transition-colors hover:underline ${
        onDark ? "hover:text-white" : "hover:text-[var(--brand-accent-strong)]"
      }`}
      href={href}
    >
      {children}
    </a>
  );
}

export function AppBrandFooter() {
  if (!isUcBrand) {
    return null;
  }

  return (
    <footer data-uc-brand-footer>
      <div className="border-t border-[var(--brand-header-border)] bg-[var(--brand-footer-links)] text-[var(--brand-header-text)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent-strong)]">
            Other quick links
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <section aria-labelledby="uc-footer-explore">
              <h2
                className="brand-footer-heading text-lg font-semibold"
                id="uc-footer-explore"
              >
                Explore UC
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--fg-2)]">
                <li>
                  <NavLink
                    className="transition-colors hover:text-[var(--brand-accent-strong)] hover:underline"
                    to="/"
                  >
                    Browse courses
                  </NavLink>
                </li>
                <li>
                  <FooterLink href={UC_FOOTER_LINKS.futureStudents}>
                    Future students
                  </FooterLink>
                </li>
                <li>
                  <FooterLink href={UC_FOOTER_LINKS.apply}>Apply to UC</FooterLink>
                </li>
              </ul>
            </section>

            <section aria-labelledby="uc-footer-support">
              <h2
                className="brand-footer-heading text-lg font-semibold"
                id="uc-footer-support"
              >
                Support
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--fg-2)]">
                <li>
                  <FooterLink href={UC_FOOTER_LINKS.contact}>Contact UC</FooterLink>
                </li>
                <li>
                  <FooterLink href={UC_FOOTER_LINKS.accessibility}>
                    Accessibility and language
                  </FooterLink>
                </li>
                <li>
                  <FooterLink href={UC_FOOTER_LINKS.safeCommunity}>
                    Safe Community
                  </FooterLink>
                </li>
              </ul>
            </section>

            <section aria-labelledby="uc-footer-applications">
              <h2
                className="brand-footer-heading text-lg font-semibold"
                id="uc-footer-applications"
              >
                Online applications
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--fg-2)]">
                For course and application support, contact the Future Students
                team on{" "}
                <a className="font-semibold hover:underline" href="tel:1800864226">
                  1800 864 226
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-[var(--brand-footer)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <img
              alt={activeBrand.logo?.alt}
              className="h-auto w-[220px] max-w-full"
              src={activeBrand.logo?.reversed}
            />
            <span className="inline-flex rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium text-white/85">
              Private demonstration environment
            </span>
          </div>

          <ul
            aria-label="University details"
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90"
          >
            <li>University of Canberra, Bruce ACT 2617 Australia</li>
            <li>
              <a className="hover:text-white hover:underline" href="tel:+61262015111">
                +61 2 6201 5111
              </a>
            </li>
            <li>ABN 81 633 873 422</li>
            <li>CRICOS 00212K</li>
            <li>TEQSA Provider ID: PRV12003 (Australian University)</li>
          </ul>

          <nav
            aria-label="University legal links"
            className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--brand-footer-link-text)]"
          >
            <FooterLink href={UC_FOOTER_LINKS.contact} onDark>
              Contact UC
            </FooterLink>
            <FooterLink href={UC_FOOTER_LINKS.privacy} onDark>
              Privacy
            </FooterLink>
            <FooterLink href={UC_FOOTER_LINKS.accessibility} onDark>
              Accessibility
            </FooterLink>
          </nav>

          <p className="mt-8 border-t border-white/35 pt-8 text-sm leading-6 text-white/85">
            UC acknowledges the Ngunnawal people, traditional custodians of the
            lands where Bruce campus is situated. We wish to acknowledge and
            respect their continuing culture and the contribution they make to
            the life of Canberra and the region. We also acknowledge all other
            First Nations Peoples on whose lands we gather.
          </p>
        </div>
      </div>
    </footer>
  );
}
