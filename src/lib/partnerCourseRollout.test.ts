import { describe, expect, it } from "vitest";
import { canonicalApplicationSamples } from "../integrationPlatform/examples";
import {
  createSeedPartnerCourseRolloutConfigs,
  getPartnerCourseRolloutSnapshot,
  transitionPartnerCourseRolloutMode,
} from "./partnerCourseRollout";

describe("partnerCourseRollout", () => {
  it("resolves seeded pilot course lines to distinct rollout modes", () => {
    const configs = createSeedPartnerCourseRolloutConfigs();

    expect(
      getPartnerCourseRolloutSnapshot(canonicalApplicationSamples[0], configs).mode,
    ).toBe("mode-3-automated-provisioning");
    expect(
      getPartnerCourseRolloutSnapshot(canonicalApplicationSamples[1], configs).mode,
    ).toBe("mode-2-decision-export");
    expect(
      getPartnerCourseRolloutSnapshot(canonicalApplicationSamples[2], configs).mode,
    ).toBe("mode-1-review-only");
  });

  it("applies valid transitions and preserves transition history", () => {
    const result = transitionPartnerCourseRolloutMode(
      createSeedPartnerCourseRolloutConfigs(),
      {
        actor: "ops.lead@keypath.com.au",
        courseCode: "GC-PM",
        courseTitle: "Graduate Certificate in Project Management",
        nextMode: "mode-3-automated-provisioning",
        occurredAt: "2026-03-10T15:00:00Z",
        partnerId: "TIU",
        partnerName: "Tasman Institute of Technology",
        reason: "Partner import runner is stable enough to promote to automation.",
      },
    );

    expect(result.valid).toBe(true);
    expect(result.config?.activeMode).toBe("mode-3-automated-provisioning");
    expect(result.config?.transitions).toHaveLength(2);
    expect(result.config?.transitions.at(-1)).toMatchObject({
      actor: "ops.lead@keypath.com.au",
      outcome: "applied",
      toMode: "mode-3-automated-provisioning",
    });
  });

  it("rejects invalid transitions and records the rejection in transition history", () => {
    const result = transitionPartnerCourseRolloutMode(
      createSeedPartnerCourseRolloutConfigs(),
      {
        actor: "vendor.user@example.com",
        courseCode: "GC-PM",
        courseTitle: "Graduate Certificate in Project Management",
        nextMode: "mode-2-decision-export",
        occurredAt: "2026-03-10T15:05:00Z",
        partnerId: "TIU",
        partnerName: "Tasman Institute of Technology",
        reason: "",
      },
    );

    expect(result.valid).toBe(false);
    expect(result.validationErrors).toEqual([
      "Only authorized Keypath operators can change rollout modes.",
      "A rollout transition reason is required.",
      "The selected rollout mode is already active for this course line.",
    ]);
    expect(result.config?.activeMode).toBe("mode-2-decision-export");
    expect(result.config?.transitions.at(-1)).toMatchObject({
      outcome: "rejected",
      toMode: "mode-2-decision-export",
    });
  });
});
