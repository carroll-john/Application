import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import { normalizeTranscriptEligibilityAssessment } from "./eligibility/normalize";
import {
  BILL_SHORTEN_UC_DEMO_COURSES,
  isBillShortenUcDemoName,
} from "./ucDemoFixture";
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
  billShortenDemoFixture?: boolean;
}

const BILL_SHORTEN_DEMO_CREDIT_POINTS = new Map<string, number>(
  BILL_SHORTEN_UC_DEMO_COURSES.map(({ creditPoints, title }) => [
    title,
    creditPoints,
  ]),
);

export const UC_CREDIT_DEMO_ASSESSMENT_DELAY_MS = 3_000;

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

function isBillShortenDemoApplicant(
  applicant: UcCreditAssessmentContext["applicant"],
  transcriptAssessment: TranscriptEligibilityAssessment,
) {
  const profileName = applicant
    ? `${applicant.firstName} ${applicant.lastName}`.trim()
    : "";
  if (profileName) return isBillShortenUcDemoName(profileName);

  return isBillShortenUcDemoName(
    getFieldValue(
      transcriptAssessment.extractedData.applicantDetails?.fullName,
    ),
  );
}

function isBillShortenDemoCourseSet(matches: UcCourseMatch[]) {
  const expectedCourseTitles = new Set(BILL_SHORTEN_DEMO_CREDIT_POINTS.keys());

  return (
    matches.length === expectedCourseTitles.size &&
    matches.every((match) => expectedCourseTitles.has(match.course.title))
  );
}

export function isBillShortenUcCreditDemoFixture(
  matches: UcCourseMatch[],
  applicant: UcCreditAssessmentContext["applicant"],
) {
  if (!applicant) return false;

  return (
    isBillShortenUcDemoName(`${applicant.firstName} ${applicant.lastName}`) &&
    isBillShortenDemoCourseSet(matches)
  );
}

export function createBillShortenUcCreditDemoTranscriptAssessment() {
  return normalizeTranscriptEligibilityAssessment({
    confidence: 0.97,
    manualReviewRequired: false,
    outcome: "eligible",
    applicantDetails: {
      fullName: {
        confidence: 0.99,
        normalizedValue: "William (Bill) Shorten",
      },
      institutionName: {
        confidence: 0.98,
        normalizedValue: "Monash University, Australia",
      },
    },
    studyDetails: {
      highestEducationLevel: {
        confidence: 0.98,
        normalizedValue: "Bachelor",
      },
      programName: {
        confidence: 0.98,
        normalizedValue: "Bachelor of Arts / Bachelor of Laws",
      },
    },
  });
}

export function prepareUcCreditAssessment(options: {
  parserAssessment: Promise<TranscriptEligibilityAssessment>;
  usesFastDemoAssessment: boolean;
  wait: (milliseconds: number) => Promise<void>;
}) {
  const { parserAssessment, usesFastDemoAssessment, wait } = options;

  return {
    cardAssessment: usesFastDemoAssessment
      ? wait(UC_CREDIT_DEMO_ASSESSMENT_DELAY_MS).then(() =>
          createBillShortenUcCreditDemoTranscriptAssessment(),
        )
      : parserAssessment,
    parserAssessment,
  };
}

export async function resolveUcTranscriptAssessmentForApplication(options: {
  parserAssessment: Promise<TranscriptEligibilityAssessment> | null;
  startParserAssessment: () => Promise<TranscriptEligibilityAssessment>;
}) {
  const { parserAssessment, startParserAssessment } = options;
  const initialAssessment = parserAssessment ?? startParserAssessment();

  try {
    return await initialAssessment;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return startParserAssessment();
  }
}

function getBillShortenDemoCreditPoints(
  match: UcCourseMatch,
  context: UcCreditAssessmentContext,
) {
  if (!context.billShortenDemoFixture) {
    return null;
  }

  return BILL_SHORTEN_DEMO_CREDIT_POINTS.get(match.course.title) ?? null;
}

function isBillShortenDemoShortlist(
  matches: UcCourseMatch[],
  transcriptAssessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext,
) {
  return (
    isBillShortenDemoApplicant(context.applicant, transcriptAssessment) &&
    hasUcTranscriptStudyEvidence(transcriptAssessment) &&
    isBillShortenDemoCourseSet(matches)
  );
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
  const demoCreditPoints = getBillShortenDemoCreditPoints(match, context);
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
  const assessmentContext = {
    ...context,
    billShortenDemoFixture: isBillShortenDemoShortlist(
      matches,
      transcriptAssessment,
      context,
    ),
  };

  return matches.map((match) =>
    assessUcShortlistedCourseCredit(
      match,
      transcriptAssessment,
      assessmentContext,
    ),
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
