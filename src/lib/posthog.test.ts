import { describe, expect, it, vi } from "vitest";
import { getApplicationAnalyticsProperties, isReplayPiiRoute } from "./posthog";
import { matchesSyntheticTestToken } from "./analytics/posthogClient";
import { BOT_USER_AGENT_PATTERN } from "./analytics/posthogTypes";

// The barrel pulls in posthogClient, which imports the real posthog-js SDK.
// Vitest runs in a node environment, so mock the SDK to keep the import hermetic.
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    register: vi.fn(),
    group: vi.fn(),
    opt_out_capturing: vi.fn(),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  },
}));

describe("getApplicationAnalyticsProperties", () => {
  it("hashes applicant profile IDs before sending analytics properties", () => {
    const properties = getApplicationAnalyticsProperties({
      applicationMeta: {
        applicantProfileId: "local-profile:user@example.com",
      },
    });

    expect(properties.applicant_profile_id).toMatch(/^fnv1a:/);
    expect(properties.applicant_profile_id).not.toContain("user@example.com");
  });
});

describe("isReplayPiiRoute", () => {
  it("marks authenticated/application routes as PII routes (replay stopped)", () => {
    expect(isReplayPiiRoute("/sign-in")).toBe(true);
    expect(isReplayPiiRoute("/profile")).toBe(true);
    expect(isReplayPiiRoute("/section1/personal-contact")).toBe(true);
    expect(isReplayPiiRoute("/section2/add-cv")).toBe(true);
    expect(isReplayPiiRoute("/review")).toBe(true);
    expect(isReplayPiiRoute("/auth/callback")).toBe(true);
  });

  it("treats trailing-slash variants of PII routes as PII (replay stopped)", () => {
    expect(isReplayPiiRoute("/profile/")).toBe(true);
    expect(isReplayPiiRoute("/review/")).toBe(true);
    expect(isReplayPiiRoute("/dashboard/")).toBe(true);
    expect(isReplayPiiRoute("/section1/")).toBe(true);
  });

  it("does not mark public catalog routes as PII routes (replay allowed)", () => {
    expect(isReplayPiiRoute("/")).toBe(false);
    expect(isReplayPiiRoute("/courses/mba")).toBe(false);
  });
});

describe("matchesSyntheticTestToken", () => {
  it("allows synthetic traffic only when a token is configured and matches exactly", () => {
    expect(matchesSyntheticTestToken("s3cret", "s3cret")).toBe(true);
    expect(matchesSyntheticTestToken("s3cret", "wrong")).toBe(false);
    expect(matchesSyntheticTestToken("s3cret", null)).toBe(false);
    expect(matchesSyntheticTestToken("s3cret", undefined)).toBe(false);
  });

  it("stays disabled when no token is configured (closed by default in prod)", () => {
    expect(matchesSyntheticTestToken("", "s3cret")).toBe(false);
    expect(matchesSyntheticTestToken("", "")).toBe(false);
    expect(matchesSyntheticTestToken("", null)).toBe(false);
  });
});

describe("BOT_USER_AGENT_PATTERN", () => {
  // We opt out of posthog-js's own UA filter (so it can't drop authorised
  // synthetic traffic), which makes this the sole UA gate. It must therefore
  // still catch the crawlers the SDK's DEFAULT_BLOCKED_UA_STRS covered —
  // especially the ones without a generic bot/spider/crawl token.
  it("matches the crawler UAs posthog-js would otherwise block", () => {
    const blockedUserAgents = [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Chrome-Lighthouse",
      "vercel-screenshot/1.0",
      "Prerender (+https://github.com/prerender/prerender)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Google-Read-Aloud",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    ];
    for (const userAgent of blockedUserAgents) {
      expect(BOT_USER_AGENT_PATTERN.test(userAgent.toLowerCase())).toBe(true);
    }
  });

  it("does not match a normal desktop browser UA", () => {
    const realBrowser =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    expect(BOT_USER_AGENT_PATTERN.test(realBrowser.toLowerCase())).toBe(false);
  });
});
