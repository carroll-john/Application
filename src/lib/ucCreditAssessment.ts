import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import type { UcCourseMatch, UcGuidanceConfidence } from "./ucRplAssessment";

const CREDIT_POINTS_PER_UNIT = 3;
const MONTHS_PER_ACCELERATED_UNIT = 2;
const DEFAULT_POSTGRADUATE_CREDIT_CAP = 12;
const POSITIVE_EVIDENCE_SUMMARY =
  "We used your work experience and previous study to calculate this indicative credit assessment. UC will confirm any credit awarded.";
const UC_DEMO_COURSE_CREDIT_PROFILES: Record<
  string,
  {
    reviewCreditCap: number;
    subjectEvidenceTerms: string[];
    totalCourseCreditPoints: number;
  }
> = {
  ARC701: {
    reviewCreditCap: 3,
    subjectEvidenceTerms: [
      "advertising",
      "communication",
      "digital",
      "marketing",
      "media",
    ],
    totalCourseCreditPoints: 12,
  },
  MGC103: {
    reviewCreditCap: 6,
    subjectEvidenceTerms: [
      "analytics",
      "business",
      "financial",
      "management",
      "organisation",
      "project",
    ],
    totalCourseCreditPoints: 12,
  },
  MGM104: {
    reviewCreditCap: 6,
    subjectEvidenceTerms: [
      "analytics",
      "business",
      "financial",
      "leadership",
      "management",
      "organisation",
      "project",
    ],
    totalCourseCreditPoints: 36,
  },
};
const TOKEN_ALIASES: Record<string, string> = {
  educational: "education",
  governmental: "government",
  managerial: "management",
  organisational: "organisation",
};

export interface UcCreditAssessmentResult {
  afterCost: number | null;
  afterDurationMonths: number | null;
  confidence: UcGuidanceConfidence;
  costBasis: "csp" | "full_fee" | null;
  courseCode: string;
  evidenceSummary: string;
  originalCost: number | null;
  originalDurationMonths: number | null;
  potentialCreditPoints: number;
  potentialSavings: number | null;
}

function normalizeTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(
        (token) =>
          token.length > 3 &&
          ![
            "certificate",
            "diploma",
            "graduate",
            "master",
            "university",
          ].includes(token),
      )
      .map((token) => TOKEN_ALIASES[token] ?? token),
  );
}

function getFieldValue(
  field: { normalizedValue?: string; originalValue?: string } | undefined,
) {
  return field?.normalizedValue?.trim() || field?.originalValue?.trim() || "";
}

function getTranscriptTokens(assessment: TranscriptEligibilityAssessment) {
  const studyDetails = assessment.extractedData.studyDetails;
  const unitResults =
    assessment.extractedData.academicPerformance?.unitResults ?? [];
  const evidenceText = [
    getFieldValue(studyDetails?.programName),
    getFieldValue(studyDetails?.highestEducationLevel),
    ...unitResults
      .filter((unit) => unit.counted !== false)
      .flatMap((unit) => [unit.title ?? "", unit.notes ?? ""]),
  ].join(" ");

  return normalizeTokens(evidenceText);
}

function getCountedTranscriptUnitTitles(
  assessment: TranscriptEligibilityAssessment,
) {
  return (
    assessment.extractedData.academicPerformance?.unitResults
      ?.filter((unit) => unit.counted !== false && unit.title?.trim())
      .map((unit) => unit.title?.trim() ?? "") ?? []
  );
}

function getCourseTokens(match: UcCourseMatch) {
  return normalizeTokens(
    [
      match.course.title,
      match.course.subjectArea ?? "",
      ...match.course.categories,
      ...match.course.coreSubjects,
    ].join(" "),
  );
}

function countOverlap(left: Set<string>, right: Set<string>) {
  return Array.from(left).filter((token) => right.has(token)).length;
}

function getMatchedTranscriptSubjects(
  match: UcCourseMatch,
  assessment: TranscriptEligibilityAssessment,
) {
  const courseProfile = getCourseCreditProfile(match);
  const courseTokens = courseProfile
    ? new Set(courseProfile.subjectEvidenceTerms)
    : getCourseTokens(match);

  return getCountedTranscriptUnitTitles(assessment).filter(
    (title) => countOverlap(normalizeTokens(title), courseTokens) > 0,
  );
}

function parseMoney(value: string | undefined, pattern: RegExp) {
  if (!value) return null;
  const match = value.match(pattern);
  const amount = match?.[1]?.replace(/,/g, "");
  const parsed = amount ? Number.parseFloat(amount) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function getCourseCostProfile(match: UcCourseMatch) {
  const feeText = [
    match.course.tuitionFees,
    match.course.price,
    match.course.feeSummary,
    ...match.course.feeNotes,
  ]
    .filter(Boolean)
    .join(". ");
  const unitCost = parseMoney(
    feeText,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(?:unit|subject)/i,
  );
  const totalCost = parseMoney(
    feeText,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:indicative\s*)?(?:total|for\s+the\s+full\s+course)/i,
  );

  if (unitCost && totalCost) {
    const units = Math.round(totalCost / unitCost);
    return units > 0
      ? {
          costBasis: /\bCSP\b/i.test(feeText)
            ? ("csp" as const)
            : ("full_fee" as const),
          totalCost,
          unitCost,
          units,
        }
      : null;
  }

  return null;
}

function parseDurationMonths(duration: string | undefined) {
  if (!duration) return null;

  const range = duration.match(
    /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*years?/i,
  );
  if (range?.[1]) return Math.round(Number.parseFloat(range[1]) * 12);

  const years = duration.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years?.[1]) return Math.round(Number.parseFloat(years[1]) * 12);

  const months = duration.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months?.[1]) return Math.round(Number.parseFloat(months[1]));

  return null;
}

function getCourseCreditProfile(match: UcCourseMatch) {
  const officialCode = match.course.officialCourseCode?.toUpperCase();
  return officialCode
    ? UC_DEMO_COURSE_CREDIT_PROFILES[officialCode]
    : undefined;
}

function getCreditCap(match: UcCourseMatch) {
  const publishedCap = match.course.recognitionOfPriorLearning?.match(
    /up to\s+(\d+(?:\.\d+)?)\s+credit points?/i,
  );
  if (publishedCap?.[1]) {
    return Number.parseFloat(publishedCap[1]);
  }

  const demoProfile = getCourseCreditProfile(match);
  if (demoProfile) {
    return demoProfile.reviewCreditCap;
  }

  if (/graduate certificate/i.test(match.course.title)) {
    return 0;
  }

  return DEFAULT_POSTGRADUATE_CREDIT_CAP;
}

function getEvidenceSummary(potentialCreditPoints: number) {
  if (potentialCreditPoints === 0) {
    return "No course-specific credit could be estimated automatically after comparing your transcript and CV.";
  }
  return POSITIVE_EVIDENCE_SUMMARY;
}

export function assessUcShortlistedCourseCredit(
  match: UcCourseMatch,
  transcriptAssessment: TranscriptEligibilityAssessment,
): UcCreditAssessmentResult {
  const transcriptTokens = getTranscriptTokens(transcriptAssessment);
  const courseTokens = getCourseTokens(match);
  const overlap = countOverlap(transcriptTokens, courseTokens);
  const matchedTranscriptSubjects = getMatchedTranscriptSubjects(
    match,
    transcriptAssessment,
  );
  const courseCreditProfile = getCourseCreditProfile(match);
  const formalStudyScore = courseCreditProfile
    ? matchedTranscriptSubjects.length >= 2
      ? 6
      : matchedTranscriptSubjects.length === 1
        ? 3
        : 0
    : overlap >= 2
      ? 6
      : overlap === 1
        ? 3
        : 0;
  const workScore =
    match.creditConfidence === "high"
      ? 6
      : match.creditConfidence === "medium"
        ? 3
        : 0;
  const creditCap = getCreditCap(match);
  const combinedEvidenceScore =
    formalStudyScore > 0 ? formalStudyScore + workScore : 0;
  const potentialCreditPoints = Math.max(
    0,
    Math.min(creditCap, combinedEvidenceScore),
  );
  const costProfile = getCourseCostProfile(match);
  const originalDurationMonths =
    parseDurationMonths(match.course.duration) ??
    (costProfile ? costProfile.units * MONTHS_PER_ACCELERATED_UNIT : null);
  const creditedUnits = potentialCreditPoints / CREDIT_POINTS_PER_UNIT;
  const potentialSavings = costProfile
    ? Math.min(costProfile.totalCost, costProfile.unitCost * creditedUnits)
    : null;
  const afterCost =
    costProfile && potentialSavings !== null
      ? Math.max(0, costProfile.totalCost - potentialSavings)
      : null;
  const totalCourseCreditPoints =
    courseCreditProfile?.totalCourseCreditPoints ??
    (costProfile ? costProfile.units * CREDIT_POINTS_PER_UNIT : null);
  const afterDurationMonths =
    originalDurationMonths !== null &&
    totalCourseCreditPoints !== null &&
    totalCourseCreditPoints > 0
      ? Math.max(
          0,
          Math.round(
            (originalDurationMonths *
              (totalCourseCreditPoints - potentialCreditPoints)) /
              totalCourseCreditPoints,
          ),
        )
      : originalDurationMonths;
  const confidence: UcGuidanceConfidence =
    courseCreditProfile && potentialCreditPoints > 0
      ? "medium"
      : potentialCreditPoints >= 9 && formalStudyScore > 0
        ? "high"
        : potentialCreditPoints > 0
          ? "medium"
          : "low";

  return {
    afterCost,
    afterDurationMonths,
    confidence,
    costBasis: costProfile?.costBasis ?? null,
    courseCode: match.course.code,
    evidenceSummary: getEvidenceSummary(potentialCreditPoints),
    originalCost: costProfile?.totalCost ?? null,
    originalDurationMonths,
    potentialCreditPoints,
    potentialSavings,
  };
}

export function assessUcShortlistCredit(
  matches: UcCourseMatch[],
  transcriptAssessment: TranscriptEligibilityAssessment,
) {
  return matches.map((match) =>
    assessUcShortlistedCourseCredit(match, transcriptAssessment),
  );
}

export function hasUcTranscriptStudyEvidence(
  assessment: TranscriptEligibilityAssessment,
) {
  const studyDetails = assessment.extractedData.studyDetails;
  const academicPerformance = assessment.extractedData.academicPerformance;

  return Boolean(
    getFieldValue(studyDetails?.programName) ||
    (academicPerformance?.unitResults?.length ?? 0) > 0,
  );
}

export function formatUcAssessmentCost(cost: number | null) {
  if (cost === null) return "Confirm with UC";

  return new Intl.NumberFormat("en-AU", {
    currency: "AUD",
    maximumFractionDigits: cost % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(cost);
}

export function formatUcAssessmentDuration(months: number | null) {
  if (months === null) return "Confirm with UC";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${months} months`;
}
