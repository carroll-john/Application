import { describe, expect, it, vi } from "vitest";
import {
  TERTIARY_TRANSCRIPT_PARSER_DRAFT_EMPTY_EVENT,
  TERTIARY_TRANSCRIPT_PARSER_DRAFT_FAILED_EVENT,
  TERTIARY_TRANSCRIPT_PARSER_DRAFT_SUCCEEDED_EVENT,
  TERTIARY_TRANSCRIPT_PARSER_SAVE_CONTINUE_CLICKED_EVENT,
  getTertiaryTranscriptParserErrorCode,
  trackTertiaryTranscriptParserDraftEmpty,
  trackTertiaryTranscriptParserDraftFailed,
  trackTertiaryTranscriptParserDraftSucceeded,
  trackTertiaryTranscriptParserSaveContinueClicked,
} from "./tertiaryTranscriptParserAnalytics";

const capturePostHogEvent = vi.hoisted(() => vi.fn());

vi.mock("./posthogClient", () => ({
  capturePostHogEvent,
}));

describe("tertiaryTranscriptParserAnalytics", () => {
  it("captures save and continue with product properties only", () => {
    trackTertiaryTranscriptParserSaveContinueClicked({
      hasSelectedTranscript: true,
      isCoreEmpty: false,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      TERTIARY_TRANSCRIPT_PARSER_SAVE_CONTINUE_CLICKED_EVENT,
      {
        has_selected_transcript: true,
        is_core_empty: false,
      },
    );
  });

  it("captures draft succeeded with field count, outcome and duration", () => {
    trackTertiaryTranscriptParserDraftSucceeded({
      draftedFieldCount: 5,
      eligibilityOutcome: "eligible",
      parseDurationMs: 1800,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      TERTIARY_TRANSCRIPT_PARSER_DRAFT_SUCCEEDED_EVENT,
      {
        drafted_field_count: 5,
        eligibility_outcome: "eligible",
        parse_duration_ms: 1800,
      },
    );
  });

  it("captures draft succeeded with a null outcome when none is provided", () => {
    trackTertiaryTranscriptParserDraftSucceeded({
      draftedFieldCount: 0,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      TERTIARY_TRANSCRIPT_PARSER_DRAFT_SUCCEEDED_EVENT,
      {
        drafted_field_count: 0,
        eligibility_outcome: null,
        parse_duration_ms: undefined,
      },
    );
  });

  it("captures draft empty with duration", () => {
    trackTertiaryTranscriptParserDraftEmpty({ parseDurationMs: 700 });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      TERTIARY_TRANSCRIPT_PARSER_DRAFT_EMPTY_EVENT,
      {
        parse_duration_ms: 700,
      },
    );
  });

  it("captures draft failed with optional error code", () => {
    trackTertiaryTranscriptParserDraftFailed({
      errorCode: "TRANSCRIPT_PARSER_UPSTREAM_TIMEOUT",
      parseDurationMs: 5000,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      TERTIARY_TRANSCRIPT_PARSER_DRAFT_FAILED_EVENT,
      {
        error_code: "TRANSCRIPT_PARSER_UPSTREAM_TIMEOUT",
        parse_duration_ms: 5000,
      },
    );
  });

  it("extracts error codes from parser errors", () => {
    expect(
      getTertiaryTranscriptParserErrorCode({ code: "TRANSCRIPT_PARSER_RATE_LIMITED" }),
    ).toBe("TRANSCRIPT_PARSER_RATE_LIMITED");
    expect(getTertiaryTranscriptParserErrorCode(new Error("nope"))).toBeUndefined();
  });
});
