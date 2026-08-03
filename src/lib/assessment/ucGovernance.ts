import type {
  EligibilityAcademicUnitResult,
  TranscriptEligibilityAssessment,
} from "../eligibility/types.js";
import type {
  AssessmentConfidence,
  AssessmentVersionSnapshot,
  CreditEstimateResult,
  MatchedTranscriptEvidence,
} from "./types.js";

export const UC_ASSESSMENT_PARTNER_ID = "university-of-canberra";
export const UC_ASSESSMENT_CATALOGUE_VERSION = "uc-online-2026-07-23";
export const UC_ASSESSMENT_RULES_VERSION = "uc-credit-pilot-2026-08-04.1";
export const UC_ASSESSMENT_MODEL_VERSION = "transcript-evidence-v1";
export const UC_ASSESSMENT_MAX_SOURCE_AGE_DAYS = 30;

export const UC_ASSESSMENT_VERSIONS: AssessmentVersionSnapshot = {
  catalogueVersion: UC_ASSESSMENT_CATALOGUE_VERSION,
  modelVersion: UC_ASSESSMENT_MODEL_VERSION,
  rulesVersion: UC_ASSESSMENT_RULES_VERSION,
};

export interface UcCreditMapping {
  id: string;
  patterns: string[];
}

export interface UcGovernedCourse {
  approval: {
    approvedAt: string | null;
    approvedBy: string | null;
    status: "pending_uc_approval" | "approved";
  };
  courseCode: string;
  courseTitle: string;
  expiresAt: string;
  mappings: UcCreditMapping[];
  pointsPerMatchedUnit: number;
  publishedCap: number;
  sourceUrl: string;
  sourceVerifiedAt: string;
}

const EDUCATION_FOUNDATION_MAPPINGS: UcCreditMapping[] = [
  { id: "education-curriculum", patterns: ["curriculum", "pedagogy"] },
  { id: "education-learning", patterns: ["learning", "education"] },
  { id: "education-research", patterns: ["education research", "educational research"] },
  { id: "education-assessment", patterns: ["assessment", "evaluation"] },
];

export const UC_GOVERNED_COURSES: readonly UcGovernedCourse[] = [
  {
    approval: { approvedAt: null, approvedBy: null, status: "pending_uc_approval" },
    courseCode: "master-of-business-administration-government",
    courseTitle: "Master of Business Administration (Government)",
    expiresAt: "2026-08-20",
    mappings: [
      { id: "government-governance", patterns: ["governance", "government"] },
      { id: "government-policy", patterns: ["public policy", "policy"] },
      { id: "government-leadership", patterns: ["leadership", "management"] },
      { id: "government-strategy", patterns: ["strategy", "strategic"] },
    ],
    pointsPerMatchedUnit: 3,
    publishedCap: 12,
    sourceUrl:
      "https://studyonline.canberra.edu.au/online-courses/master-business-administration-government",
    sourceVerifiedAt: "2026-07-21",
  },
  {
    approval: { approvedAt: null, approvedBy: null, status: "pending_uc_approval" },
    courseCode: "master-of-education",
    courseTitle: "Master of Education",
    expiresAt: "2026-08-22",
    mappings: EDUCATION_FOUNDATION_MAPPINGS,
    pointsPerMatchedUnit: 3,
    publishedCap: 12,
    sourceUrl: "https://studyonline.canberra.edu.au/online-courses/master-of-education",
    sourceVerifiedAt: "2026-07-23",
  },
  {
    approval: { approvedAt: null, approvedBy: null, status: "pending_uc_approval" },
    courseCode: "master-of-education-stem",
    courseTitle: "Master of Education (STEM)",
    expiresAt: "2026-08-22",
    mappings: [
      ...EDUCATION_FOUNDATION_MAPPINGS,
      { id: "stem-education", patterns: ["stem", "science education", "mathematics education"] },
      { id: "stem-technology", patterns: ["technology education", "digital learning"] },
    ],
    pointsPerMatchedUnit: 3,
    publishedCap: 12,
    sourceUrl: "https://studyonline.canberra.edu.au/online-courses/master-of-education",
    sourceVerifiedAt: "2026-07-23",
  },
  {
    approval: { approvedAt: null, approvedBy: null, status: "pending_uc_approval" },
    courseCode: "master-of-education-leadership",
    courseTitle: "Master of Education (Leadership)",
    expiresAt: "2026-08-22",
    mappings: [
      ...EDUCATION_FOUNDATION_MAPPINGS,
      { id: "education-leadership", patterns: ["educational leadership", "school leadership"] },
      { id: "education-change", patterns: ["change management", "organisational change"] },
    ],
    pointsPerMatchedUnit: 3,
    publishedCap: 12,
    sourceUrl:
      "https://studyonline.canberra.edu.au/online-courses/master-education-leadership",
    sourceVerifiedAt: "2026-07-23",
  },
] as const;

function normalizeEvidenceText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countedTranscriptUnits(assessment: TranscriptEligibilityAssessment) {
  return (assessment.extractedData.academicPerformance?.unitResults ?? []).filter(
    (unit) => unit.counted !== false && Boolean(unit.title?.trim()),
  );
}

function matchMapping(
  unit: EligibilityAcademicUnitResult,
  mappings: readonly UcCreditMapping[],
) {
  const evidence = normalizeEvidenceText(
    [unit.unitCode, unit.title, unit.notes].filter(Boolean).join(" "),
  );

  return mappings.find((mapping) =>
    mapping.patterns.some((pattern) =>
      evidence.includes(normalizeEvidenceText(pattern)),
    ),
  );
}

function confidenceForMatches(matchCount: number): AssessmentConfidence {
  if (matchCount >= 3) return "high";
  if (matchCount >= 1) return "medium";
  return "low";
}

function pendingApprovalReason(course: UcGovernedCourse) {
  return `UC approval is required for rules version ${UC_ASSESSMENT_RULES_VERSION} before ${course.courseTitle} can show a numeric estimate.`;
}

export function isUcGovernanceApproved(
  course: UcGovernedCourse,
  approvedRulesVersion = "",
) {
  return (
    course.approval.status === "approved" &&
    Boolean(course.approval.approvedAt) &&
    Boolean(course.approval.approvedBy) &&
    approvedRulesVersion === UC_ASSESSMENT_RULES_VERSION
  );
}

export function evaluateUcTranscriptCredit(options: {
  approvedRulesVersion?: string;
  assessment: TranscriptEligibilityAssessment;
  courseCode: string;
  courses?: readonly UcGovernedCourse[];
  now?: Date;
}): CreditEstimateResult {
  const {
    approvedRulesVersion = "",
    assessment,
    courseCode,
    courses = UC_GOVERNED_COURSES,
    now = new Date(),
  } = options;
  const course = courses.find((candidate) => candidate.courseCode === courseCode);

  if (!course) {
    return {
      confidence: "low",
      courseCode,
      manualReviewReasons: [
        "This course is not governed for automated credit guidance in the UC pilot.",
      ],
      matchedTranscriptEvidence: [],
      potentialCreditPoints: null,
      publishedCap: null,
      versions: UC_ASSESSMENT_VERSIONS,
    };
  }

  if (now.getTime() > new Date(`${course.expiresAt}T23:59:59.999Z`).getTime()) {
    return {
      confidence: "low",
      courseCode,
      manualReviewReasons: ["The governed course mapping has expired and must be re-approved."],
      matchedTranscriptEvidence: [],
      potentialCreditPoints: null,
      publishedCap: course.publishedCap,
      versions: UC_ASSESSMENT_VERSIONS,
    };
  }

  if (!isUcGovernanceApproved(course, approvedRulesVersion)) {
    return {
      confidence: "low",
      courseCode,
      manualReviewReasons: [pendingApprovalReason(course)],
      matchedTranscriptEvidence: [],
      potentialCreditPoints: null,
      publishedCap: course.publishedCap,
      versions: UC_ASSESSMENT_VERSIONS,
    };
  }

  const matchedMappingIds = new Set<string>();
  const matches: MatchedTranscriptEvidence[] = [];

  for (const unit of countedTranscriptUnits(assessment)) {
    const mapping = matchMapping(unit, course.mappings);

    if (!mapping || matchedMappingIds.has(mapping.id)) continue;
    matchedMappingIds.add(mapping.id);
    matches.push({
      creditPoints: course.pointsPerMatchedUnit,
      mappingId: mapping.id,
      title: unit.title!.trim(),
      unitCode: unit.unitCode?.trim() || null,
    });
  }

  if (matches.length === 0) {
    return {
      confidence: "low",
      courseCode,
      manualReviewReasons: [
        "The transcript does not contain enough mapped study evidence for a numeric estimate.",
      ],
      matchedTranscriptEvidence: [],
      potentialCreditPoints: null,
      publishedCap: course.publishedCap,
      versions: UC_ASSESSMENT_VERSIONS,
    };
  }

  const potentialCreditPoints = Math.min(
    course.publishedCap,
    matches.reduce((total, match) => total + match.creditPoints, 0),
  );
  const cappedMatches = matches.slice(
    0,
    Math.ceil(potentialCreditPoints / course.pointsPerMatchedUnit),
  );

  return {
    confidence: confidenceForMatches(cappedMatches.length),
    courseCode,
    manualReviewReasons:
      cappedMatches.length < 2
        ? ["Low-confidence estimates require manual UC review."]
        : [],
    matchedTranscriptEvidence: cappedMatches,
    potentialCreditPoints,
    publishedCap: course.publishedCap,
    versions: UC_ASSESSMENT_VERSIONS,
  };
}

export function findStaleUcGovernanceSources(
  now = new Date(),
  courses: readonly UcGovernedCourse[] = UC_GOVERNED_COURSES,
) {
  const maximumAgeMs = UC_ASSESSMENT_MAX_SOURCE_AGE_DAYS * 24 * 60 * 60 * 1_000;

  return courses.filter((course) => {
    const verifiedAt = new Date(`${course.sourceVerifiedAt}T00:00:00.000Z`).getTime();
    return !Number.isFinite(verifiedAt) || now.getTime() - verifiedAt > maximumAgeMs;
  });
}
