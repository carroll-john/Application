export const UC_WORK_ENTRY_RULESET_VERSION = "uc-work-entry@2026-08-18";
export const UC_WORK_ENTRY_SOURCE_VERIFIED_AT = "2026-08-18";

export const UC_WORK_ENTRY_SOURCES = {
  checker:
    "https://www.canberra.edu.au/content/uc/home/future-students/entry-requirements-options/alternative-entry-recognition-pathways/prior-work-study-recognition.html",
  eligiblePostgraduateCourses:
    "https://www.canberra.edu.au/future-students/entry-requirements-options/alternative-entry-recognition-pathways/prior-work-study-recognition/work-recognition-postgraduate/eligible-courses-work-based-entry",
  postgraduate:
    "https://www.canberra.edu.au/future-students/entry-requirements-options/alternative-entry-recognition-pathways/prior-work-study-recognition/work-recognition-postgraduate",
} as const;

export type UcPriorStudyCategory =
  | "diploma_or_associate"
  | "certificate_iv_or_year_12"
  | "no_prior_qualification"
  | "partial_bachelor"
  | "completed_bachelor_or_higher"
  | "unknown";

export type UcWorkEntryStatus =
  | "may_meet"
  | "needs_review"
  | "not_demonstrated";

export type UcWorkEntryPathwayType =
  | "course_specific"
  | "career_history_relevant"
  | "career_history_general"
  | "skilled_work"
  | "manual_review";

export interface UcWorkEntryPathwayAssessment {
  actualMonths: number;
  pathway: UcWorkEntryPathwayType;
  requiredMonths: number | null;
  status: UcWorkEntryStatus;
}

export interface UcWorkExperienceEntryInput {
  courseSpecificRelevantYears?: number | null;
  generalExperienceMonths: number;
  officialCourseCode?: string | null;
  oscaSkillLevelMonths: Partial<Record<1 | 2, number>>;
  priorStudyCategory: UcPriorStudyCategory;
  relevantExperienceMonths: number;
}

export interface UcWorkExperienceEntryAssessment {
  approvedGeneralCourse: boolean;
  overallStatus: UcWorkEntryStatus;
  pathways: UcWorkEntryPathwayAssessment[];
  requiresAdditionalCourseReview: boolean;
  rulesVersion: typeof UC_WORK_ENTRY_RULESET_VERSION;
  selectedPathway: UcWorkEntryPathwayAssessment;
  sourceVerifiedAt: typeof UC_WORK_ENTRY_SOURCE_VERIFIED_AT;
}

const APPROVED_POSTGRADUATE_WORK_ENTRY_COURSE_CODES = new Set([
  "193JA",
  "245JA",
  "297JA",
  "309JA",
  "360JA",
  "386JA",
  "723AA",
  "739AD",
  "840AA",
  "841AA",
  "843AA",
  "844AA",
  "973AA",
  "ABC101",
  "ABG101",
  "ABM101",
  "ARC102",
  "ARC201",
  "ARC401",
  "ARC701",
  "ARG201",
  "ARG501",
  "ARM201",
  "ARM301",
  "EDC301",
  "EDC401",
  "EDG301",
  "ITC102",
  "ITC103",
  "ITM001",
  "MGM103",
  "SCC003",
  "SCC101",
  "SCC102",
  "SCG003",
  "SCG101",
  "SCM002",
  "SCM101",
]);

/**
 * The published approved-course page still identifies the MBA as MGM103 while
 * the 2026 course page uses MGM104. Keep the current code tied to the published
 * identifier so the drift is visible and testable rather than silently broadening
 * the approved list.
 */
const CURRENT_CODE_ALIASES = new Map([["MGM104", "MGM103"]]);

const COURSES_REQUIRING_ADDITIONAL_REVIEW = new Set([
  "SCC003",
  "SCG003",
  "SCM002",
]);

const CAREER_HISTORY_THRESHOLDS: Partial<
  Record<
    UcPriorStudyCategory,
    { generalMonths: number; relevantMonths: number }
  >
> = {
  certificate_iv_or_year_12: {
    generalMonths: 72,
    relevantMonths: 36,
  },
  diploma_or_associate: {
    generalMonths: 48,
    relevantMonths: 24,
  },
  no_prior_qualification: {
    generalMonths: 120,
    relevantMonths: 84,
  },
};

function normalizeCourseCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";
  return CURRENT_CODE_ALIASES.get(code) ?? code;
}

export function isUcApprovedPostgraduateWorkEntryCourse(
  officialCourseCode: string | null | undefined,
) {
  return APPROVED_POSTGRADUATE_WORK_ENTRY_COURSE_CODES.has(
    normalizeCourseCode(officialCourseCode),
  );
}

function assessThreshold(
  pathway: UcWorkEntryPathwayType,
  actualMonths: number,
  requiredMonths: number,
): UcWorkEntryPathwayAssessment {
  return {
    actualMonths,
    pathway,
    requiredMonths,
    status: actualMonths >= requiredMonths ? "may_meet" : "not_demonstrated",
  };
}

export function assessUcOscaSkilledWorkPathway(
  oscaSkillLevelMonths: Partial<Record<1 | 2, number>>,
): UcWorkEntryPathwayAssessment {
  const skillLevelOneMonths = oscaSkillLevelMonths[1] ?? 0;
  const skillLevelTwoMonths = oscaSkillLevelMonths[2] ?? 0;

  if (skillLevelOneMonths > 0) {
    return {
      actualMonths: skillLevelOneMonths,
      pathway: "skilled_work",
      requiredMonths: null,
      status: "may_meet",
    };
  }

  return assessThreshold("skilled_work", skillLevelTwoMonths, 24);
}

function manualReviewPathway(): UcWorkEntryPathwayAssessment {
  return {
    actualMonths: 0,
    pathway: "manual_review",
    requiredMonths: null,
    status: "needs_review",
  };
}

function selectPathway(pathways: UcWorkEntryPathwayAssessment[]) {
  const priority: UcWorkEntryPathwayType[] = [
    "course_specific",
    "skilled_work",
    "career_history_relevant",
    "career_history_general",
    "manual_review",
  ];

  return [...pathways].sort((left, right) => {
    const statusRank = { may_meet: 0, needs_review: 1, not_demonstrated: 2 };
    const statusDifference = statusRank[left.status] - statusRank[right.status];
    if (statusDifference !== 0) return statusDifference;
    return priority.indexOf(left.pathway) - priority.indexOf(right.pathway);
  })[0];
}

export function assessUcWorkExperienceEntry(
  input: UcWorkExperienceEntryInput,
): UcWorkExperienceEntryAssessment {
  const officialCourseCode = normalizeCourseCode(input.officialCourseCode);
  const approvedGeneralCourse = isUcApprovedPostgraduateWorkEntryCourse(
    officialCourseCode,
  );
  const pathways: UcWorkEntryPathwayAssessment[] = [];

  if (
    input.courseSpecificRelevantYears !== null &&
    input.courseSpecificRelevantYears !== undefined
  ) {
    pathways.push(
      assessThreshold(
        "course_specific",
        input.relevantExperienceMonths,
        input.courseSpecificRelevantYears * 12,
      ),
    );
  }

  if (approvedGeneralCourse) {
    pathways.push(assessUcOscaSkilledWorkPathway(input.oscaSkillLevelMonths));

    const thresholds = CAREER_HISTORY_THRESHOLDS[input.priorStudyCategory];
    if (thresholds) {
      pathways.push(
        assessThreshold(
          "career_history_relevant",
          input.relevantExperienceMonths,
          thresholds.relevantMonths,
        ),
        assessThreshold(
          "career_history_general",
          input.generalExperienceMonths,
          thresholds.generalMonths,
        ),
      );
    } else {
      pathways.push(manualReviewPathway());
    }
  }

  if (pathways.length === 0) {
    pathways.push(manualReviewPathway());
  }

  const selectedPathway = selectPathway(pathways);
  const requiresAdditionalCourseReview =
    COURSES_REQUIRING_ADDITIONAL_REVIEW.has(officialCourseCode);
  const overallStatus =
    selectedPathway.status === "may_meet" && requiresAdditionalCourseReview
      ? "needs_review"
      : selectedPathway.status;

  return {
    approvedGeneralCourse,
    overallStatus,
    pathways,
    requiresAdditionalCourseReview,
    rulesVersion: UC_WORK_ENTRY_RULESET_VERSION,
    selectedPathway,
    sourceVerifiedAt: UC_WORK_ENTRY_SOURCE_VERIFIED_AT,
  };
}
