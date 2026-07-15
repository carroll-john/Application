import type { WorkExperienceParams } from "./requirements.js";

export const WORK_EXPERIENCE_ASSESSMENT_SCHEMA_VERSION =
  "work-experience-assessment@v1" as const;

export type WorkExperienceAssessmentStatus =
  | "provisionally_met"
  | "possibly_met"
  | "not_demonstrated"
  | "needs_review";

export type WorkExperienceRelevanceStatus =
  | "relevant"
  | "possibly_relevant"
  | "not_demonstrated";

export type WorkExperienceRoleCriteriaStatus =
  | "met"
  | "possibly_met"
  | "not_demonstrated"
  | "not_required";

export interface WorkExperienceRoleInput {
  id: string;
  position: string;
  duties: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  currentRole: boolean;
}

export interface WorkExperienceRoleClassification {
  employmentExperienceId: string;
  relevanceStatus: WorkExperienceRelevanceStatus;
  roleCriteriaStatus: WorkExperienceRoleCriteriaStatus;
  confidence: number;
  explanation: string;
  evidencePhrases: string[];
}

export interface WorkExperienceRoleAssessment
  extends WorkExperienceRoleClassification {
  durationMonthsMinimum: number;
  durationMonthsMaximum: number;
  countedMonthsMinimum: number;
  countedMonthsMaximum: number;
}

export interface WorkExperienceAssessment {
  requirementId: string;
  status: WorkExperienceAssessmentStatus;
  requiredMonths: number;
  qualifyingMonthsMinimum: number;
  qualifyingMonthsMaximum: number;
  roleCriteriaMonthsMinimum?: number;
  roleCriteriaMonthsMaximum?: number;
  roleAssessments: WorkExperienceRoleAssessment[];
  unassessedConditions: string[];
  inputFingerprint: string;
  checkedAt: string;
  modelId?: string;
  promptVersion: string;
  schemaVersion: typeof WORK_EXPERIENCE_ASSESSMENT_SCHEMA_VERSION;
}

export interface BuildWorkExperienceAssessmentOptions {
  requirement: {
    id: string;
    params: WorkExperienceParams;
    sourceText: string;
  };
  roles: WorkExperienceRoleInput[];
  classifications: WorkExperienceRoleClassification[];
  checkedAt?: string;
  modelId?: string;
  promptVersion: string;
  unassessedConditions?: string[];
}

interface MonthInterval {
  end: number;
  start: number;
}

const MONTH_INDEX = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].flatMap((month, index) => [
    [month, index],
    [month.slice(0, 3), index],
    [String(index + 1), index],
    [String(index + 1).padStart(2, "0"), index],
  ]),
);

function parseYear(value: string): number | undefined {
  const year = Number.parseInt(value.trim(), 10);
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : undefined;
}

function parseMonth(value: string): number | undefined {
  const normalized = value.trim().toLowerCase();
  return normalized ? MONTH_INDEX.get(normalized) : undefined;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function roleIntervals(
  role: WorkExperienceRoleInput,
  checkedAt: Date,
): { maximum?: MonthInterval; minimum?: MonthInterval } {
  const startYear = parseYear(role.startYear);
  if (startYear == null) return {};

  const startMonth = parseMonth(role.startMonth);
  const startMinimum = monthIndex(startYear, startMonth ?? 11);
  const startMaximum = monthIndex(startYear, startMonth ?? 0);

  let endMinimum: number;
  let endMaximum: number;
  if (role.currentRole) {
    endMinimum = monthIndex(checkedAt.getUTCFullYear(), checkedAt.getUTCMonth());
    endMaximum = endMinimum;
  } else {
    const endYear = parseYear(role.endYear);
    if (endYear == null) return {};
    const endMonth = parseMonth(role.endMonth);
    endMinimum = monthIndex(endYear, endMonth ?? 0);
    endMaximum = monthIndex(endYear, endMonth ?? 11);
  }

  return {
    minimum:
      endMinimum >= startMinimum
        ? { start: startMinimum, end: endMinimum + 1 }
        : undefined,
    maximum:
      endMaximum >= startMaximum
        ? { start: startMaximum, end: endMaximum + 1 }
        : undefined,
  };
}

function intervalLength(interval?: MonthInterval): number {
  return interval ? Math.max(0, interval.end - interval.start) : 0;
}

function unionLength(intervals: MonthInterval[]): number {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  if (sorted.length === 0) return 0;

  let total = 0;
  let current = { ...sorted[0] };
  for (const interval of sorted.slice(1)) {
    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      continue;
    }
    total += current.end - current.start;
    current = { ...interval };
  }
  return total + current.end - current.start;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createWorkExperienceInputFingerprint(value: unknown): string {
  const input = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `we-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isDefiniteMatch(classification: WorkExperienceRoleClassification): boolean {
  return classification.relevanceStatus === "relevant";
}

function isPossibleMatch(classification: WorkExperienceRoleClassification): boolean {
  return classification.relevanceStatus !== "not_demonstrated";
}

export function buildWorkExperienceAssessment(
  options: BuildWorkExperienceAssessmentOptions,
): WorkExperienceAssessment {
  const checkedAt = options.checkedAt ? new Date(options.checkedAt) : new Date();
  const safeCheckedAt = Number.isNaN(checkedAt.getTime()) ? new Date() : checkedAt;
  const classificationMap = new Map(
    options.classifications.map((classification) => [
      classification.employmentExperienceId,
      classification,
    ]),
  );
  const hasRoleCriteria = Boolean(options.requirement.params.qualifyingRoleCriteria);

  const definiteMinimumIntervals: MonthInterval[] = [];
  const possibleMaximumIntervals: MonthInterval[] = [];
  const roleCriteriaMinimumIntervals: MonthInterval[] = [];
  const roleCriteriaMaximumIntervals: MonthInterval[] = [];

  const roleAssessments = options.roles.map((role): WorkExperienceRoleAssessment => {
    const classification = classificationMap.get(role.id) ?? {
      employmentExperienceId: role.id,
      relevanceStatus: "not_demonstrated" as const,
      roleCriteriaStatus: hasRoleCriteria ? ("not_demonstrated" as const) : ("not_required" as const),
      confidence: 0,
      explanation: "This role could not be assessed automatically.",
      evidencePhrases: [],
    };
    const intervals = roleIntervals(role, safeCheckedAt);
    const definite = isDefiniteMatch(classification);
    const possible = isPossibleMatch(classification);

    if (definite && intervals.minimum) definiteMinimumIntervals.push(intervals.minimum);
    if (possible && intervals.maximum) possibleMaximumIntervals.push(intervals.maximum);
    if (hasRoleCriteria) {
      if (
        classification.relevanceStatus === "relevant" &&
        classification.roleCriteriaStatus === "met" &&
        intervals.minimum
      ) {
        roleCriteriaMinimumIntervals.push(intervals.minimum);
      }
      if (
        classification.relevanceStatus !== "not_demonstrated" &&
        classification.roleCriteriaStatus !== "not_demonstrated" &&
        intervals.maximum
      ) {
        roleCriteriaMaximumIntervals.push(intervals.maximum);
      }
    }

    return {
      ...classification,
      durationMonthsMinimum: intervalLength(intervals.minimum),
      durationMonthsMaximum: intervalLength(intervals.maximum),
      countedMonthsMinimum: definite ? intervalLength(intervals.minimum) : 0,
      countedMonthsMaximum: possible ? intervalLength(intervals.maximum) : 0,
    };
  });

  const requiredMonths = Math.max(0, Math.round(options.requirement.params.minYears * 12));
  const qualifyingMonthsMinimum = unionLength(definiteMinimumIntervals);
  const qualifyingMonthsMaximum = unionLength(possibleMaximumIntervals);
  const roleCriteriaMonthsMinimum = hasRoleCriteria
    ? unionLength(roleCriteriaMinimumIntervals)
    : undefined;
  const roleCriteriaMonthsMaximum = hasRoleCriteria
    ? unionLength(roleCriteriaMaximumIntervals)
    : undefined;
  const requiredRoleCriteriaMonths = hasRoleCriteria
    ? Math.max(
        0,
        Math.round(
          (options.requirement.params.qualifyingRoleCriteria?.minYears ??
            options.requirement.params.minYears) * 12,
        ),
      )
    : 0;
  const unassessedConditions = [...new Set(options.unassessedConditions ?? [])].filter(Boolean);
  const hasRelevantRoleWithoutDates = roleAssessments.some(
    (role) =>
      role.relevanceStatus !== "not_demonstrated" && role.durationMonthsMaximum === 0,
  );

  const definitelyMeets =
    qualifyingMonthsMinimum >= requiredMonths &&
    (!hasRoleCriteria || (roleCriteriaMonthsMinimum ?? 0) >= requiredRoleCriteriaMonths);
  const possiblyMeets =
    qualifyingMonthsMaximum >= requiredMonths &&
    (!hasRoleCriteria || (roleCriteriaMonthsMaximum ?? 0) >= requiredRoleCriteriaMonths);

  const status: WorkExperienceAssessmentStatus =
    unassessedConditions.length > 0 || hasRelevantRoleWithoutDates
      ? "needs_review"
      : definitelyMeets
        ? "provisionally_met"
        : possiblyMeets
          ? "possibly_met"
          : "not_demonstrated";

  const fingerprintInput = {
    asOfMonth: safeCheckedAt.toISOString().slice(0, 7),
    requirement: options.requirement,
    roles: options.roles,
  };

  return {
    requirementId: options.requirement.id,
    status,
    requiredMonths,
    qualifyingMonthsMinimum,
    qualifyingMonthsMaximum,
    ...(hasRoleCriteria
      ? { roleCriteriaMonthsMinimum, roleCriteriaMonthsMaximum }
      : {}),
    roleAssessments,
    unassessedConditions,
    inputFingerprint: createWorkExperienceInputFingerprint(fingerprintInput),
    checkedAt: safeCheckedAt.toISOString(),
    modelId: options.modelId,
    promptVersion: options.promptVersion,
    schemaVersion: WORK_EXPERIENCE_ASSESSMENT_SCHEMA_VERSION,
  };
}
