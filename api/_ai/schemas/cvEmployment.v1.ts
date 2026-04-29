export const CV_EMPLOYMENT_SCHEMA_ID = "cv_employment_parse";
export const CV_EMPLOYMENT_SCHEMA_VERSION = 1;

export const cvEmploymentSchemaV1 = {
  id: CV_EMPLOYMENT_SCHEMA_ID,
  version: CV_EMPLOYMENT_SCHEMA_VERSION,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["experiences"],
    properties: {
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "company",
            "currentRole",
            "duties",
            "endMonth",
            "endYear",
            "position",
            "startMonth",
            "startYear",
            "type",
          ],
          properties: {
            company: { type: "string" },
            currentRole: { type: "boolean" },
            duties: { type: "string" },
            endMonth: { type: "string" },
            endYear: { type: "string" },
            position: { type: "string" },
            startMonth: { type: "string" },
            startYear: { type: "string" },
            type: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export type CvEmploymentSchema = typeof cvEmploymentSchemaV1;
