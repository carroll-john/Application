type ClarityArgument = string | number | boolean | null | undefined;

type ClarityFn = ((...args: ClarityArgument[]) => void) & {
  q?: ClarityArgument[][];
};

declare global {
  interface Window {
    __DISABLE_CLARITY__?: boolean;
    clarity?: ClarityFn;
  }
}

const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim() ?? "";
const CLARITY_SCRIPT_SELECTOR = 'script[data-clarity="application-prototype"]';
const CLARITY_DISABLE_STORAGE_KEY = "application-prototype:disable-clarity";
const AGENT_USER_AGENT_PATTERN =
  /(headlesschrome|playwright|puppeteer|selenium|lighthouse|datadogsynthetics|pingdom|newrelicpinger|bot|crawler|spider|slurp|bingpreview|facebookexternalhit|discordbot|slackbot)/i;
const FALSE_LIKE_PATTERN = /^(0|false|off|no)$/i;
const CLARITY_DISABLE_QUERY_KEYS = ["clarity", "disable_clarity", "no_clarity"];

let clarityStarted = false;

export const isClarityEnabled = Boolean(CLARITY_PROJECT_ID);

function isTruthyValue(value: string | null) {
  if (value === null) {
    return false;
  }

  return !FALSE_LIKE_PATTERN.test(value.trim());
}

function hasDisableSearchParam(search: string) {
  if (!search) {
    return false;
  }

  const params = new URLSearchParams(search);

  for (const key of CLARITY_DISABLE_QUERY_KEYS) {
    if (!params.has(key)) {
      continue;
    }

    const value = params.get(key);
    if (key === "clarity") {
      const normalizedValue = value?.trim().toLowerCase();
      if (!normalizedValue || normalizedValue === "off" || normalizedValue === "false") {
        return true;
      }
      continue;
    }

    if (value === null || isTruthyValue(value)) {
      return true;
    }
  }

  return false;
}

function hasStorageOptOut() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const localValue = window.localStorage.getItem(CLARITY_DISABLE_STORAGE_KEY);
    if (localValue !== null) {
      return isTruthyValue(localValue);
    }

    const sessionValue = window.sessionStorage.getItem(CLARITY_DISABLE_STORAGE_KEY);
    if (sessionValue !== null) {
      return isTruthyValue(sessionValue);
    }
  } catch {
    return false;
  }

  return false;
}

export function shouldExcludeClarityTraffic(input: {
  userAgent?: string;
  webdriver?: boolean;
  search?: string;
  explicitDisable?: boolean;
}) {
  if (input.explicitDisable) {
    return true;
  }

  if (input.webdriver) {
    return true;
  }

  if (AGENT_USER_AGENT_PATTERN.test(input.userAgent ?? "")) {
    return true;
  }

  if (hasDisableSearchParam(input.search ?? "")) {
    return true;
  }

  return false;
}

function canTrackClaritySession() {
  if (!isClarityEnabled || typeof window === "undefined") {
    return false;
  }

  if (hasStorageOptOut()) {
    return false;
  }

  return !shouldExcludeClarityTraffic({
    explicitDisable: window.__DISABLE_CLARITY__ === true,
    search: window.location.search,
    userAgent: window.navigator.userAgent,
    webdriver: window.navigator.webdriver,
  });
}

function createClarityStub() {
  const clarity = ((...args: ClarityArgument[]) => {
    (clarity.q ??= []).push(args);
  }) as ClarityFn;

  return clarity;
}

export function initClarity() {
  if (
    !canTrackClaritySession() ||
    clarityStarted ||
    typeof document === "undefined"
  ) {
    return;
  }

  window.clarity ??= createClarityStub();

  if (document.querySelector(CLARITY_SCRIPT_SELECTOR)) {
    clarityStarted = true;
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  script.dataset.clarity = "application-prototype";

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  clarityStarted = true;
}

export function setClarityTag(key: string, value: string | null | undefined) {
  if (!canTrackClaritySession() || !value || typeof window === "undefined") {
    return;
  }

  window.clarity?.("set", key, value);
}
