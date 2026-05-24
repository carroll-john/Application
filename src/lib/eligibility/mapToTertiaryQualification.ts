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
    /^([A-Za-z]+)\s+(19|20)\d{2}$/,
  );
  if (monthYearMatch) {
    return {
      month: normalizeMonth(monthYearMatch[1]) || month,
      year: normalizeYear(monthYearMatch[0]) || year,
    };
  }

  return { month, year };
}

function inferCompleted(completionStatus: string) {
  const normalized = completionStatus.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("completed") ||
    normalized.includes("graduated") ||
    normalized.includes("awarded") ||
    normalized.includes("conferred")
  ) {
    return true;
  }

  if (
    normalized.includes("in progress") ||
    normalized.includes("in_progress") ||
    normalized.includes("not completed") ||
    normalized.includes("discontinued") ||
    normalized.includes("withdrawn") ||
    normalized.includes("incomplete")
  ) {
    return false;
  }

  return undefined;
}

export function mapExtractedDataToQualification(
  extractedData: TranscriptExtractedData,
): TertiaryQualificationFieldDraft {
  const institution = readFieldValue(extractedData.applicantDetails?.institutionName);
  const country = normalizeCountry(
    readFieldValue(extractedData.applicantDetails?.countryOfInstitution),
  );
  const courseName = readFieldValue(extractedData.studyDetails?.programName);
  const level = normalizeQualificationLevel(
    readFieldValue(extractedData.studyDetails?.highestEducationLevel),
  );

  const start = parseMonthYear(readFieldValue(extractedData.studyDetails?.startDate));
  const completionStatus = readFieldValue(extractedData.studyDetails?.completionStatus);
  const completed = inferCompleted(completionStatus);
  const completionDate = readFieldValue(extractedData.studyDetails?.completionDate);
  const expectedCompletionDate = readFieldValue(
    extractedData.studyDetails?.expectedCompletionDate,
  );
  const endSource =
    completionDate ||
    (completed === false ? expectedCompletionDate : "") ||
    completionDate;
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
