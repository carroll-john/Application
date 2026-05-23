export const TRANSCRIPT_ELIGIBILITY_SCHEMA_ID = "transcript_eligibility_assessment";
export const TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION = 1;

const extractedFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "missingOrAmbiguous", "normalizedValue", "originalValue"],
  properties: {
    confidence: { type: "number" },
    missingOrAmbiguous: { type: "boolean" },
    normalizedValue: { type: "string" },
    originalValue: { type: "string" },
  },
} as const;

const extractedGroupSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    completionDate: extractedFieldSchema,
    completionStatus: extractedFieldSchema,
    countryOfInstitution: extractedFieldSchema,
    creditPointsCompleted: extractedFieldSchema,
    englishCountryEvidence: extractedFieldSchema,
    englishInstructionEvidence: extractedFieldSchema,
    englishRequirementSatisfaction: extractedFieldSchema,
    failedSubjects: extractedFieldSchema,
    fullName: extractedFieldSchema,
    gpa: extractedFieldSchema,
    gpaScale: extractedFieldSchema,
    gradeAverageOrWam: extractedFieldSchema,
    gradingNotes: extractedFieldSchema,
    highestEducationLevel: extractedFieldSchema,
    institutionName: extractedFieldSchema,
    languageOfInstruction: extractedFieldSchema,
    programName: extractedFieldSchema,
    startDate: extractedFieldSchema,
    studentId: extractedFieldSchema,
    uncertainty: extractedFieldSchema,
  },
} as const;

export const transcriptEligibilitySchemaV1 = {
  id: TRANSCRIPT_ELIGIBILITY_SCHEMA_ID,
  version: TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "confidence",
      "manualReviewRequired",
      "missingInformation",
      "outcome",
      "recommendedNextStep",
      "requirementsChecked",
    ],
    properties: {
      applicantDetails: extractedGroupSchema,
      academicPerformance: extractedGroupSchema,
      checkedAt: { type: "string" },
      confidence: { type: "number" },
      englishLanguageEvidence: extractedGroupSchema,
      manualReviewRequired: { type: "boolean" },
      missingInformation: {
        type: "array",
        items: { type: "string" },
      },
      outcome: {
        type: "string",
        enum: [
          "eligible",
          "conditionally_eligible",
          "ineligible",
          "insufficient_data",
        ],
      },
      programCode: { type: "string" },
      programTitle: { type: "string" },
      recommendedNextStep: { type: "string" },
      requirementsChecked: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["explanation", "id", "requirement", "status"],
          properties: {
            explanation: { type: "string" },
            id: { type: "string" },
            requirement: { type: "string" },
            status: {
              type: "string",
              enum: ["pass", "fail", "unknown"],
            },
          },
        },
      },
      rulesVersion: { type: "string" },
      serviceVersion: { type: "string" },
      studyDetails: extractedGroupSchema,
    },
  },
} as const;

export type TranscriptEligibilitySchema = typeof transcriptEligibilitySchemaV1;

