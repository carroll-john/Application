export type PostHogConfig = {
  api_host: string;
  autocapture: boolean;
  capture_pageleave: boolean;
  capture_pageview: boolean;
  persistence: "localStorage+cookie";
};

export type PostHogUserContext = {
  email?: string;
  emailDomain?: string;
  id: string;
  name?: string;
};

export type PostHogQueue = Array<[string, ...unknown[]]> & {
  __SV?: number;
  _i?: Array<[string, PostHogConfig, string?]>;
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
  getFeatureFlag?: (key: string) => boolean | string | undefined;
  identify?: (
    distinctId: string,
    properties?: Record<string, unknown>,
  ) => void;
  init?: (token: string, config: PostHogConfig, name?: string) => void;
  isFeatureEnabled?: (key: string) => boolean | undefined;
  onFeatureFlags?: (callback: () => void) => (() => void) | void;
  register?: (properties: Record<string, unknown>) => void;
  reset?: () => void;
};

declare global {
  interface Window {
    posthog?: PostHogQueue;
  }
}

export const APP_ENVIRONMENT = import.meta.env.MODE;
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
export const POSTHOG_HOST = (
  import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
).replace(/\/+$/, "");

export const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawl|slurp|bingpreview|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|duckduckbot|baiduspider|yandexbot|applebot)/i;
export const AUTOMATION_USER_AGENT_PATTERN =
  /(playwright|puppeteer|cypress|selenium|webdriver|postmanruntime|insomnia|curl|wget|python-requests)/i;
export const ENABLED_VARIANTS = new Set([
  "enabled",
  "on",
  "true",
  "test",
  "treatment",
  "variant",
  "variant_a",
  "variant_b",
]);

export interface CvParserExperimentState {
  enabled: boolean;
  source: "posthog" | "fallback";
  variant: string | boolean | null;
}

export type AiExperimentState = CvParserExperimentState;

export const CV_PARSER_FEATURE_FLAG_KEY =
  import.meta.env.VITE_POSTHOG_CV_PARSER_FLAG?.trim() ||
  "cv_parser_autofill_experiment";
