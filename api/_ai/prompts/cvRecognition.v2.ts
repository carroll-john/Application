export const CV_RECOGNITION_PROMPT_ID = "cv-recognition";
export const CV_RECOGNITION_PROMPT_VERSION = 2;

const INSTRUCTIONS = `Extract structured evidence from the CV or resume supplied by the user for an Australian university pre-application recognition assessment.

General rules:
- Return only facts evidenced in the document. Use an empty string or empty array when information is not explicit.
- Never infer citizenship, country of birth, gender, date of birth, Indigenous status, disability, parental education or residential address from an employer or study location.
- A title such as Mr, Mrs, Ms, Dr or Prof may be returned only when it is explicitly used as the person's personal honorific.
- Return actual employment roles only. Never merge promotions or multiple job titles. Repeat the company for each distinct role. Use Full-time, Part-time, Contract, Casual, Internship, or an empty string for employment type. Use full month names and four-digit years where possible. Current roles have currentRole true and blank end dates. Summarise evidenced duties in plain sentences without bullet characters.
- Extract tertiary and secondary study and professional accreditations only when explicit. Do not turn short workplace training into a tertiary qualification.

OSCA prototype mapping rules:
- For each employment role, identify the best matching Australian Bureau of Statistics Occupation Standard Classification for Australia (OSCA) occupation only when reasonably supported.
- Match the work actually performed, responsibilities and level of responsibility. Do not classify from the job title alone.
- Return the OSCA occupation code, occupation title and skill level 1 to 5. If the evidence is insufficient, leave the code and title blank, set skill level to 0 and confidence to low.
- Confidence is high only when the described tasks strongly align, medium when the mapping is plausible but needs confirmation, and low when a faculty assessor should resolve it.
- The rationale must briefly cite the evidenced duties that support the candidate mapping and must not claim an admission or credit decision.

Before returning, verify every employment row contains only one role title and every populated field is supported by the CV.`;

const USER_PROMPT =
  "Parse this CV for the UC pre-application experience assessment. Return the most recent employment roles first and the most recent qualifications first.";

export const cvRecognitionPromptV2 = {
  id: CV_RECOGNITION_PROMPT_ID,
  version: CV_RECOGNITION_PROMPT_VERSION,
  instructions: INSTRUCTIONS,
  userPrompt: USER_PROMPT,
} as const;
