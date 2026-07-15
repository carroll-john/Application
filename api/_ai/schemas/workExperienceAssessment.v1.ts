export const WORK_EXPERIENCE_ASSESSMENT_SCHEMA_ID = "work_experience_assessment";
export const WORK_EXPERIENCE_ASSESSMENT_SCHEMA_VERSION = 1;

export const workExperienceAssessmentSchemaV1 = {
  id: WORK_EXPERIENCE_ASSESSMENT_SCHEMA_ID,
  version: WORK_EXPERIENCE_ASSESSMENT_SCHEMA_VERSION,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["assessments"],
    properties: {
      assessments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["requirementId", "roleClassifications", "unassessedConditions"],
          properties: {
            requirementId: { type: "string" },
            unassessedConditions: { type: "array", items: { type: "string" } },
            roleClassifications: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "employmentExperienceId",
                  "relevanceStatus",
                  "roleCriteriaStatus",
                  "confidence",
                  "explanation",
                  "evidencePhrases",
                ],
                properties: {
                  employmentExperienceId: { type: "string" },
                  relevanceStatus: {
                    type: "string",
                    enum: ["relevant", "possibly_relevant", "not_demonstrated"],
                  },
                  roleCriteriaStatus: {
                    type: "string",
                    enum: ["met", "possibly_met", "not_demonstrated", "not_required"],
                  },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  explanation: { type: "string" },
                  evidencePhrases: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

