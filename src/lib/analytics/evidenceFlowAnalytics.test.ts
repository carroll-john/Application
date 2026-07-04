import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLICATION_EVIDENCE_PROMPT_VIEWED_EVENT,
  APPLICATION_EVIDENCE_SECTION_SKIPPED_EVENT,
  APPLICATION_EVIDENCE_SECTION_UNSKIPPED_EVENT,
  ELIGIBILITY_FEEDBACK_SUBMITTED_EVENT,
  trackEligibilityFeedbackSubmitted,
  trackEvidencePromptViewed,
  trackEvidenceSectionSkipped,
  trackEvidenceSectionUnskipped,
} from "./evidenceFlowAnalytics";

const capturePostHogEvent = vi.hoisted(() => vi.fn());
const getApplicationAnalyticsProperties = vi.hoisted(() =>
  vi.fn(() => ({ application_id: "app-1", course_code: "NUR101" })),
);

vi.mock("./posthogClient", () => ({
  capturePostHogEvent,
}));

vi.mock("./posthogProperties", () => ({
  getApplicationAnalyticsProperties,
}));

describe("evidenceFlowAnalytics", () => {
  beforeEach(() => {
    capturePostHogEvent.mockClear();
  });

  it("captures prompt viewed with application context and prompt details", () => {
    trackEvidencePromptViewed({
      application: null,
      evidenceSectionKey: "tertiary",
      outstandingPromptCount: 3,
      promptHeading: "Academic transcript",
      promptSource: "requirement",
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      APPLICATION_EVIDENCE_PROMPT_VIEWED_EVENT,
      {
        application_id: "app-1",
        course_code: "NUR101",
        evidence_prompt_heading: "Academic transcript",
        evidence_prompt_source: "requirement",
        evidence_section_key: "tertiary",
        outstanding_prompt_count: 3,
      },
    );
  });

  it("captures section skipped and unskipped with application context", () => {
    trackEvidenceSectionSkipped({
      application: null,
      evidenceSectionKey: "languageTest",
      outstandingPromptCount: 1,
    });
    trackEvidenceSectionUnskipped({
      application: null,
      evidenceSectionKey: "languageTest",
      outstandingPromptCount: 1,
    });

    expect(capturePostHogEvent).toHaveBeenNthCalledWith(
      1,
      APPLICATION_EVIDENCE_SECTION_SKIPPED_EVENT,
      {
        application_id: "app-1",
        course_code: "NUR101",
        evidence_section_key: "languageTest",
        outstanding_prompt_count: 1,
      },
    );
    expect(capturePostHogEvent).toHaveBeenNthCalledWith(
      2,
      APPLICATION_EVIDENCE_SECTION_UNSKIPPED_EVENT,
      {
        application_id: "app-1",
        course_code: "NUR101",
        evidence_section_key: "languageTest",
        outstanding_prompt_count: 1,
      },
    );
  });

  it("captures feedback submitted with flagged requirement summary", () => {
    trackEligibilityFeedbackSubmitted({
      courseCode: "NUR101",
      courseTitle: "Nursing",
      flaggedRequirementIds: ["req-1", "req-2"],
      hasNote: true,
      reasonCodes: ["wam_below_threshold"],
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      ELIGIBILITY_FEEDBACK_SUBMITTED_EVENT,
      {
        course_code: "NUR101",
        course_title: "Nursing",
        flagged_requirement_count: 2,
        flagged_requirement_ids: ["req-1", "req-2"],
        has_note: true,
        reason_codes: ["wam_below_threshold"],
      },
    );
  });

  it("null-fills missing course context", () => {
    trackEligibilityFeedbackSubmitted({
      flaggedRequirementIds: ["req-1"],
      hasNote: false,
      reasonCodes: [],
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      ELIGIBILITY_FEEDBACK_SUBMITTED_EVENT,
      expect.objectContaining({
        course_code: null,
        course_title: null,
      }),
    );
  });
});
