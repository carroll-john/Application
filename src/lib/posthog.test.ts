import { describe, expect, it } from "vitest";
import {
  getApplicationAnalyticsProperties,
  getRequiredFunnelStepDefinition,
} from "./posthog";

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

describe("getRequiredFunnelStepDefinition", () => {
  it("maps required funnel step source events", () => {
    expect(getRequiredFunnelStepDefinition("application_step_viewed")?.eventName).toBe(
      "funnel_step_3_application_step_viewed",
    );
    expect(getRequiredFunnelStepDefinition("application_step_completed")?.eventName).toBe(
      "funnel_step_4_application_step_completed",
    );
    expect(getRequiredFunnelStepDefinition("application_submit_started")?.eventName).toBe(
      "funnel_step_5_application_submit_started",
    );
  });

  it("returns null for non-required events", () => {
    expect(getRequiredFunnelStepDefinition("application_draft_created")).toBeNull();
  });
});
