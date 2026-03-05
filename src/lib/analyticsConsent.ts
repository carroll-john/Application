export type AnalyticsConsentDecision = "denied" | "granted";

const ANALYTICS_CONSENT_STORAGE_KEY = "application-prototype:analytics-consent";
const ANALYTICS_CONSENT_EVENT_NAME = "application-prototype:analytics-consent-changed";
const FALSE_LIKE_PATTERN = /^(0|false|off|no|deny|denied)$/i;
const TRUE_LIKE_PATTERN = /^(1|true|on|yes|allow|allowed|grant|granted)$/i;

const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsentDecision =
  import.meta.env.VITE_ANALYTICS_CONSENT_DEFAULT?.trim().toLowerCase() ===
  "granted"
    ? "granted"
    : "denied";

function normalizeConsentDecision(
  value: string | null | undefined,
): AnalyticsConsentDecision | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_LIKE_PATTERN.test(normalized)) {
    return "granted";
  }
  if (FALSE_LIKE_PATTERN.test(normalized)) {
    return "denied";
  }

  return null;
}

function readQueryOverride(search: string): AnalyticsConsentDecision | null {
  if (!search) {
    return null;
  }

  const params = new URLSearchParams(search);

  for (const key of ["analytics", "analytics_consent", "tracking"]) {
    if (!params.has(key)) {
      continue;
    }

    const decision = normalizeConsentDecision(params.get(key));
    if (decision) {
      return decision;
    }
  }

  return null;
}

function readStoredConsent(): AnalyticsConsentDecision | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeConsentDecision(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function getAnalyticsConsentDecision(): AnalyticsConsentDecision {
  if (typeof window === "undefined") {
    return DEFAULT_ANALYTICS_CONSENT;
  }

  const queryOverride = readQueryOverride(window.location.search);
  if (queryOverride) {
    return queryOverride;
  }

  return readStoredConsent() ?? DEFAULT_ANALYTICS_CONSENT;
}

export function hasAnalyticsConsent() {
  return getAnalyticsConsentDecision() === "granted";
}

export function shouldPromptForAnalyticsConsent() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    readQueryOverride(window.location.search) === null &&
    readStoredConsent() === null
  );
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  const decision: AnalyticsConsentDecision = granted ? "granted" : "denied";

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, decision);
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ANALYTICS_CONSENT_EVENT_NAME, {
      detail: {
        decision,
      },
    }),
  );
}

export function onAnalyticsConsentChange(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorageEvent);
  window.addEventListener(ANALYTICS_CONSENT_EVENT_NAME, callback);

  return () => {
    window.removeEventListener("storage", handleStorageEvent);
    window.removeEventListener(ANALYTICS_CONSENT_EVENT_NAME, callback);
  };
}
