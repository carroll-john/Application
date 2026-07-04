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
// App host for "view in PostHog" links/toolbar (distinct from the ingestion
// host). Derived from the region of the configured ingestion host so a non-EU
// project only needs to change VITE_POSTHOG_HOST.
export const POSTHOG_UI_HOST = (() => {
  const region = /^https:\/\/(eu|us)\.i\.posthog\.com$/.exec(POSTHOG_HOST)?.[1];
  return `https://${region ?? "eu"}.posthog.com`;
})();

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

// Because we set `opt_out_useragent_filter: true` on posthog-js (so it can't drop
// authorised synthetic-test traffic — see posthogClient.initPostHog), this app
// filter is now the ONLY user-agent gate. It therefore mirrors the crawler/bot
// coverage posthog-js would otherwise provide via its DEFAULT_BLOCKED_UA_STRS:
// the generic `bot|spider|crawl` terms catch most (e.g. bingbot, msnbot,
// linkedinbot, twitterbot, petalbot, vercelbot, googlebot, screaming frog), and
// the explicit tail covers the SDK-blocked UAs that contain none of those tokens
// (Chrome-Lighthouse, vercel-screenshot, prerender, Google-Read-Aloud, etc.).
export const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawl|slurp|bingpreview|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|duckduckbot|baiduspider|yandexbot|applebot|lighthouse|google page speed|pagespeed|vercel-screenshot|prerender|google-read-aloud|googleweblight|hubspot|ia_archiver|sitebulb|nessus|deepscan)/i;
export const AUTOMATION_USER_AGENT_PATTERN =
  /(playwright|puppeteer|cypress|selenium|webdriver|postmanruntime|insomnia|curl|wget|python-requests)/i;
