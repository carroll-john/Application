import { describe, expect, it } from "vitest";
import { initialApplicationData, mergeStoredApplicationData } from "./applicationData";
import { getCourseCatalogFor } from "./courseCatalog";
import {
  applyUcCvPrefill,
  assessUcAdmission,
  formatUcExperienceDuration,
  getUcCourseMatchExperienceSummary,
  getUcExperienceGroupLabel,
  getUcExperienceReviewGuidance,
  getUcWorkEntryGuidance,
  rankUcCourses,
  summarizeUcExperienceByOscaLevel,
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

describe("UC OSCA experience review summaries", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it("groups roles by skill level in level order and keeps unclassified roles visible", () => {
    const summaries = summarizeUcExperienceByOscaLevel(
      [
        role({ endYear: "2026", id: "level-2", level: 2, startYear: "2024" }),
        {
          ...role({ endYear: "2026", id: "unclassified", level: 1, startYear: "2025" }),
          oscaSkillLevel: null,
        },
        role({ endYear: "2026", id: "level-1", level: 1, startYear: "2023" }),
      ],
      now,
    );

    expect(summaries.map((summary) => summary.key)).toEqual([
      "level-1",
      "level-2",
      "needs-review",
    ]);
    expect(summaries[0].roles.map((item) => item.id)).toEqual(["level-1"]);
    expect(summaries[2].roles.map((item) => item.id)).toEqual(["unclassified"]);
  });

  it("rolls up overlapping included roles without double-counting them", () => {
    const summaries = summarizeUcExperienceByOscaLevel(
      [
        role({ endYear: "2026", id: "first", level: 1, startYear: "2023" }),
        role({ endYear: "2026", id: "overlap", level: 1, startYear: "2024" }),
        {
          ...role({ endYear: "2026", id: "excluded", level: 1, startYear: "2010" }),
          includeInAssessment: false,
        },
      ],
      now,
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      experienceMonths: 36,
      experienceYears: 3,
      includedRoleCount: 2,
    });
    expect(summaries[0].roles).toHaveLength(3);
  });

  it("uses the reviewed experience-group duration on course matches", () => {
    const experiences = [
      role({
        endYear: "2024",
        id: "chief-executive",
        level: 1,
        occupation: "Chief Executive Officer",
        startYear: "2021",
      }),
      {
        ...role({
          endYear: "2026",
          id: "government-minister",
          level: 1,
          occupation: "Government Minister",
          startYear: "2024",
        }),
        oscaOccupationCode: "121332",
      },
    ];
    const admission = assessUcAdmission(experiences, now);
    const summaries = summarizeUcExperienceByOscaLevel(experiences, now);
    const displayedSummary = getUcCourseMatchExperienceSummary(
      summaries,
      admission.skillLevel,
    );

    expect(admission.experienceMonths).toBe(36);
    expect(displayedSummary?.experienceMonths).toBe(60);
    expect(displayedSummary?.experienceMonths).toBe(
      summaries[0].experienceMonths,
    );
  });

  it("formats duration and presents applicant-friendly UC experience guidance", () => {
    expect(formatUcExperienceDuration(1)).toBe("1 month experience");
    expect(formatUcExperienceDuration(12)).toBe("1 year experience");
    expect(formatUcExperienceDuration(205)).toBe("17.1 years experience");
    expect(formatUcExperienceDuration(0)).toBe("Duration needs review");

    expect(getUcExperienceGroupLabel(1)).toBe("Senior or highly specialised roles");
    expect(getUcExperienceGroupLabel(2)).toBe("Technical or supervisory roles");
    expect(getUcExperienceGroupLabel(null)).toBe("Roles needing more information");

    expect(getUcWorkEntryGuidance(1, 0)).toBe("May be eligible for direct entry");
    expect(getUcWorkEntryGuidance(2, 23)).toBe("More experience may be needed");
    expect(getUcWorkEntryGuidance(2, 24)).toBe("May be eligible for direct entry");
    expect(getUcWorkEntryGuidance(4, 120)).toBe(
      "UC will review this experience",
    );
    expect(getUcWorkEntryGuidance(null, 120)).toBe("More details needed");
  });

  it("tailors the review guidance to senior experience found in the CV", () => {
    const summaries = summarizeUcExperienceByOscaLevel(
      [
        role({ endYear: "2026", id: "senior-one", level: 1, startYear: "2023" }),
        role({ endYear: "2026", id: "senior-two", level: 1, startYear: "2024" }),
      ],
      now,
    );

    expect(getUcExperienceReviewGuidance(summaries)).toBe(
      "Given your experience in senior and highly specialised roles, you may be eligible for direct entry. UC Admissions will review your responsibilities and confirm eligibility.",
    );
  });

  it("states whether technical experience meets the two-year guide", () => {
    const belowGuide = summarizeUcExperienceByOscaLevel(
      [role({ endYear: "2026", level: 2, startYear: "2025" })],
      now,
    );
    const meetsGuide = summarizeUcExperienceByOscaLevel(
      [role({ endYear: "2026", level: 2, startYear: "2024" })],
      now,
    );

    expect(getUcExperienceReviewGuidance(belowGuide)).toContain(
      "UC’s guide usually requires at least two years in these roles.",
    );
    expect(getUcExperienceReviewGuidance(meetsGuide)).toContain(
      "This meets UC’s two-year experience guide.",
    );
  });

  it("calls out other and unclassified roles that need Admissions review", () => {
    const unclassified = {
      ...role({ endYear: "2026", id: "unclassified", level: 1, startYear: "2025" }),
      oscaSkillLevel: null,
    };
    const summaries = summarizeUcExperienceByOscaLevel(
      [role({ endYear: "2026", level: 3, startYear: "2020" }), unclassified],
      now,
    );

    expect(getUcExperienceReviewGuidance(summaries)).toBe(
      "Based on your CV, you have 1 other role for UC Admissions to consider against the work-experience entry requirements. We also need more detail about 1 role before it can be included in this guidance. UC Admissions will review your responsibilities and confirm eligibility.",
    );
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
    expect(matches[0].admissionDetail).toBe(
      "Your work experience may support direct entry to this course. UC Admissions will confirm your eligibility and any course-specific requirements.",
    );
    expect(matches[0].rationale).toBe(
      "Matched using the occupation and experience details you reviewed. Other course requirements may still apply.",
    );
    expect(matches[0].admissionDetail).not.toMatch(/equivalent GPA|relevant experience/i);
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
