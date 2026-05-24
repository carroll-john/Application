export const TRANSCRIPT_ELIGIBILITY_SCHEMA_ID = "transcript_eligibility_assessment";
export const TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION = 1;

const extractedFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "missingOrAmbiguous", "normalizedValue", "originalValue"],
  properties: {
    confidence: { type: "number" },
    missingOrAmbiguous: { type: "boolean" },
    normalizedValue: { type: ["string", "null"] },
    originalValue: { type: ["string", "null"] },
  },
} as const;

const applicantDetailsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["countryOfInstitution", "fullName", "institutionName", "studentId"],
  properties: {
    countryOfInstitution: { anyOf: [extractedFieldSchema, { type: "null" }] },
    fullName: { anyOf: [extractedFieldSchema, { type: "null" }] },
    institutionName: { anyOf: [extractedFieldSchema, { type: "null" }] },
    studentId: { anyOf: [extractedFieldSchema, { type: "null" }] },
  },
} as const;

const studyDetailsSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "completionDate",
    "completionStatus",
    "expectedCompletionDate",
    "highestEducationLevel",
    "languageOfInstruction",
    "programName",
    "startDate",
  ],
  properties: {
    completionDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
    completionStatus: { anyOf: [extractedFieldSchema, { type: "null" }] },
    expectedCompletionDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
    highestEducationLevel: { anyOf: [extractedFieldSchema, { type: "null" }] },
    languageOfInstruction: { anyOf: [extractedFieldSchema, { type: "null" }] },
    programName: { anyOf: [extractedFieldSchema, { type: "null" }] },
    startDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
  },
} as const;

const academicPerformanceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "creditPointsCompleted",
    "failedSubjects",
    "gpa",
    "gpaScale",
    "gradeAverageOrWam",
    "gradingNotes",
  ],
  properties: {
    creditPointsCompleted: { anyOf: [extractedFieldSchema, { type: "null" }] },
    failedSubjects: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gpa: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gpaScale: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gradeAverageOrWam: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gradingNotes: { anyOf: [extractedFieldSchema, { type: "null" }] },
  },
} as const;

const englishLanguageEvidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "englishCountryEvidence",
    "englishInstructionEvidence",
    "englishRequirementSatisfaction",
    "uncertainty",
  ],
  properties: {
    englishCountryEvidence: { anyOf: [extractedFieldSchema, { type: "null" }] },
    englishInstructionEvidence: { anyOf: [extractedFieldSchema, { type: "null" }] },
    englishRequirementSatisfaction: { anyOf: [extractedFieldSchema, { type: "null" }] },
    uncertainty: { anyOf: [extractedFieldSchema, { type: "null" }] },
  },
} as const;

export const transcriptEligibilitySchemaV1 = {
  id: TRANSCRIPT_ELIGIBILITY_SCHEMA_ID,
  version: TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "academicPerformance",
      "applicantDetails",
      "checkedAt",
      "confidence",
      "englishLanguageEvidence",
      "manualReviewRequired",
      "missingInformation",
      "outcome",
      "programCode",
      "programTitle",
      "recommendedNextStep",
      "rulesVersion",
      "serviceVersion",
      "studyDetails",
    ],
    properties: {
      applicantDetails: applicantDetailsSchema,
      academicPerformance: academicPerformanceSchema,
      checkedAt: { type: "string" },
      confidence: { type: "number" },
      englishLanguageEvidence: englishLanguageEvidenceSchema,
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
      programCode: { type: ["string", "null"] },
      programTitle: { type: ["string", "null"] },
      recommendedNextStep: { type: "string" },
      rulesVersion: { type: ["string", "null"] },
      serviceVersion: { type: ["string", "null"] },
      studyDetails: studyDetailsSchema,
    },
  },
} as const;

export type TranscriptEligibilitySchema = typeof transcriptEligibilitySchemaV1;

