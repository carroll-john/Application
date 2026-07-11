import {
  parseTranscriptEligibilityContext,
  type TranscriptEligibilityRequestContext,
} from "@johncarroll/eligibility-rules";

export type { TranscriptEligibilityRequestContext };

/** Parses multipart `context` for the transcript-eligibility route. */
export function parseContext(
  rawValue: FormDataEntryValue | null,
): TranscriptEligibilityRequestContext {
  if (rawValue === null) {
    return parseTranscriptEligibilityContext(undefined);
  }
  if (typeof rawValue === "string") {
    return parseTranscriptEligibilityContext(rawValue);
  }
  return parseTranscriptEligibilityContext(undefined);
}
