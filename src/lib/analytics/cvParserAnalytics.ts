import type { AnalyticsEventName } from "./events";
import { capturePostHogEvent } from "./posthogClient";

// Renamed from cv_parser_autofill_* when the PostHog experiment graduated to GA.
export const CV_PARSER_SAVE_CONTINUE_CLICKED_EVENT =
  "cv_parser_save_continue_clicked" satisfies AnalyticsEventName;
export const CV_PARSER_DRAFT_SUCCEEDED_EVENT =
  "cv_parser_draft_succeeded" satisfies AnalyticsEventName;
export const CV_PARSER_DRAFT_EMPTY_EVENT =
  "cv_parser_draft_empty" satisfies AnalyticsEventName;
export const CV_PARSER_DRAFT_FAILED_EVENT =
  "cv_parser_draft_failed" satisfies AnalyticsEventName;

export function trackCvParserSaveContinueClicked(properties: {
  existingEmploymentCount: number;
  hasSelectedFile: boolean;
}) {
  capturePostHogEvent(CV_PARSER_SAVE_CONTINUE_CLICKED_EVENT, {
    existing_employment_count: properties.existingEmploymentCount,
    has_selected_file: properties.hasSelectedFile,
  });
}

export function trackCvParserDraftSucceeded(properties: {
  draftedRolesCount: number;
  parseDurationMs?: number;
}) {
  capturePostHogEvent(CV_PARSER_DRAFT_SUCCEEDED_EVENT, {
    drafted_roles_count: properties.draftedRolesCount,
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function trackCvParserDraftEmpty(properties: {
  parseDurationMs?: number;
}) {
  capturePostHogEvent(CV_PARSER_DRAFT_EMPTY_EVENT, {
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function trackCvParserDraftFailed(properties: {
  errorCode?: string;
  parseDurationMs?: number;
}) {
  capturePostHogEvent(CV_PARSER_DRAFT_FAILED_EVENT, {
    error_code: properties.errorCode ?? null,
    parse_duration_ms: properties.parseDurationMs,
  });
}

export function getCvParserErrorCode(error: unknown) {
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
