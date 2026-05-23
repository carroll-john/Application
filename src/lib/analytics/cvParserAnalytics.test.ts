import { describe, expect, it, vi } from "vitest";
import {
  CV_PARSER_DRAFT_EMPTY_EVENT,
  CV_PARSER_DRAFT_FAILED_EVENT,
  CV_PARSER_DRAFT_SUCCEEDED_EVENT,
  CV_PARSER_SAVE_CONTINUE_CLICKED_EVENT,
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
  trackCvParserSaveContinueClicked,
} from "./cvParserAnalytics";

const capturePostHogEvent = vi.hoisted(() => vi.fn());

vi.mock("./posthogClient", () => ({
  capturePostHogEvent,
}));

describe("cvParserAnalytics", () => {
  it("captures save and continue with product properties only", () => {
    trackCvParserSaveContinueClicked({
      existingEmploymentCount: 2,
      hasSelectedFile: true,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      CV_PARSER_SAVE_CONTINUE_CLICKED_EVENT,
      {
        existing_employment_count: 2,
        has_selected_file: true,
      },
    );
  });

  it("captures draft succeeded with role count and duration", () => {
    trackCvParserDraftSucceeded({
      draftedRolesCount: 3,
      parseDurationMs: 1200,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      CV_PARSER_DRAFT_SUCCEEDED_EVENT,
      {
        drafted_roles_count: 3,
        parse_duration_ms: 1200,
      },
    );
  });

  it("captures draft empty with duration", () => {
    trackCvParserDraftEmpty({ parseDurationMs: 900 });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      CV_PARSER_DRAFT_EMPTY_EVENT,
      {
        parse_duration_ms: 900,
      },
    );
  });

  it("captures draft failed with optional error code", () => {
    trackCvParserDraftFailed({
      errorCode: "CV_PARSER_UPSTREAM_TIMEOUT",
      parseDurationMs: 5000,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      CV_PARSER_DRAFT_FAILED_EVENT,
      {
        error_code: "CV_PARSER_UPSTREAM_TIMEOUT",
        parse_duration_ms: 5000,
      },
    );
  });

  it("extracts error codes from parser errors", () => {
    expect(getCvParserErrorCode({ code: "CV_PARSER_RATE_LIMITED" })).toBe(
      "CV_PARSER_RATE_LIMITED",
    );
    expect(getCvParserErrorCode(new Error("nope"))).toBeUndefined();
  });
});
