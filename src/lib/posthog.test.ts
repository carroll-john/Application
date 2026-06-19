import { describe, expect, it, vi } from "vitest";
import { getApplicationAnalyticsProperties, isReplayPiiRoute } from "./posthog";
import { matchesSyntheticTestToken } from "./analytics/posthogClient";

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
    onFeatureFlags: vi.fn(() => () => {}),
    isFeatureEnabled: vi.fn(),
    getFeatureFlagPayload: vi.fn(),
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
