import { describe, expect, it } from "vitest";
import { documentParserRegistry, getDocumentParserConfig } from "./documentParserRegistry";

describe("documentParserRegistry", () => {
  it("registers the cv kind", () => {
    expect(getDocumentParserConfig("cv")).toBe(documentParserRegistry.cv);
    expect(documentParserRegistry.cv.apiPath).toBe("/api/parse-cv");
  });

  it("normalizes cv parser payloads into employment experiences", () => {
    const draft = documentParserRegistry.cv.normalizeResponse({
      experiences: [
        {
          company: "Acme",
          position: "Engineer",
          duties: "Built things",
          startMonth: "January",
          startYear: "2020",
        },
      ],
      model: "gpt-4.1-mini",
    });

    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0]).toMatchObject({
      company: "Acme",
      position: "Engineer",
    });
    expect(draft.model).toBe("gpt-4.1-mini");
  });

  it("normalizes UC recognition evidence alongside the existing employment draft", () => {
    const draft = documentParserRegistry.cv.normalizeResponse({
      applicant: {
        firstName: " Alex ",
        lastName: " Jordan ",
        middleName: "",
        phone: " 0400 000 000 ",
        title: "Dr",
      },
      experiences: [
        {
          company: "Example Agency",
          currentRole: true,
          duties: "Led technology delivery",
          endMonth: "",
          endYear: "",
          oscaConfidence: "high",
          oscaOccupationCode: "271131",
          oscaOccupationTitle: "ICT Project Manager",
          oscaRationale: "Duties align",
          oscaSkillLevel: 1,
          position: "Program Manager",
          startMonth: "01",
          startYear: "2020",
          type: "full time",
        },
      ],
      professionalAccreditations: [
        { name: "PRINCE2 Practitioner", status: "Current" },
      ],
      secondaryQualifications: [],
      tertiaryQualifications: [
        {
          completed: true,
          country: "Australia",
          courseName: "Bachelor of Information Technology",
          endMonth: "11",
          endYear: "2019",
          institution: "Example University",
          level: "Bachelor degree",
          startMonth: "02",
          startYear: "2017",
        },
      ],
    });

    expect(draft.profile).toMatchObject({
      firstName: "Alex",
      lastName: "Jordan",
      phone: "0400 000 000",
      title: "Dr",
    });
    expect(draft.experiences[0]).toMatchObject({
      oscaConfidence: "high",
      oscaOccupationCode: "271131",
      oscaOccupationTitle: "ICT Project Manager",
      oscaSkillLevel: 1,
      startMonth: "January",
      type: "Full-time",
    });
    expect(draft.tertiaryQualifications[0]).toMatchObject({
      endMonth: "November",
      level: "Bachelor",
      startMonth: "February",
    });
    expect(draft.professionalAccreditations[0].name).toBe(
      "PRINCE2 Practitioner",
    );
  });
});
