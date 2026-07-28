export type BrandId = "studynext" | "uc";
export type CatalogId = "default" | "uc";
export type ThemeId = "studynext";

export interface BrandConfig {
  id: BrandId;
  displayName: string;
  serviceLabel: string;
  catalogId: CatalogId;
  themeId: ThemeId;
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
    themeId: "studynext",
    support: {
      email: "support@studynext.com",
      phone: "1300 123 456",
      service: "Start chat",
    },
  },
  uc: {
    id: "uc",
    displayName: "University of Canberra",
    serviceLabel: "Apply",
    catalogId: "uc",
    themeId: "studynext",
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
  document.documentElement.dataset.brand = activeBrand.themeId;
  document.documentElement.dataset.catalog = activeBrand.catalogId;
  document.documentElement.dataset.demoMode = String(isDemoMode);
  document.title = "StudyNext Apply";
}
