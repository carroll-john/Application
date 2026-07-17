import type { WorkExperienceAssessment } from "../eligibility/workExperience";
import { capturePostHogEvent } from "./posthogClient";

function durationBand(months: number) {
  if (months < 12) return "under_1_year";
  if (months < 24) return "1_to_2_years";
  if (months < 36) return "2_to_3_years";
  if (months < 60) return "3_to_5_years";
  return "5_plus_years";
}

export function trackWorkExperienceAssessmentCompleted(properties: {
  assessments: WorkExperienceAssessment[];
  latencyMs: number;
  roleCount: number;
}) {
  capturePostHogEvent("work_experience_assessment_completed", {
    assessment_count: properties.assessments.length,
    assessment_statuses: properties.assessments.map((assessment) => assessment.status),
    latency_ms: properties.latencyMs,
    qualifying_duration_maximum_bands: properties.assessments.map(
      (assessment) => durationBand(assessment.qualifyingMonthsMaximum),
    ),
    qualifying_duration_minimum_bands: properties.assessments.map(
      (assessment) => durationBand(assessment.qualifyingMonthsMinimum),
    ),
    role_count: properties.roleCount,
  });
}

export function trackWorkExperienceAssessmentFailed(properties: {
  errorCode?: string;
  latencyMs: number;
  roleCount: number;
}) {
  capturePostHogEvent("work_experience_assessment_failed", {
    error_code: properties.errorCode ?? "unknown",
    latency_ms: properties.latencyMs,
    role_count: properties.roleCount,
  });
}
