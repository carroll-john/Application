import { describe, expect, it, vi } from "vitest";
import type { ValidationIssue } from "../validation/types";
import {
  APPLICATION_SUBMIT_BLOCKED_EVENT,
  getSubmitBlockedValidationProperties,
  getValidationIssueCode,
  resolveBlockedStepKey,
  resolveBlockedStepLabel,
  trackApplicationSubmitBlocked,
} from "./submitBlockedAnalytics";

const capturePostHogEvent = vi.hoisted(() => vi.fn());

vi.mock("./posthogClient", () => ({
  capturePostHogEvent,
}));

describe("submitBlockedAnalytics", () => {
  it("builds stable issue codes from validation metadata", () => {
    const issue: ValidationIssue = {
      section: "Section 1: Personal information",
      subsection: "Basic information",
      field: "First name",
      path: "/section1/basic-info?from=review",
      stepLabel: "Basic information",
    };

    expect(getValidationIssueCode(issue)).toBe("section1_basic_info:first_name");
    expect(resolveBlockedStepKey(issue)).toBe("section1_basic_info");
    expect(resolveBlockedStepLabel(issue)).toBe("Basic information");
  });

  it("resolves step metadata from route paths when stepLabel is absent", () => {
    const issue: ValidationIssue = {
      section: "Section 1: Personal information",
      subsection: "Cultural & education background",
      field: "Language spoken",
      path: "/section1/cultural-background?from=review",
    };

    expect(resolveBlockedStepKey(issue)).toBe("section1_cultural_background");
    expect(resolveBlockedStepLabel(issue)).toBe("Cultural background");
  });

  it("orders blocked steps and fields by funnel position", () => {
    const properties = getSubmitBlockedValidationProperties([
      {
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: "Qualification 1: Course Name",
        path: "/section2/edit-tertiary/qual-1?from=review",
      },
      {
        section: "Section 1: Personal information",
        subsection: "Basic information",
        field: "Last name",
        path: "/section1/basic-info?from=review",
        stepLabel: "Basic information",
      },
      {
        section: "Section 1: Personal information",
        subsection: "Basic information",
        field: "First name",
        path: "/section1/basic-info?from=review",
        stepLabel: "Basic information",
      },
    ]);

    expect(properties).toEqual({
      application_step_key: "section1_basic_info",
      application_step_label: "Basic information",
      blocked_step_keys: ["section1_basic_info", "section2_tertiary_qualification"],
      blocked_step_labels: ["Basic information", "Tertiary qualification"],
      field_names: ["First name", "Last name", "Qualification 1: Course Name"],
      primary_field: "First name",
      submit_page_key: "review_and_submit",
      validation_error_count: 3,
      validation_issue_codes: [
        "section1_basic_info:first_name",
        "section1_basic_info:last_name",
        "section2_tertiary_qualification:qualification_1_course_name",
      ],
    });
  });

  it("captures submit blocked with application and validation context", () => {
    trackApplicationSubmitBlocked({
      application: {
        applicationMeta: {
          recordId: "app-123",
          applicationNumber: "KP-001",
          status: "draft",
          selectedCourse: {
            code: "MBA-2026",
            title: "MBA",
            provider: "Keypath",
            intake: "2026-01",
          },
        },
      },
      validationIssues: [
        {
          section: "Section 1: Personal information",
          subsection: "Personal contact details",
          field: "Phone number",
          path: "/section1/personal-contact?from=review",
          stepLabel: "Personal contact details",
        },
      ],
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      APPLICATION_SUBMIT_BLOCKED_EVENT,
      expect.objectContaining({
        application_id: "app-123",
        application_number: "KP-001",
        application_route_path: "/review",
        application_step_key: "section1_personal_contact",
        application_step_label: "Personal contact details",
        blocked_step_keys: ["section1_personal_contact"],
        blocked_step_labels: ["Personal contact details"],
        course_code: "MBA-2026",
        course_provider: "Keypath",
        field_names: ["Phone number"],
        page_group: "application",
        page_key: "review_and_submit",
        page_name: "Review and submit",
        primary_field: "Phone number",
        submit_page_key: "review_and_submit",
        validation_error_count: 1,
        validation_issue_codes: ["section1_personal_contact:phone_number"],
      }),
    );
  });
});
