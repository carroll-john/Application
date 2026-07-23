import { activeBrand, isUcBrand } from "../lib/brand";

export function AppBrandFooter() {
  if (!isUcBrand) {
    return null;
  }

  return (
    <footer className="border-t border-white/15 bg-[var(--brand-footer)] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="max-w-3xl">
          <img
            alt={activeBrand.logo?.alt}
            className="h-auto w-[220px] max-w-full"
            src={activeBrand.logo?.reversed}
          />
          <p className="mt-6 text-sm leading-6 text-white/80">
            The University of Canberra acknowledges the Ngunnawal people,
            traditional custodians of the lands where Bruce campus is situated.
            We wish to acknowledge and respect their continuing culture and the
            contribution they make to the life of Canberra and the region.
          </p>
        </div>
        <div className="text-sm leading-6 text-white/75 md:text-right">
          <p className="font-semibold text-white">Applications</p>
          <p>Private demonstration environment</p>
        </div>
      </div>
    </footer>
  );
}
