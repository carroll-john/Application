import ucLogoInline from "../assets/brands/uc/uc-logo-inline.png";
import ucLogoInlineWhite from "../assets/brands/uc/uc-logo-inline-white.png";

export type BrandId = "studynext" | "uc";
export type CatalogId = "default" | "uc";

export interface BrandConfig {
  id: BrandId;
  displayName: string;
  serviceLabel: string;
  catalogId: CatalogId;
  logo?: {
    fullColour: string;
    reversed: string;
    alt: string;
  };
  support: {
    email: string;
    phone: string;
    service: string;
  };
}

export const brandConfigs: Record<BrandId, BrandConfig> = {
  studynext: {
    id: "studynext",
    displayName: "StudyNext",
    serviceLabel: "Apply",
    catalogId: "default",
    support: {
      email: "support@studynext.com",
      phone: "1300 123 456",
      service: "Start chat",
    },
  },
  uc: {
    id: "uc",
    displayName: "University of Canberra",
    serviceLabel: "Powered by Keypath Tech",
    catalogId: "uc",
    logo: {
      fullColour: ucLogoInline,
      reversed: ucLogoInlineWhite,
      alt: "University of Canberra",
    },
    support: {
      email: "study@canberra.edu.au",
      phone: "1800 864 226",
      service: "Future Students team",
    },
  },
};

function readBrandId(): BrandId {
  return import.meta.env.VITE_APP_BRAND === "uc" ? "uc" : "studynext";
}

export const activeBrand = brandConfigs[readBrandId()];
export const isUcBrand = activeBrand.id === "uc";
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function applyBrandToDocument() {
  document.documentElement.dataset.brand = activeBrand.id;
  document.documentElement.dataset.demoMode = String(isDemoMode);
  document.title = isUcBrand
    ? "Applications | University of Canberra"
    : "StudyNext Apply";
}
