import type { AnalyticsEventName } from "./events";
import { capturePostHogEvent } from "./posthogClient";
import { getApplicationAnalyticsProperties } from "./posthogProperties";

export const APPLICATION_EVIDENCE_PROMPT_VIEWED_EVENT =
  "application_evidence_prompt_viewed" satisfies AnalyticsEventName;
export const APPLICATION_EVIDENCE_SECTION_SKIPPED_EVENT =
  "application_evidence_section_skipped" satisfies AnalyticsEventName;
export const APPLICATION_EVIDENCE_SECTION_UNSKIPPED_EVENT =
  "application_evidence_section_unskipped" satisfies AnalyticsEventName;
export const ELIGIBILITY_FEEDBACK_SUBMITTED_EVENT =
  "eligibility_feedback_submitted" satisfies AnalyticsEventName;

type EvidenceApplicationContext = Parameters<
  typeof getApplicationAnalyticsProperties
>[0];

/**
 * The doc-first qualifications hub surfaces one evidence prompt at a time.
 * Fired when a new prompt becomes the active one (callers dedupe repeats).
 */
export function trackEvidencePromptViewed(properties: {
  application: EvidenceApplicationContext;
  evidenceSectionKey: string;
  promptHeading: string;
  promptSource: "requirement" | "generic";
  outstandingPromptCount: number;
}) {
  capturePostHogEvent(APPLICATION_EVIDENCE_PROMPT_VIEWED_EVENT, {
    ...getApplicationAnalyticsProperties(properties.application),
    evidence_prompt_heading: properties.promptHeading,
    evidence_prompt_source: properties.promptSource,
    evidence_section_key: properties.evidenceSectionKey,
    outstanding_prompt_count: properties.outstandingPromptCount,
  });
}

export function trackEvidenceSectionSkipped(properties: {
  application: EvidenceApplicationContext;
  evidenceSectionKey: string;
  outstandingPromptCount: number;
}) {
  capturePostHogEvent(APPLICATION_EVIDENCE_SECTION_SKIPPED_EVENT, {
    ...getApplicationAnalyticsProperties(properties.application),
    evidence_section_key: properties.evidenceSectionKey,
    outstanding_prompt_count: properties.outstandingPromptCount,
  });
}

export function trackEvidenceSectionUnskipped(properties: {
  application: EvidenceApplicationContext;
  evidenceSectionKey: string;
  outstandingPromptCount: number;
}) {
  capturePostHogEvent(APPLICATION_EVIDENCE_SECTION_UNSKIPPED_EVENT, {
    ...getApplicationAnalyticsProperties(properties.application),
    evidence_section_key: properties.evidenceSectionKey,
    outstanding_prompt_count: properties.outstandingPromptCount,
  });
}

/**
 * Client-side companion to the server-captured `eligibility_check_override`:
 * the server event's distinct id is derived from course context, so this is
 * the only signal that joins override feedback to the person's funnel.
 */
export function trackEligibilityFeedbackSubmitted(properties: {
  courseCode?: string;
  courseTitle?: string;
  flaggedRequirementIds: string[];
  hasNote: boolean;
  reasonCodes: string[];
}) {
  capturePostHogEvent(ELIGIBILITY_FEEDBACK_SUBMITTED_EVENT, {
    course_code: properties.courseCode ?? null,
    course_title: properties.courseTitle ?? null,
    flagged_requirement_count: properties.flaggedRequirementIds.length,
    flagged_requirement_ids: properties.flaggedRequirementIds,
    has_note: properties.hasNote,
    reason_codes: properties.reasonCodes,
  });
}
