import { describe, expect, it } from "vitest";
import { initialApplicationData, mergeStoredApplicationData } from "./applicationData";
import { getCourseCatalogFor } from "./courseCatalog";
import {
  applyUcCvPrefill,
  assessUcAdmission,
  rankUcCourses,
  type CvRecognitionDraft,
  type CvRecognitionExperience,
  type OscaSkillLevel,
} from "./ucRplAssessment";

function role({
  endMonth = "January",
  endYear,
  id = crypto.randomUUID(),
  level,
  occupation = "ICT Project Manager",
  startMonth = "January",
  startYear,
}: {
  endMonth?: string;
  endYear: string;
  id?: string;
  level: OscaSkillLevel;
  occupation?: string;
  startMonth?: string;
  startYear: string;
}): CvRecognitionExperience {
  return {
    id,
    company: "Example organisation",
    currentRole: false,
    duties: "Led technology delivery, project governance and stakeholder management.",
    endMonth,
    endYear,
    includeInAssessment: true,
    oscaConfidence: "high",
    oscaOccupationCode: "271131",
    oscaOccupationTitle: occupation,
    oscaRationale: "Project leadership duties align with this occupation.",
    oscaSkillLevel: level,
    position: occupation,
    startMonth,
    startYear,
    type: "Full-time",
  };
}

function draft(experiences: CvRecognitionExperience[]): CvRecognitionDraft {
  return {
    experiences,
    professionalAccreditations: [],
    profile: {
      firstName: "Alex",
      lastName: "Jordan",
      middleName: "",
      phone: "0400 000 000",
      title: "Dr",
    },
    secondaryQualifications: [],
    tertiaryQualifications: [],
  };
}

describe("UC OSCA admission prototype matrix", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it.each([
    [1, "2025", "2026", 4],
    [1, "2023", "2026", 5],
    [2, "2024", "2026", 4],
    [2, "2021", "2026", 5],
  ] as const)(
    "maps Skill Level %s experience from %s to %s to GPA %s",
    (level, startYear, endYear, equivalentGpa) => {
      const result = assessUcAdmission(
        [role({ endYear, level, startYear })],
        now,
      );
      expect(result.equivalentGpa).toBe(equivalentGpa);
      expect(result.status).toBe("may_meet");
    },
  );

  it("keeps Skill Level 2 below two years on the faculty review path", () => {
    const result = assessUcAdmission(
      [role({ endYear: "2026", level: 2, startYear: "2025" })],
      now,
    );
    expect(result.equivalentGpa).toBeNull();
    expect(result.status).toBe("faculty_review");
  });

  it("does not double-count overlapping roles in the same occupation", () => {
    const result = assessUcAdmission(
      [
        role({ endYear: "2026", level: 1, startYear: "2024" }),
        role({ endYear: "2026", id: "second", level: 1, startYear: "2025" }),
      ],
      now,
    );
    expect(result.experienceMonths).toBe(24);
    expect(result.equivalentGpa).toBe(4);
  });
});

describe("UC course matching", () => {
  it("ranks every one of the 33 UC courses and keeps credit qualitative", () => {
    const experiences = [
      role({ endYear: "2026", level: 1, startYear: "2020" }),
    ];
    const admission = assessUcAdmission(
      experiences,
      new Date("2026-07-01T00:00:00Z"),
    );
    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      experiences,
      admission,
    );

    expect(matches).toHaveLength(33);
    expect(matches[0].category).toBe("best_match");
    expect(matches.every((match) => !/\b\d+\s*(credit|unit)/i.test(match.creditDetail))).toBe(
      true,
    );
  });
});

describe("UC CV application prefill", () => {
  it("fills blank safe fields and qualifications", () => {
    const recognition = draft([
      role({ endYear: "2026", level: 1, startYear: "2020" }),
    ]);
    recognition.tertiaryQualifications = [
      {
        id: "qualification",
        completed: true,
        country: "Australia",
        courseName: "Bachelor of Information Technology",
        endMonth: "November",
        endYear: "2019",
        institution: "Example University",
        level: "Bachelor",
        startMonth: "February",
        startYear: "2017",
      },
    ];

    const result = applyUcCvPrefill(
      initialApplicationData,
      recognition,
      "alex@example.com",
    );

    expect(result.personalDetails).toMatchObject({
      email: "alex@example.com",
      firstName: "Alex",
      lastName: "Jordan",
      phone: "0400 000 000",
      title: "Dr",
    });
    expect(result.employmentExperiences).toHaveLength(1);
    expect(result.tertiaryQualifications).toHaveLength(1);
  });

  it("never overwrites saved fields or existing qualification collections", () => {
    const existing = mergeStoredApplicationData({
      personalDetails: {
        ...initialApplicationData.personalDetails,
        email: "saved@example.com",
        firstName: "Saved",
        phone: "0411 111 111",
      },
      employmentExperiences: [
        {
          id: "saved-role",
          company: "Saved company",
          currentRole: true,
          duties: "Saved duties",
          endMonth: "",
          endYear: "",
          position: "Saved role",
          startMonth: "January",
          startYear: "2024",
          type: "Full-time",
        },
      ],
    });
    const result = applyUcCvPrefill(
      existing,
      draft([role({ endYear: "2026", level: 1, startYear: "2020" })]),
      "auth@example.com",
    );

    expect(result.personalDetails.email).toBe("saved@example.com");
    expect(result.personalDetails.firstName).toBe("Saved");
    expect(result.personalDetails.phone).toBe("0411 111 111");
    expect(result.employmentExperiences[0].id).toBe("saved-role");
  });
});
