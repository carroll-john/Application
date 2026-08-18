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
  getUcExperienceReviewSummary,
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

describe("UC OSCA skilled-work guidance", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it.each([
    [1, "2025", "2026"],
    [1, "2023", "2026"],
    [2, "2024", "2026"],
    [2, "2021", "2026"],
  ] as const)(
    "recognises Skill Level %s experience from %s to %s",
    (level, startYear, endYear) => {
      const result = assessUcAdmission(
        [role({ endYear, level, startYear })],
        now,
      );
      expect(result.status).toBe("may_meet");
      expect(result.rationale).not.toMatch(/GPA|prototype matrix/i);
    },
  );

  it("keeps Skill Level 2 below two years on the review path", () => {
    const result = assessUcAdmission(
      [role({ endYear: "2026", level: 2, startYear: "2025" })],
      now,
    );
    expect(result.status).toBe("needs_review");
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
    expect(result.status).toBe("may_meet");
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

    expect(getUcWorkEntryGuidance(1, 0)).toBe("More experience may be needed");
    expect(getUcWorkEntryGuidance(2, 23)).toBe("More experience may be needed");
    expect(getUcWorkEntryGuidance(2, 24)).toBe("May be eligible for direct entry");
    expect(getUcWorkEntryGuidance(4, 120)).toBe(
      "UC will review this experience",
    );
    expect(getUcWorkEntryGuidance(null, 120)).toBe("More details needed");

  });

  it("turns the experience assessment into a scannable review summary", () => {
    const summaries = summarizeUcExperienceByOscaLevel(
      [
        role({ endYear: "2026", id: "senior", level: 1, startYear: "2023" }),
        role({ endYear: "2026", id: "technical", level: 2, startYear: "2024" }),
        role({ endYear: "2026", id: "operational", level: 4, startYear: "2025" }),
      ],
      now,
    );

    const summary = getUcExperienceReviewSummary(summaries);

    expect(summary.headline).toBe("Your experience may support direct entry");
    expect(summary.points).toHaveLength(3);
    expect(summary.points[0]).toContain("work-experience pathway");
    expect(summary.points[1]).toContain("meets UC’s two-year experience guide");
    expect(summary.points[2]).toBe(
      "1 other role will be considered by UC Admissions alongside the course requirements.",
    );
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
  it("ranks every UC course while keeping entry and credit decisions separate", () => {
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
    const firstBestMatch = matches.find(
      (match) => match.category === "best_match",
    );

    expect(matches).toHaveLength(33);
    expect(firstBestMatch?.admissionDetail).toMatch(/entry to this course/i);
    expect(firstBestMatch?.admissionDetail).not.toMatch(/equivalent GPA/i);
    expect(matches.map((match) => match.admissionDetail).join(" ")).not.toMatch(
      /OSCA|Skill Level/i,
    );
    expect(matches.every((match) => ["high", "medium", "low"].includes(match.entryConfidence))).toBe(
      true,
    );
    expect(matches.every((match) => ["high", "medium", "low"].includes(match.creditConfidence))).toBe(
      true,
    );
    expect(
      matches.every((match) =>
        match.entryConfidence ===
        (match.entryStatus === "may_meet"
          ? "high"
          : match.entryStatus === "needs_review"
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
    expect(
      matches.every((match) =>
        match.creditDetail.includes("Credit is assessed separately from admission"),
      ),
    ).toBe(true);
    expect(matches.map((match) => match.creditDetail).join(" ")).not.toMatch(
      /up to (6|12|18) credit points/i,
    );
  });

  it("does not recommend a completed qualification as a redundant course match", () => {
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
      firstName: "Alex",
      lastName: "Jordan",
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
    expect(matches[0].course.title).toBe("Master of Education (Leadership)");
    expect(bestMatches.every((match) => match.entryStatus === "may_meet")).toBe(
      true,
    );
    expect(mba?.category).not.toBe("best_match");
    expect(mba?.relevanceScore).toBe(0);
    expect(mba?.creditConfidence).toBe("low");
    expect(
      matches.find(
        (match) => match.course.title === "Master of Education (Leadership)",
      ),
    ).toMatchObject({
      category: "needs_review",
      entryStatus: "needs_review",
    });
  });

  it("only recommends courses where Maya demonstrates a published work-entry route", () => {
    const experiences = [
      {
        ...role({
          endYear: "",
          id: "learning-development-lead",
          level: 1,
          occupation: "Training and Development Professional",
          startYear: "2023",
        }),
        company: "BrightPath Learning",
        currentRole: true,
        duties:
          "Leads workplace education and learning strategy, manages capability programs, evaluates learner outcomes and develops team leaders.",
        oscaOccupationCode: "222431",
        position: "Learning and Development Lead",
      },
      {
        ...role({
          endYear: "2022",
          id: "project-coordinator",
          level: 2,
          occupation: "Program or Project Administrator",
          startYear: "2020",
        }),
        company: "CivicConnect Services",
        duties:
          "Coordinated a digital learning project, milestones, communications, records and stakeholder reporting.",
        oscaOccupationCode: "511231",
        position: "Project Coordinator",
      },
      {
        ...role({
          endYear: "2019",
          id: "customer-support-adviser",
          level: 4,
          occupation: "Call or Contact Centre Operator",
          startYear: "2018",
        }),
        company: "CivicConnect Services",
        duties:
          "Answered customer enquiries, provided guided support, maintained records and escalated complex cases.",
        oscaOccupationCode: "551131",
        position: "Customer Support Adviser",
      },
    ];
    const recognition = draft(experiences);
    recognition.profile = {
      ...recognition.profile,
      firstName: "Maya",
      lastName: "Patel",
    };
    recognition.tertiaryQualifications = [];

    const admission = assessUcAdmission(
      experiences,
      new Date("2026-08-01T00:00:00Z"),
    );
    const summaries = summarizeUcExperienceByOscaLevel(
      experiences,
      new Date("2026-08-01T00:00:00Z"),
    );
    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      recognition,
      admission,
      new Date("2026-08-01T00:00:00Z"),
    );
    const educationLeadership = matches.find(
      (match) => match.course.title === "Master of Education (Leadership)",
    );
    const mba = matches.find(
      (match) => match.course.title === "Master of Business Administration",
    );
    const governmentBusiness = matches.find(
      (match) =>
        match.course.title ===
        "Graduate Certificate in Business Administration (Government)",
    );
    const bestMatchTitles = matches
      .filter((match) => match.category === "best_match")
      .map((match) => match.course.title);
    const unsupportedSpecialistTitles = [
      "Graduate Certificate in STEM Education",
      "Master of Education (STEM)",
      "Master of Teaching (Primary or Secondary)",
      "Teaching English as a Second Language (TESOL)",
    ];

    expect(admission).toMatchObject({
      occupationCode: "222431",
      skillLevel: 1,
      status: "may_meet",
    });
    expect(summaries.map((summary) => summary.key)).toEqual([
      "level-1",
      "level-2",
      "level-4",
    ]);
    expect(bestMatchTitles).toEqual([
      "Master of Business Administration",
      "Graduate Certificate in Business",
      "Graduate Certificate in Digital Marketing",
    ]);
    expect(bestMatchTitles).not.toContain(
      "Graduate Certificate in Business Administration (Government)",
    );
    expect(
      matches
        .filter((match) => match.category === "best_match")
        .every((match) => match.entryStatus === "may_meet"),
    ).toBe(true);
    expect(governmentBusiness).toMatchObject({
      category: "needs_review",
      entryStatus: "not_demonstrated",
    });
    expect(educationLeadership).toMatchObject({
      category: "needs_review",
      creditConfidence: "high",
      entryConfidence: "medium",
    });
    expect(educationLeadership?.admissionDetail).toContain(
      "does not yet show enough evidence",
    );
    expect(mba).toMatchObject({
      category: "best_match",
      entryConfidence: "high",
      entryPathway: "skilled_work",
      entryStatus: "may_meet",
    });
    expect(
      matches
        .filter((match) => unsupportedSpecialistTitles.includes(match.course.title))
        .map((match) => ({
          category: match.category,
          relevanceScore: match.relevanceScore,
          title: match.course.title,
        })),
    ).toEqual(
      expect.arrayContaining(
        unsupportedSpecialistTitles.map((title) => ({
          category: "needs_review",
          relevanceScore: 0,
          title,
        })),
      ),
    );
  });

  it("does not treat an incomplete bachelor degree as a completed entry qualification", () => {
    const experiences = [
      {
        ...role({
          endYear: "",
          id: "learning-development-lead",
          level: 1,
          occupation: "Training and Development Professional",
          startYear: "2023",
        }),
        currentRole: true,
        duties:
          "Leads workplace education and learning strategy, manages capability programs and develops team leaders.",
        endMonth: "",
        oscaOccupationCode: "222431",
        position: "Learning and Development Lead",
      },
    ];
    const recognition = draft(experiences);
    recognition.tertiaryQualifications = [
      {
        id: "incomplete-bachelor",
        completed: false,
        country: "Australia",
        courseName: "Bachelor of Business",
        endMonth: "November",
        endYear: "2025",
        institution: "Example University",
        level: "Bachelor",
        startMonth: "February",
        startYear: "2022",
      },
    ];

    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      recognition,
      assessUcAdmission(experiences, new Date("2026-08-01T00:00:00Z")),
      new Date("2026-08-01T00:00:00Z"),
    );

    expect(
      matches.find(
        (match) => match.course.title === "Master of Business Administration",
      ),
    ).toMatchObject({
      entryPathway: "skilled_work",
      entryStatus: "may_meet",
    });
    expect(
      matches.find(
        (match) => match.course.title === "Master of Education (Leadership)",
      ),
    ).toMatchObject({
      category: "needs_review",
      entryStatus: "needs_review",
    });
  });

  it("keeps STEM education courses relevant when the CV contains direct STEM evidence", () => {
    const experiences = [
      {
        ...role({
          endYear: "",
          id: "stem-learning-lead",
          level: 1,
          occupation: "Education Adviser",
          startYear: "2023",
        }),
        currentRole: true,
        duties:
          "Leads STEM education programs and designs science, engineering and mathematics curriculum for teachers.",
        endMonth: "",
        oscaOccupationCode: "222499",
        position: "STEM Learning Lead",
      },
    ];
    const recognition = draft(experiences);
    const matches = rankUcCourses(
      getCourseCatalogFor("uc"),
      recognition,
      assessUcAdmission(experiences, new Date("2026-08-01T00:00:00Z")),
    );

    expect(
      matches.find((match) => match.course.title === "Master of Education (STEM)"),
    ).toMatchObject({
      category: "needs_review",
      creditConfidence: "high",
      entryConfidence: "medium",
    });
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
