export type PostHogUserContext = {
  email?: string;
  emailDomain?: string;
  id: string;
  name?: string;
};

export const APP_ENVIRONMENT = import.meta.env.MODE;
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
export const POSTHOG_HOST = (
  import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com"
).replace(/\/+$/, "");
// App host for "view in PostHog" links/toolbar (distinct from the ingestion host).
export const POSTHOG_UI_HOST = "https://eu.posthog.com";

// Authorised synthetic end-to-end QA traffic. The bot-detection below normally
// drops automation (webdriver/Playwright/headless). When this build-time token
// is set, a session that presents the matching value via the
// `?kp_synthetic=<token>` query param (persisted to localStorage) is allowed
// through the filter AND has every event tagged `synthetic_test: true`, so the
// test data can be excluded from real metrics. With no token configured the
// doorway is closed, so it can never be enabled in normal production.
export const SYNTHETIC_TEST_TOKEN =
  import.meta.env.VITE_ANALYTICS_SYNTHETIC_TOKEN?.trim() ?? "";
export const SYNTHETIC_TEST_QUERY_PARAM = "kp_synthetic";
export const SYNTHETIC_TEST_STORAGE_KEY = "keypath.analytics.synthetic_test";

export const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawl|slurp|bingpreview|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|duckduckbot|baiduspider|yandexbot|applebot)/i;
export const AUTOMATION_USER_AGENT_PATTERN =
  /(playwright|puppeteer|cypress|selenium|webdriver|postmanruntime|insomnia|curl|wget|python-requests)/i;
