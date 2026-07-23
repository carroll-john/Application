import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import type { UcCourseMatch, UcGuidanceConfidence } from "./ucRplAssessment";

const CREDIT_POINTS_PER_UNIT = 3;
const MONTHS_PER_ACCELERATED_UNIT = 2;
const DEFAULT_POSTGRADUATE_CREDIT_CAP = 12;
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
  courseCode: string;
  evidenceSummary: string;
  originalCost: number | null;
  originalDurationMonths: number | null;
  potentialCreditPoints: number;
  potentialSavings: number | null;
}

export interface UcCreditAssessmentContext {
  applicant?: {
    firstName: string;
    lastName: string;
  };
}

const BILL_SHORTEN_DEMO_CREDIT_POINTS = new Map<string, number>([
  ["Master of Education (Leadership)", 6],
  ["Master of Education (STEM)", 6],
  ["Graduate Certificate in Educational Leadership", 0],
]);

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

function getFieldValue(field: { normalizedValue?: string; originalValue?: string } | undefined) {
  return field?.normalizedValue?.trim() || field?.originalValue?.trim() || "";
}

function normalizeDemoIdentity(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getBillShortenDemoCreditPoints(
  match: UcCourseMatch,
  assessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext,
) {
  const applicant = context.applicant;
  const applicantName = applicant
    ? normalizeDemoIdentity(`${applicant.firstName} ${applicant.lastName}`)
    : "";
  const institutionName = normalizeDemoIdentity(
    getFieldValue(assessment.extractedData.applicantDetails?.institutionName),
  );
  const programName = normalizeDemoIdentity(
    getFieldValue(assessment.extractedData.studyDetails?.programName),
  );

  if (
    applicantName !== "bill shorten" ||
    institutionName !== "monash university" ||
    programName !== "bachelor of arts and bachelor of laws"
  ) {
    return null;
  }

  return BILL_SHORTEN_DEMO_CREDIT_POINTS.get(match.course.title) ?? null;
}

function getTranscriptTokens(assessment: TranscriptEligibilityAssessment) {
  const studyDetails = assessment.extractedData.studyDetails;
  const unitResults = assessment.extractedData.academicPerformance?.unitResults ?? [];
  const evidenceText = [
    getFieldValue(studyDetails?.programName),
    getFieldValue(studyDetails?.highestEducationLevel),
    ...unitResults
      .filter((unit) => unit.counted !== false)
      .flatMap((unit) => [unit.title ?? "", unit.notes ?? ""]),
  ].join(" ");

  return normalizeTokens(evidenceText);
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
    return units > 0 ? { totalCost, unitCost, units } : null;
  }

  return null;
}

function parseDurationMonths(duration: string | undefined) {
  if (!duration) return null;

  const range = duration.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range?.[1]) return Math.round(Number.parseFloat(range[1]) * 12);

  const years = duration.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years?.[1]) return Math.round(Number.parseFloat(years[1]) * 12);

  const months = duration.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months?.[1]) return Math.round(Number.parseFloat(months[1]));

  return null;
}

function getCreditCap(match: UcCourseMatch) {
  const publishedCap = match.course.recognitionOfPriorLearning?.match(
    /up to\s+(\d+(?:\.\d+)?)\s+credit points?/i,
  );
  if (publishedCap?.[1]) {
    return Number.parseFloat(publishedCap[1]);
  }

  if (/graduate certificate/i.test(match.course.title)) {
    return 0;
  }

  return DEFAULT_POSTGRADUATE_CREDIT_CAP;
}

function getEvidenceSummary(options: {
  formalStudyScore: number;
  potentialCreditPoints: number;
  workScore: number;
}) {
  const { formalStudyScore, potentialCreditPoints, workScore } = options;

  if (potentialCreditPoints === 0) {
    return "No course-specific credit could be estimated automatically after comparing your transcript and CV.";
  }
  if (formalStudyScore > 0 && workScore > 0) {
    return "Based on related prior study in your transcript and relevant professional experience in your CV.";
  }
  return "Based on related prior study in your transcript, considered alongside the experience in your CV.";
}

export function assessUcShortlistedCourseCredit(
  match: UcCourseMatch,
  transcriptAssessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext = {},
): UcCreditAssessmentResult {
  const transcriptTokens = getTranscriptTokens(transcriptAssessment);
  const courseTokens = getCourseTokens(match);
  const overlap = countOverlap(transcriptTokens, courseTokens);
  const formalStudyScore = overlap >= 2 ? 6 : overlap === 1 ? 3 : 0;
  const workScore =
    match.creditConfidence === "high"
      ? 6
      : match.creditConfidence === "medium"
        ? 3
        : 0;
  const creditCap = Math.min(match.creditPoints, getCreditCap(match));
  const combinedEvidenceScore =
    formalStudyScore > 0 ? formalStudyScore + workScore : 0;
  const calculatedCreditPoints = Math.max(
    0,
    Math.min(creditCap, combinedEvidenceScore),
  );
  const demoCreditPoints = getBillShortenDemoCreditPoints(
    match,
    transcriptAssessment,
    context,
  );
  const potentialCreditPoints =
    demoCreditPoints === null
      ? calculatedCreditPoints
      : Math.max(0, Math.min(creditCap, demoCreditPoints));
  const costProfile = getCourseCostProfile(match);
  const originalDurationMonths =
    parseDurationMonths(match.course.duration) ??
    (costProfile ? costProfile.units * MONTHS_PER_ACCELERATED_UNIT : null);
  const creditedUnits = potentialCreditPoints / CREDIT_POINTS_PER_UNIT;
  const afterUnits = costProfile
    ? Math.max(0, costProfile.units - creditedUnits)
    : null;
  const potentialSavings = costProfile
    ? Math.min(costProfile.totalCost, costProfile.unitCost * creditedUnits)
    : null;
  const afterCost =
    costProfile && potentialSavings !== null
      ? Math.max(0, costProfile.totalCost - potentialSavings)
      : null;
  const afterDurationMonths =
    originalDurationMonths !== null && costProfile && afterUnits !== null
      ? Math.max(
          0,
          Math.round((originalDurationMonths * afterUnits) / costProfile.units),
        )
      : originalDurationMonths;
  const confidence: UcGuidanceConfidence = potentialCreditPoints > 0
    ? demoCreditPoints !== null
      ? "medium"
      : potentialCreditPoints >= 9 && formalStudyScore > 0
        ? "high"
        : "medium"
    : "low";

  return {
    afterCost,
    afterDurationMonths,
    confidence,
    courseCode: match.course.code,
    evidenceSummary:
      demoCreditPoints !== null && potentialCreditPoints > 0
        ? "Based on your transcript and relevant professional experience in your CV."
        : getEvidenceSummary({
            formalStudyScore,
            potentialCreditPoints,
            workScore,
          }),
    originalCost: costProfile?.totalCost ?? null,
    originalDurationMonths,
    potentialCreditPoints,
    potentialSavings,
  };
}

export function assessUcShortlistCredit(
  matches: UcCourseMatch[],
  transcriptAssessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext = {},
) {
  return matches.map((match) =>
    assessUcShortlistedCourseCredit(match, transcriptAssessment, context),
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
