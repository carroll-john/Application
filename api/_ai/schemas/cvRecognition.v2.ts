const dateFields = {
  endMonth: { type: "string" },
  endYear: { type: "string" },
  startMonth: { type: "string" },
  startYear: { type: "string" },
} as const;

export const cvRecognitionSchemaV2 = {
  id: "cv_recognition_parse",
  version: 2,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "applicant",
      "experiences",
      "professionalAccreditations",
      "secondaryQualifications",
      "tertiaryQualifications",
    ],
    properties: {
      applicant: {
        type: "object",
        additionalProperties: false,
        required: ["firstName", "lastName", "middleName", "phone", "title"],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          middleName: { type: "string" },
          phone: { type: "string" },
          title: { type: "string" },
        },
      },
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
            "oscaConfidence",
            "oscaOccupationCode",
            "oscaOccupationTitle",
            "oscaRationale",
            "oscaSkillLevel",
            "position",
            "startMonth",
            "startYear",
            "type",
          ],
          properties: {
            company: { type: "string" },
            currentRole: { type: "boolean" },
            duties: { type: "string" },
            ...dateFields,
            oscaConfidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            oscaOccupationCode: { type: "string" },
            oscaOccupationTitle: { type: "string" },
            oscaRationale: { type: "string" },
            oscaSkillLevel: { type: "integer", minimum: 0, maximum: 5 },
            position: { type: "string" },
            type: { type: "string" },
          },
        },
      },
      professionalAccreditations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "status"],
          properties: {
            name: { type: "string" },
            status: { type: "string" },
          },
        },
      },
      secondaryQualifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["country", "qualification", "school", "state", "type", "year"],
          properties: {
            country: { type: "string" },
            qualification: { type: "string" },
            school: { type: "string" },
            state: { type: "string" },
            type: { type: "string" },
            year: { type: "string" },
          },
        },
      },
      tertiaryQualifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "completed",
            "country",
            "courseName",
            "endMonth",
            "endYear",
            "institution",
            "level",
            "startMonth",
            "startYear",
          ],
          properties: {
            completed: { type: "boolean" },
            country: { type: "string" },
            courseName: { type: "string" },
            ...dateFields,
            institution: { type: "string" },
            level: { type: "string" },
          },
        },
      },
    },
  },
} as const;
