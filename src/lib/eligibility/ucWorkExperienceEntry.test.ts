import { describe, expect, it } from "vitest";
import {
  UC_WORK_ENTRY_RULESET_VERSION,
  assessUcWorkExperienceEntry,
  isUcApprovedPostgraduateWorkEntryCourse,
  type UcPriorStudyCategory,
} from "./ucWorkExperienceEntry";

function assess(
  overrides: Partial<Parameters<typeof assessUcWorkExperienceEntry>[0]> = {},
) {
  return assessUcWorkExperienceEntry({
    generalExperienceMonths: 0,
    officialCourseCode: "MGM103",
    oscaSkillLevelMonths: {},
    priorStudyCategory: "unknown",
    relevantExperienceMonths: 0,
    ...overrides,
  });
}

describe("UC postgraduate work-experience entry rules", () => {
  it.each([
    ["diploma_or_associate", 24, 48],
    ["certificate_iv_or_year_12", 36, 72],
    ["no_prior_qualification", 84, 120],
  ] as const)(
    "applies the relevant and general career-history thresholds for %s",
    (priorStudyCategory, relevantMonths, generalMonths) => {
      const relevant = assess({
        priorStudyCategory,
        relevantExperienceMonths: relevantMonths,
      });
      const general = assess({
        generalExperienceMonths: generalMonths,
        priorStudyCategory,
      });

      expect(relevant.overallStatus).toBe("may_meet");
      expect(relevant.selectedPathway.pathway).toBe(
        "career_history_relevant",
      );
      expect(general.overallStatus).toBe("may_meet");
      expect(general.selectedPathway.pathway).toBe("career_history_general");
    },
  );

  it.each([
    "partial_bachelor",
    "completed_bachelor_or_higher",
    "unknown",
  ] as UcPriorStudyCategory[])(
    "does not infer a career-history threshold for %s",
    (priorStudyCategory) => {
      const result = assess({
        generalExperienceMonths: 240,
        priorStudyCategory,
        relevantExperienceMonths: 240,
      });

      expect(result.overallStatus).toBe("needs_review");
      expect(result.selectedPathway.pathway).toBe("manual_review");
    },
  );

  it("applies UC's published OSCA pathways only to an approved course", () => {
    const approvedSkillOne = assess({ oscaSkillLevelMonths: { 1: 1 } });
    const approvedSkillTwo = assess({ oscaSkillLevelMonths: { 2: 24 } });
    const unapproved = assess({
      officialCourseCode: "EDM102",
      oscaSkillLevelMonths: { 1: 60 },
    });

    expect(approvedSkillOne.overallStatus).toBe("may_meet");
    expect(approvedSkillTwo.overallStatus).toBe("may_meet");
    expect(unapproved.overallStatus).toBe("needs_review");
    expect(unapproved.approvedGeneralCourse).toBe(false);
  });

  it("recognises the current MBA code through its documented published-code alias", () => {
    expect(isUcApprovedPostgraduateWorkEntryCourse("MGM104")).toBe(true);
    expect(
      assess({
        officialCourseCode: "MGM104",
        oscaSkillLevelMonths: { 1: 36 },
      }),
    ).toMatchObject({
      approvedGeneralCourse: true,
      overallStatus: "may_meet",
      rulesVersion: UC_WORK_ENTRY_RULESET_VERSION,
    });
  });

  it("allows a course-specific experience route independently of the approved list", () => {
    const result = assess({
      courseSpecificRelevantYears: 3,
      officialCourseCode: "MGC102",
      relevantExperienceMonths: 36,
    });

    expect(result.approvedGeneralCourse).toBe(false);
    expect(result.overallStatus).toBe("may_meet");
    expect(result.selectedPathway).toMatchObject({
      pathway: "course_specific",
      requiredMonths: 36,
    });
  });

  it("keeps the published online law caveat on a review path", () => {
    const result = assess({
      officialCourseCode: "SCC003",
      oscaSkillLevelMonths: { 1: 36 },
    });

    expect(result.requiresAdditionalCourseReview).toBe(true);
    expect(result.overallStatus).toBe("needs_review");
  });
});
