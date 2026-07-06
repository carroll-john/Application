export const TRANSCRIPT_ELIGIBILITY_PROMPT_ID = "transcript-eligibility";
export const TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION = 3;

/**
 * Version 2+ is extraction-only: the model reports what the document shows and nothing else.
 * All eligibility judgement (outcome, missing information, next steps) happens downstream in the
 * deterministic rules engine, so the prompt no longer mentions outcomes at all. Version 3 adds
 * unit-level academic result extraction so WAM can be calculated outside the model.
 */
const INSTRUCTIONS =
  "You are extracting evidence from an academic transcript for postgraduate admission processing. " +
  "Extract only what is explicitly evidenced in the document and never invent values. You are NOT " +
  "making any eligibility judgement — only reporting what the document shows; a downstream rules " +
  "engine makes all decisions. Fill every extracted evidence group field, using null when the " +
  "document does not show it. Preserve original values verbatim in originalValue and provide " +
  "normalized values where possible. Set each field's confidence to how certain you are of that " +
  "specific reading, and missingOrAmbiguous to true when the value is absent or unclear. " +
  "For studyDetails.completionStatus.normalizedValue use exactly one of: completed (award " +
  "conferred/completed/graduated), in_progress (currently enrolled or not yet finished), withdrawn " +
  "(withdrawn/discontinued/excluded), or unclear. For studyDetails.highestEducationLevel." +
  "normalizedValue use exactly one of: high_school, diploma, bachelor, honours, masters, doctorate, " +
  "or other. For academic results, populate the numeric fields (wamNumeric for a weighted average " +
  "mark or percentage average, gpaNumeric and gpaScaleNumeric for a GPA and its scale) with plain " +
  "numbers parsed from the document, alongside the corresponding text fields — use null when the " +
  "document shows no such figure and never compute or convert one yourself. Also populate " +
  "academicPerformance.unitResults with every unit, course, subject, or module result row from " +
  "the academic record. For each row, extract the unit code, title, credit points, percentage " +
  "mark, grade, and notes/counting label. Use null for missing marks or credit points. Set " +
  "counted to true when the row is counted toward any course, award, or program shown on the " +
  "transcript, including failed subjects with numeric marks. Set counted to false only when the " +
  "row is explicitly not counted, transferred, exempt, advanced standing, RPL, or credit granted; " +
  "use null when unclear. Do not include grading-key/result-code legend rows. For incomplete " +
  "qualifications, distinguish the terminal study end/status date from an expected completion " +
  "date: use studyEndDate for dates labelled status date, exclusion date, withdrawal/" +
  "discontinuation date, last enrolled date, or the date the incomplete study period ended; use " +
  "expectedCompletionDate only for a future or expressly expected completion date. Put any " +
  "observations about unreadable, ambiguous, or missing parts of the document in extractionNotes " +
  "as short plain sentences.";

const USER_PROMPT =
  "Parse this transcript and return the structured extracted evidence groups (applicant details, " +
  "study details, academic performance, English language evidence), your overall extraction " +
  "confidence, and any extraction notes about unreadable or ambiguous content.";

export const transcriptEligibilityPromptV2 = {
  id: TRANSCRIPT_ELIGIBILITY_PROMPT_ID,
  version: TRANSCRIPT_ELIGIBILITY_PROMPT_VERSION,
  instructions: INSTRUCTIONS,
  userPrompt: USER_PROMPT,
} as const;

export type TranscriptEligibilityPrompt = typeof transcriptEligibilityPromptV2;
