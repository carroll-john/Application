import type { EmploymentExperience } from "./applicationData";

export interface ParsedCvEmploymentExperience {
  company: string;
  currentRole: boolean;
  duties: string;
  endMonth: string;
  endYear: string;
  position: string;
  startMonth: string;
  startYear: string;
  type: string;
}

export interface CvEmploymentParserResponse {
  experiences: ParsedCvEmploymentExperience[];
  model?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_LOOKUP = new Map<string, string>(
  MONTH_NAMES.flatMap((month, index) => {
    const numericMonth = String(index + 1);
    const paddedNumericMonth = numericMonth.padStart(2, "0");
    const normalizedMonth = month.toLowerCase();

    return [
      [normalizedMonth, month],
      [normalizedMonth.slice(0, 3), month],
      [numericMonth, month],
      [paddedNumericMonth, month],
    ];
  }),
);

const EMPLOYMENT_TYPE_LOOKUP = new Map<string, EmploymentExperience["type"]>([
  ["full time", "Full-time"],
  ["full-time", "Full-time"],
  ["permanent", "Full-time"],
  ["part time", "Part-time"],
  ["part-time", "Part-time"],
  ["contract", "Contract"],
  ["contractor", "Contract"],
  ["freelance", "Contract"],
  ["temporary", "Contract"],
  ["temp", "Contract"],
  ["casual", "Casual"],
  ["intern", "Internship"],
  ["internship", "Internship"],
]);

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeEmploymentType(
  value: string | null | undefined,
): EmploymentExperience["type"] {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  return EMPLOYMENT_TYPE_LOOKUP.get(normalized) ?? "";
}

export function normalizeMonth(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\./g, "");

  if (!normalized) {
    return "";
  }

  const yearMonthMatch = normalized.match(/\b\d{4}-(\d{1,2})\b/);

  if (yearMonthMatch?.[1]) {
    return MONTH_LOOKUP.get(yearMonthMatch[1]) ?? "";
  }

  return MONTH_LOOKUP.get(normalized) ?? "";
}

export function normalizeYear(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/\b(19|20)\d{2}\b/);

  return match?.[0] ?? "";
}

function createExperienceSignature(experience: Omit<EmploymentExperience, "id">) {
  return [
    experience.company,
    experience.position,
    experience.type,
    experience.startMonth,
    experience.startYear,
    experience.endMonth,
    experience.endYear,
    experience.currentRole ? "current" : "ended",
    experience.duties,
  ]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

export function normalizeParsedEmploymentExperience(
  experience: ParsedCvEmploymentExperience,
): EmploymentExperience | null {
  const company = normalizeWhitespace(experience.company);
  const position = normalizeWhitespace(experience.position);
  const duties = normalizeWhitespace(experience.duties);
  const currentRole = Boolean(experience.currentRole);

  if (!company && !position && !duties) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    company,
    currentRole,
    duties,
    endMonth: currentRole ? "" : normalizeMonth(experience.endMonth),
    endYear: currentRole ? "" : normalizeYear(experience.endYear),
    position,
    startMonth: normalizeMonth(experience.startMonth),
    startYear: normalizeYear(experience.startYear),
    type: normalizeEmploymentType(experience.type),
  };
}

export function normalizeParsedEmploymentExperiences(
  experiences: ParsedCvEmploymentExperience[],
) {
  const seen = new Set<string>();

  return experiences.reduce<EmploymentExperience[]>((items, experience) => {
    const normalized = normalizeParsedEmploymentExperience(experience);

    if (!normalized) {
      return items;
    }

    const signature = createExperienceSignature({
      company: normalized.company,
      currentRole: normalized.currentRole,
      duties: normalized.duties,
      endMonth: normalized.endMonth,
      endYear: normalized.endYear,
      position: normalized.position,
      startMonth: normalized.startMonth,
      startYear: normalized.startYear,
      type: normalized.type,
    });

    if (seen.has(signature)) {
      return items;
    }

    seen.add(signature);
    items.push(normalized);
    return items;
  }, []);
}
