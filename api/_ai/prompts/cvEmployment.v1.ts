export const CV_EMPLOYMENT_PROMPT_ID = "cv-employment";
export const CV_EMPLOYMENT_PROMPT_VERSION = 1;

const INSTRUCTIONS =
  "Extract structured employment history from the CV or resume content provided by the user. Return only actual employment roles that are evidenced in the document. Never merge multiple job titles into one row. If a person was promoted at the same company, output one experience item per distinct title with that title's own start and end dates, and repeat the company name for each role. Use the exact employment type labels Full-time, Part-time, Contract, Casual, Internship, or an empty string when unclear. Use full month names and four-digit years where possible. If a role is current, set currentRole to true and leave endMonth and endYear empty. Summarize duties in plain sentences without bullet characters. Before returning, verify each experience row has only one role title.";

const USER_PROMPT =
  "Parse this CV and extract employment experience so the application form can be auto-filled. Return the most recent roles first.";

export const cvEmploymentPromptV1 = {
  id: CV_EMPLOYMENT_PROMPT_ID,
  version: CV_EMPLOYMENT_PROMPT_VERSION,
  instructions: INSTRUCTIONS,
  userPrompt: USER_PROMPT,
} as const;

export type CvEmploymentPrompt = typeof cvEmploymentPromptV1;
