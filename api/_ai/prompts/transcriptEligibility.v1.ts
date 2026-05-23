export const TRANSCRIPT_ELIGIBILITY_PROMPT_ID = "transcript-eligibility";
export const TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION = 1;

const INSTRUCTIONS =
  "You are evaluating eligibility evidence from an academic transcript for postgraduate admission. Extract only what is explicitly evidenced in the document and never invent values. Return one of: eligible, conditionally_eligible, ineligible, or insufficient_data. Use insufficient_data whenever evidence is missing, conflicting, or low-confidence (especially for English proficiency and institution-specific GPA conversion rules). Keep explanations concise and practical for admissions triage. Preserve original values and provide normalized values where possible.";

const USER_PROMPT =
  "Parse this transcript and return an explainable eligibility assessment with requirement checks, confidence, missing information, and recommended next step.";

export const transcriptEligibilityPromptV1 = {
  id: TRANSCRIPT_ELIGIBILITY_PROMPT_ID,
  version: TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION,
  instructions: INSTRUCTIONS,
  userPrompt: USER_PROMPT,
} as const;

export type TranscriptEligibilityPrompt = typeof transcriptEligibilityPromptV1;

