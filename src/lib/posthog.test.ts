import { describe, expect, it, vi } from "vitest";
import { getApplicationAnalyticsProperties } from "./posthog";

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
