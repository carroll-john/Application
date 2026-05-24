import { capturePostHogEvent } from "./posthogClient";

export const TERTIARY_TRANSCRIPT_PARSER_SAVE_CONTINUE_CLICKED_EVENT =
  "tertiary_transcript_parser_save_continue_clicked";
export const TERTIARY_TRANSCRIPT_PARSER_DRAFT_SUCCEEDED_EVENT =
  "tertiary_transcript_parser_draft_succeeded";
export const TERTIARY_TRANSCRIPT_PARSER_DRAFT_EMPTY_EVENT =
  "tertiary_transcript_parser_draft_empty";
export const TERTIARY_TRANSCRIPT_PARSER_DRAFT_FAILED_EVENT =
  "tertiary_transcript_parser_draft_failed";

export function trackTertiaryTranscriptParserSaveContinueClicked(properties: {
  hasSelectedTranscript: boolean;
  isCoreEmpty: boolean;
}) {
  capturePostHogEvent(TERTIARY_TRANSCRIPT_PARSER_SAVE_CONTINUE_CLICKED_EVENT, {
    has_selected_transcript: properties.hasSelectedTranscript,
    is_core_empty: properties.isCoreEmpty,
  });
}

export function trackTertiaryTranscriptParserDraftSucceeded(properties: {
  draftedFieldCount: number;
  eligibilityOutcome?: string;
  parseDurationMs?: number;
}) {
  capturePostHogEvent(TERTIARY_TRANSCRIPT_PARSER_DRAFT_SUCCEEDED_EVENT, {
    drafted_field_count: properties.draftedFieldCount,
    eligibility_outcome: properties.eligibilityOutcome ?? null,
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function trackTertiaryTranscriptParserDraftEmpty(properties: {
  parseDurationMs?: number;
}) {
  capturePostHogEvent(TERTIARY_TRANSCRIPT_PARSER_DRAFT_EMPTY_EVENT, {
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function trackTertiaryTranscriptParserDraftFailed(properties: {
  errorCode?: string;
  parseDurationMs?: number;
}) {
  capturePostHogEvent(TERTIARY_TRANSCRIPT_PARSER_DRAFT_FAILED_EVENT, {
    error_code: properties.errorCode ?? null,
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function getTertiaryTranscriptParserErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.trim()
  ) {
    return error.code;
  }

  return undefined;
}
