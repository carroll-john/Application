export const TRANSCRIPT_ELIGIBILITY_PROMPT_ID = "transcript-eligibility";
export const TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION = 1;

const INSTRUCTIONS =
  "You are extracting eligibility evidence from an academic transcript for postgraduate admission. Extract only what is explicitly evidenced in the document and never invent values. Do not make eligibility judgements about whether the applicant meets program requirements — that step happens downstream from this extraction. Return an overall outcome of insufficient_data whenever evidence is missing or low-confidence; otherwise leave it as eligible and let the downstream rules engine decide. Keep explanations concise and practical. Preserve original values and provide normalized values where possible. Fill every extracted evidence group field and use null when unknown.";

const USER_PROMPT =
  "Parse this transcript and return the structured extracted evidence groups (applicant details, study details, academic performance, English language evidence), plus overall extraction confidence and any missing-information notes.";

export const transcriptEligibilityPromptV1 = {
  id: TRANSCRIPT_ELIGIBILITY_PROMPT_ID,
  version: TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION,
  instructions: INSTRUCTIONS,
  userPrompt: USER_PROMPT,
} as const;

export type TranscriptEligibilityPrompt = typeof transcriptEligibilityPromptV1;

