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
  getUcIndicativeCreditPoints,
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
      "The admissions team will review this experience",
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
      "Given your experience in senior and highly specialised roles, you may be eligible for direct entry. The admissions team will review your responsibilities and confirm eligibility.",
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
      "The guide usually requires at least two years in these roles.",
    );
    expect(getUcExperienceReviewGuidance(meetsGuide)).toContain(
      "This meets the two-year experience guide.",
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
      "Based on your CV, you have 1 other role for the admissions team to consider against the work-experience entry requirements. We also need more detail about 1 role before it can be included in this guidance. The admissions team will review your responsibilities and confirm eligibility.",
    );
  });
});

describe("UC course matching", () => {
  it("ranks every UC course with confidence and indicative credit guidance", () => {
    const experiences = [
      role({ endYear: "2026", level: 1, startYear: "2020" }),
    ];
    const admission = assessUcAdmission(
      experiences,
      new Date("2026-07-01T00:00:00Z"),
    );
    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      draft(experiences),
      admission,
    );

    expect(matches).toHaveLength(33);
    expect(matches[0].category).toBe("best_match");
    expect(matches[0].admissionDetail).toBe(
      "Your work experience may support direct entry to this course. Additional course specific eligibility requirement may still apply.",
    );
    expect(matches[0].admissionDetail).not.toMatch(/equivalent GPA|relevant experience/i);
    expect(matches.every((match) => ["high", "medium", "low"].includes(match.entryConfidence))).toBe(
      true,
    );
    expect(matches.every((match) => ["high", "medium", "low"].includes(match.creditConfidence))).toBe(
      true,
    );
    expect(
      matches.every((match) =>
        match.entryConfidence ===
        (match.category === "best_match"
          ? "high"
          : match.category === "needs_review"
            ? "medium"
            : "low"),
      ),
    ).toBe(true);
    expect(
      matches.every((match) =>
        match.creditConfidence ===
        (match.relevanceScore >= 17
          ? "high"
          : match.relevanceScore > 0
            ? "medium"
            : "low"),
      ),
    ).toBe(true);
    expect(matches.find((match) => match.relevanceScore >= 17)?.creditDetail).toMatch(
      /You may be eligible for up to (6|12|18) credit points\./,
    );
  });

  it("scales indicative credit points with course length", () => {
    const catalogue = getCourseCatalogFor("uc");
    const graduateCertificate = catalogue.find((course) =>
      course.title.startsWith("Graduate Certificate"),
    );
    const graduateDiploma = catalogue.find((course) =>
      course.title.startsWith("Graduate Diploma"),
    );
    const masters = catalogue.find((course) => course.title.startsWith("Master"));

    expect(graduateCertificate && getUcIndicativeCreditPoints(graduateCertificate)).toBe(6);
    expect(graduateDiploma && getUcIndicativeCreditPoints(graduateDiploma)).toBe(12);
    expect(masters && getUcIndicativeCreditPoints(masters)).toBe(12);
  });

  it("uses Bill Shorten's current education role and completed MBA to avoid redundant matches", () => {
    const experiences = [
      {
        ...role({
          endYear: "",
          id: "vice-chancellor",
          level: 1,
          occupation: "Chief Executive Officer",
          startYear: "2025",
        }),
        company: "University of Canberra",
        currentRole: true,
        duties:
          "Leads the university and champions flexible education, student support, employability and stronger connections between education and the community.",
        position: "Vice-Chancellor and President",
      },
      {
        ...role({
          endYear: "2025",
          id: "government-minister",
          level: 1,
          occupation: "Government Minister",
          startYear: "2022",
        }),
        duties:
          "Led government policy and services for the National Disability Insurance Scheme.",
        position: "Minister for Government Services",
      },
    ];
    const recognition = draft(experiences);
    recognition.profile = {
      ...recognition.profile,
      firstName: "Bill",
      lastName: "Shorten",
    };
    recognition.tertiaryQualifications = [
      {
        id: "mba",
        completed: true,
        country: "Australia",
        courseName: "Master of Business Administration (MBA)",
        endMonth: "",
        endYear: "",
        institution: "University of Melbourne",
        level: "Master",
        startMonth: "",
        startYear: "",
      },
    ];
    const admission = assessUcAdmission(
      experiences,
      new Date("2026-07-01T00:00:00Z"),
    );
    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      recognition,
      admission,
    );
    const bestMatches = matches.filter((match) => match.category === "best_match");
    const mba = matches.find(
      (match) => match.course.title === "Master of Business Administration",
    );
    const publicPolicyIndex = matches.findIndex(
      (match) => match.course.title === "Master of Public Policy",
    );
    const educationLeadershipIndex = matches.findIndex(
      (match) => match.course.title === "Master of Education (Leadership)",
    );

    expect(matches.slice(0, 3).map((match) => match.course.title)).toEqual([
      "Master of Education (Leadership)",
      "Master of Education (STEM)",
      "Graduate Certificate in Educational Leadership",
    ]);
    expect(matches.slice(0, 3).map((match) => match.creditConfidence)).toEqual([
      "high",
      "medium",
      "medium",
    ]);
    expect(bestMatches.every((match) => /Education|Teaching/i.test(match.course.title))).toBe(
      true,
    );
    expect(educationLeadershipIndex).toBeLessThan(publicPolicyIndex);
    expect(mba?.category).not.toBe("best_match");
    expect(mba?.relevanceScore).toBe(0);
    expect(mba?.creditConfidence).toBe("low");
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
