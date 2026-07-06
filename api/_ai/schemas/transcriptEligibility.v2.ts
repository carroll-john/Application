export const TRANSCRIPT_ELIGIBILITY_SCHEMA_ID = "transcript_eligibility_extraction";
export const TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION = 3;

/**
 * Version 2+ is extraction-only. Unlike v1, the model no longer outputs verdict fields
 * (`outcome`, `manualReviewRequired`, `missingInformation`, `recommendedNextStep`) — v1 forced the
 * model to invent a judgement that the deterministic rules engine then overwrote, and the leftover
 * free text leaked into the UI and contradicted the rules result. The model's observations now go
 * to `extractionNotes` (never rendered to applicants), and key fields are constrained to enums or
 * numbers so downstream parsing is exact rather than regex-based. Version 3 adds unit-level result
 * rows so WAM can be calculated deterministically when no aggregate WAM is shown.
 */

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

const completionStatusFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "missingOrAmbiguous", "normalizedValue", "originalValue"],
  properties: {
    confidence: { type: "number" },
    missingOrAmbiguous: { type: "boolean" },
    normalizedValue: {
      type: ["string", "null"],
      enum: ["completed", "in_progress", "withdrawn", "unclear", null],
    },
    originalValue: { type: ["string", "null"] },
  },
} as const;

const educationLevelFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "missingOrAmbiguous", "normalizedValue", "originalValue"],
  properties: {
    confidence: { type: "number" },
    missingOrAmbiguous: { type: "boolean" },
    normalizedValue: {
      type: ["string", "null"],
      enum: [
        "high_school",
        "diploma",
        "bachelor",
        "honours",
        "masters",
        "doctorate",
        "other",
        null,
      ],
    },
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
    "studyEndDate",
  ],
  properties: {
    completionDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
    completionStatus: { anyOf: [completionStatusFieldSchema, { type: "null" }] },
    expectedCompletionDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
    highestEducationLevel: { anyOf: [educationLevelFieldSchema, { type: "null" }] },
    languageOfInstruction: { anyOf: [extractedFieldSchema, { type: "null" }] },
    programName: { anyOf: [extractedFieldSchema, { type: "null" }] },
    startDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
    studyEndDate: { anyOf: [extractedFieldSchema, { type: "null" }] },
  },
} as const;

const academicPerformanceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "creditPointsCompleted",
    "failedSubjects",
    "gpa",
    "gpaNumeric",
    "gpaScale",
    "gpaScaleNumeric",
    "gradeAverageOrWam",
    "gradingNotes",
    "unitResults",
    "wamNumeric",
  ],
  properties: {
    creditPointsCompleted: { anyOf: [extractedFieldSchema, { type: "null" }] },
    failedSubjects: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gpa: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gpaNumeric: { type: ["number", "null"] },
    gpaScale: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gpaScaleNumeric: { type: ["number", "null"] },
    gradeAverageOrWam: { anyOf: [extractedFieldSchema, { type: "null" }] },
    gradingNotes: { anyOf: [extractedFieldSchema, { type: "null" }] },
    unitResults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "counted",
          "creditPoints",
          "grade",
          "mark",
          "notes",
          "title",
          "unitCode",
        ],
        properties: {
          counted: { type: ["boolean", "null"] },
          creditPoints: { type: ["number", "null"] },
          grade: { type: ["string", "null"] },
          mark: { type: ["number", "null"] },
          notes: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          unitCode: { type: ["string", "null"] },
        },
      },
    },
    wamNumeric: { type: ["number", "null"] },
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

export const transcriptEligibilitySchemaV2 = {
  id: TRANSCRIPT_ELIGIBILITY_SCHEMA_ID,
  version: TRANSCRIPT_ELIGIBILITY_SCHEMA_VERSION,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "academicPerformance",
      "applicantDetails",
      "confidence",
      "englishLanguageEvidence",
      "extractionNotes",
      "studyDetails",
    ],
    properties: {
      academicPerformance: academicPerformanceSchema,
      applicantDetails: applicantDetailsSchema,
      confidence: { type: "number" },
      englishLanguageEvidence: englishLanguageEvidenceSchema,
      extractionNotes: {
        type: "array",
        items: { type: "string" },
      },
      studyDetails: studyDetailsSchema,
    },
  },
} as const;

export type TranscriptEligibilitySchema = typeof transcriptEligibilitySchemaV2;
