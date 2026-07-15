import { describe, expect, it, vi } from "vitest";
import type { WorkExperienceAssessment } from "../eligibility/workExperience";
import {
  trackWorkExperienceAssessmentCompleted,
  trackWorkExperienceAssessmentFailed,
} from "./workExperienceAnalytics";

const capturePostHogEvent = vi.hoisted(() => vi.fn());

vi.mock("./posthogClient", () => ({ capturePostHogEvent }));

const assessment = {
  requirementId: "work-1",
  status: "provisionally_met",
  requiredMonths: 36,
  qualifyingMonthsMinimum: 36,
  qualifyingMonthsMaximum: 61,
  roleAssessments: [],
  unassessedConditions: [],
  inputFingerprint: "we-test",
  checkedAt: "2026-07-16T00:00:00.000Z",
  promptVersion: "test@v1",
  schemaVersion: "work-experience-assessment@v1",
} satisfies WorkExperienceAssessment;

describe("workExperienceAnalytics", () => {
  it("captures only coarse assessment metadata", () => {
    trackWorkExperienceAssessmentCompleted({
      assessments: [assessment],
      latencyMs: 820,
      roleCount: 3,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "work_experience_assessment_completed",
      {
        assessment_count: 1,
        assessment_statuses: ["provisionally_met"],
        latency_ms: 820,
        qualifying_duration_maximum_bands: ["5_plus_years"],
        qualifying_duration_minimum_bands: ["3_to_5_years"],
        role_count: 3,
      },
    );
  });

  it("captures only a stable error code, latency, and role count on failure", () => {
    trackWorkExperienceAssessmentFailed({
      errorCode: "WORK_EXPERIENCE_RATE_LIMITED",
      latencyMs: 120,
      roleCount: 2,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "work_experience_assessment_failed",
      {
        error_code: "WORK_EXPERIENCE_RATE_LIMITED",
        latency_ms: 120,
        role_count: 2,
      },
    );
  });
});
