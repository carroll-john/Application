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

export const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawl|slurp|bingpreview|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|duckduckbot|baiduspider|yandexbot|applebot)/i;
export const AUTOMATION_USER_AGENT_PATTERN =
  /(playwright|puppeteer|cypress|selenium|webdriver|postmanruntime|insomnia|curl|wget|python-requests)/i;
