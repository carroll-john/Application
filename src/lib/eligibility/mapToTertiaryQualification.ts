import type { TertiaryQualification } from "../applicationData";
import { normalizeMonth, normalizeYear } from "../documentParsers/cv";
import { countries } from "../formOptions";
import type { TranscriptExtractedData } from "./types";

export type TertiaryQualificationFieldDraft = Pick<
  TertiaryQualification,
  | "institution"
  | "country"
  | "level"
  | "courseName"
  | "startMonth"
  | "startYear"
  | "completed"
  | "endMonth"
  | "endYear"
>;

const TERTIARY_LEVEL_OPTIONS = [
  "Associate Degree",
  "Diploma",
  "Advanced Diploma",
  "Bachelor",
  "Honours",
  "Graduate Certificate",
  "Graduate Diploma",
  "Masters",
  "PhD",
] as const;

const LEVEL_PATTERNS: Array<{ pattern: RegExp; level: (typeof TERTIARY_LEVEL_OPTIONS)[number] }> =
  [
    { pattern: /\b(ph\.?\s*d|doctorate|doctoral)\b/i, level: "PhD" },
    { pattern: /\b(master|m\.?\s*sc|m\.?\s*a|mba)\b/i, level: "Masters" },
    { pattern: /\b(honou?rs)\b/i, level: "Honours" },
    { pattern: /\bgraduate\s+certificate\b/i, level: "Graduate Certificate" },
    { pattern: /\bgraduate\s+diploma\b/i, level: "Graduate Diploma" },
    { pattern: /\b(advanced\s+diploma)\b/i, level: "Advanced Diploma" },
    { pattern: /\b(associate\s+degree)\b/i, level: "Associate Degree" },
    { pattern: /\b(diploma)\b/i, level: "Diploma" },
    { pattern: /\b(bachelor|b\.?\s*sc|b\.?\s*a|b\.?\s*eng|b\.?\s*com)\b/i, level: "Bachelor" },
  ];

function readFieldValue(
  field:
    | {
        normalizedValue?: string;
        originalValue?: string;
      }
    | undefined,
) {
  if (!field) {
    return "";
  }

  return (field.normalizedValue ?? field.originalValue ?? "").trim();
}

function normalizeCountry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const exact = countries.find(
    (country) => country.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  const aliases = new Map<string, string>([
    ["au", "Australia"],
    ["aus", "Australia"],
    ["australia", "Australia"],
    ["uk", "United Kingdom"],
    ["united kingdom", "United Kingdom"],
    ["usa", "United States"],
    ["us", "United States"],
    ["united states", "United States"],
    ["nz", "New Zealand"],
    ["new zealand", "New Zealand"],
  ]);

  return aliases.get(trimmed.toLowerCase()) ?? trimmed;
}

function normalizeInstitutionAndCountry(
  institutionValue: string,
  countryValue: string,
) {
  const explicitCountry = normalizeCountry(countryValue);
  const normalizedInstitution = institutionValue.trim();
  const lowerInstitution = normalizedInstitution.toLowerCase();
  const countryFromInstitution = countries.find((country) =>
    lowerInstitution.endsWith(`, ${country.toLowerCase()}`),
  );

  if (!countryFromInstitution) {
    return {
      country: explicitCountry,
      institution: normalizedInstitution,
    };
  }

  return {
    country: explicitCountry || countryFromInstitution,
    institution: normalizedInstitution
      .slice(0, -`, ${countryFromInstitution}`.length)
      .trim(),
  };
}

export function normalizeQualificationLevel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const exact = TERTIARY_LEVEL_OPTIONS.find(
    (level) => level.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  for (const { pattern, level } of LEVEL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return level;
    }
  }

  return "";
}

function parseMonthYear(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { month: "", year: "" };
  }

  const month = normalizeMonth(trimmed);
  const year = normalizeYear(trimmed);

  if (month && year) {
    return { month, year };
  }

  const monthYearMatch = trimmed.match(
    /\b(?:\d{1,2}\s+)?([A-Za-z]{3,9})\s+((?:19|20)\d{2})\b/,
  );
  if (monthYearMatch) {
    return {
      month: normalizeMonth(monthYearMatch[1]) || month,
      year: monthYearMatch[2] || year,
    };
  }

  return { month, year };
}

type CompletionState = "completed" | "in_progress" | "terminal_incomplete";

function classifyCompletionStatus(completionStatus: string): CompletionState | undefined {
  const normalized = completionStatus.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("excluded") ||
    normalized.includes("requirements incomplete") ||
    normalized.includes("requirements not completed") ||
    normalized.includes("no qualification achieved") ||
    normalized.includes("not completed") ||
    normalized.includes("not awarded") ||
    normalized.includes("not conferred") ||
    normalized.includes("discontinued") ||
    normalized.includes("withdrawn") ||
    normalized.includes("incomplete")
  ) {
    return "terminal_incomplete";
  }

  if (
    normalized.includes("in progress") ||
    normalized.includes("in_progress") ||
    normalized.includes("currently enrolled") ||
    normalized.includes("current enrolment") ||
    normalized.includes("active enrolment")
  ) {
    return "in_progress";
  }

  if (
    normalized.includes("completed") ||
    normalized.includes("graduated") ||
    normalized.includes("awarded") ||
    normalized.includes("conferred") ||
    normalized.includes("qualification achieved")
  ) {
    return "completed";
  }

  return undefined;
}

export function mapExtractedDataToQualification(
  extractedData: TranscriptExtractedData,
): TertiaryQualificationFieldDraft {
  const { country, institution } = normalizeInstitutionAndCountry(
    readFieldValue(extractedData.applicantDetails?.institutionName),
    readFieldValue(extractedData.applicantDetails?.countryOfInstitution),
  );
  const courseName = readFieldValue(extractedData.studyDetails?.programName);
  const level =
    normalizeQualificationLevel(
      readFieldValue(extractedData.studyDetails?.highestEducationLevel),
    ) ||
    normalizeQualificationLevel(
      extractedData.studyDetails?.highestEducationLevel?.originalValue ?? "",
    ) ||
    normalizeQualificationLevel(courseName);

  const start = parseMonthYear(readFieldValue(extractedData.studyDetails?.startDate));
  const completionStatus = readFieldValue(extractedData.studyDetails?.completionStatus);
  const completionState = classifyCompletionStatus(completionStatus);
  const completed = completionState === "completed"
    ? true
    : completionState
      ? false
      : undefined;
  const completionDate = readFieldValue(extractedData.studyDetails?.completionDate);
  const studyEndDate = readFieldValue(extractedData.studyDetails?.studyEndDate);
  const expectedCompletionDate = readFieldValue(
    extractedData.studyDetails?.expectedCompletionDate,
  );
  const endSource = (() => {
    if (completionState === "completed") {
      return completionDate || studyEndDate;
    }

    if (completionState === "terminal_incomplete") {
      return studyEndDate || completionDate || expectedCompletionDate;
    }

    if (completionState === "in_progress") {
      return expectedCompletionDate || studyEndDate;
    }

    return completionDate || studyEndDate || expectedCompletionDate;
  })();
  const end = parseMonthYear(endSource);

  return {
    institution,
    country,
    level,
    courseName,
    startMonth: start.month,
    startYear: start.year,
    completed: completed ?? true,
    endMonth: end.month,
    endYear: end.year,
  };
}

export function isQualificationCoreEmpty(
  qualification: Pick<
    TertiaryQualification,
  | "institution"
  | "country"
  | "level"
  | "courseName"
  | "startMonth"
  | "startYear"
  | "endMonth"
  | "endYear"
  >,
) {
  return (
    !qualification.institution.trim() &&
    !qualification.level &&
    !qualification.courseName.trim() &&
    !qualification.startMonth &&
    !qualification.startYear &&
    !qualification.endMonth &&
    !qualification.endYear
  );
}

function isFieldEmpty(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return false;
  }

  return !value?.trim();
}

export function mergeQualificationDraft(
  existing: TertiaryQualification,
  draft: TertiaryQualificationFieldDraft,
): TertiaryQualification {
  const merged: TertiaryQualification = { ...existing };

  if (isFieldEmpty(existing.institution) && draft.institution) {
    merged.institution = draft.institution;
  }
  if (isFieldEmpty(existing.country) && draft.country) {
    merged.country = draft.country;
  } else if (
    draft.country &&
    existing.country === "Australia" &&
    draft.country !== "Australia" &&
    isQualificationCoreEmpty(existing)
  ) {
    merged.country = draft.country;
  }
  if (isFieldEmpty(existing.level) && draft.level) {
    merged.level = draft.level;
  }
  if (isFieldEmpty(existing.courseName) && draft.courseName) {
    merged.courseName = draft.courseName;
  }
  if (isFieldEmpty(existing.startMonth) && draft.startMonth) {
    merged.startMonth = draft.startMonth;
  }
  if (isFieldEmpty(existing.startYear) && draft.startYear) {
    merged.startYear = draft.startYear;
  }
  if (isFieldEmpty(existing.endMonth) && draft.endMonth) {
    merged.endMonth = draft.endMonth;
  }
  if (isFieldEmpty(existing.endYear) && draft.endYear) {
    merged.endYear = draft.endYear;
  }

  if (isQualificationCoreEmpty(existing) && draft.completed !== undefined) {
    merged.completed = draft.completed;
  }

  return merged;
}

export function applyTranscriptQualificationDraft(
  existing: TertiaryQualification,
  draft: TertiaryQualificationFieldDraft,
): TertiaryQualification {
  return {
    ...existing,
    institution: draft.institution,
    country: draft.country || existing.country,
    level: draft.level,
    courseName: draft.courseName,
    startMonth: draft.startMonth,
    startYear: draft.startYear,
    completed: draft.completed ?? existing.completed,
    endMonth: draft.endMonth,
    endYear: draft.endYear,
  };
}

export function mergeQualificationFromTranscriptParse(
  existing: TertiaryQualification,
  draft: TertiaryQualificationFieldDraft,
) {
  if (isQualificationCoreEmpty(existing)) {
    return mergeQualificationDraft(existing, draft);
  }

  return applyTranscriptQualificationDraft(existing, draft);
}

export function qualificationFieldDraftDiffers(
  existing: Pick<
    TertiaryQualification,
    | "institution"
    | "country"
    | "level"
    | "courseName"
    | "startMonth"
    | "startYear"
    | "completed"
    | "endMonth"
    | "endYear"
  >,
  draft: TertiaryQualificationFieldDraft,
) {
  const country = draft.country || existing.country;

  return (
    existing.institution.trim() !== draft.institution.trim() ||
    existing.country !== country ||
    existing.level !== draft.level ||
    existing.courseName.trim() !== draft.courseName.trim() ||
    existing.startMonth !== draft.startMonth ||
    existing.startYear !== draft.startYear ||
    existing.completed !== (draft.completed ?? existing.completed) ||
    existing.endMonth !== draft.endMonth ||
    existing.endYear !== draft.endYear
  );
}

export function countQualificationDraftUpdates(
  before: TertiaryQualification,
  after: TertiaryQualification,
) {
  let count = 0;

  if (before.institution.trim() !== after.institution.trim()) count += 1;
  if (before.country !== after.country) count += 1;
  if (before.level !== after.level) count += 1;
  if (before.courseName.trim() !== after.courseName.trim()) count += 1;
  if (before.startMonth !== after.startMonth || before.startYear !== after.startYear) {
    count += 1;
  }
  if (before.endMonth !== after.endMonth || before.endYear !== after.endYear) {
    count += 1;
  }
  if (before.completed !== after.completed) count += 1;

  return count;
}

export function clearTertiaryQualificationFromTranscript(
  qualification: TertiaryQualification,
): TertiaryQualification {
  return {
    ...qualification,
    institution: "",
    country: "Australia",
    level: "",
    courseName: "",
    startMonth: "",
    startYear: "",
    completed: true,
    endMonth: "",
    endYear: "",
    transcriptDocument: undefined,
    transcriptDocumentName: undefined,
    transcriptEligibility: undefined,
  };
}

export function countDraftedFields(draft: TertiaryQualificationFieldDraft) {
  return [
    draft.institution,
    draft.country,
    draft.level,
    draft.courseName,
    draft.startMonth && draft.startYear ? "start" : "",
    draft.endMonth && draft.endYear ? "end" : "",
  ].filter(Boolean).length;
}
