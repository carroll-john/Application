import type { QualificationLevel } from "./requirements.js";

/**
 * AQF-inspired comparable qualification kinds. Ranks follow Australian Qualifications Framework
 * ordering where graduate certificate (8) sits above bachelor (7).
 */
export type AqfComparableKind =
  | "high_school"
  | "diploma"
  | "bachelor"
  | "honours"
  | "graduate_certificate"
  | "graduate_diploma"
  | "masters"
  | "doctorate";

/** Minimum AQF rank required to satisfy each catalog `QualificationLevel`. */
export const QUALIFICATION_LEVEL_MIN_RANK: Record<QualificationLevel, number> = {
  high_school: 1,
  diploma: 5,
  bachelor: 7,
  honours: 7,
  masters: 9,
  doctorate: 10,
};

export const AQF_COMPARABLE_RANK: Record<AqfComparableKind, number> = {
  high_school: 1,
  diploma: 5,
  bachelor: 7,
  honours: 7,
  graduate_certificate: 8,
  graduate_diploma: 8,
  masters: 9,
  doctorate: 10,
};

/**
 * Maps free-text or schema enum qualification labels to a comparable AQF-inspired kind.
 * Underscores in schema values (e.g. `graduate_certificate`) are normalized to spaces first.
 */
export function classifyQualificationText(value: string | undefined): AqfComparableKind | undefined {
  if (!value) {
    return undefined;
  }

  const text = value.toLowerCase().replace(/_/g, " ");

  if (text.includes("doctor") || text.includes("phd")) {
    return "doctorate";
  }
  if (text.includes("master")) {
    return "masters";
  }
  if (text.includes("graduate diploma") || text.includes("grad dip")) {
    return "graduate_diploma";
  }
  if (text.includes("graduate certificate") || text.includes("grad cert")) {
    return "graduate_certificate";
  }
  if (text.includes("honour") || text.includes("honor")) {
    return "honours";
  }
  if (text.includes("bachelor")) {
    return "bachelor";
  }
  if (text.includes("diploma")) {
    return "diploma";
  }
  if (text.includes("secondary") || text.includes("high school") || text.includes("year 12")) {
    return "high_school";
  }

  return undefined;
}

export function comparableRankForKind(kind: AqfComparableKind): number {
  return AQF_COMPARABLE_RANK[kind];
}

export function meetsQualificationLevel(
  extractedKind: AqfComparableKind,
  requiredLevel: QualificationLevel,
): boolean {
  return comparableRankForKind(extractedKind) >= QUALIFICATION_LEVEL_MIN_RANK[requiredLevel];
}

/**
 * Numeric rank for legacy deterministic rules that compare qualification text directly.
 * Returns undefined when the label cannot be mapped.
 */
export function classifyQualificationRank(value: string | undefined): number | undefined {
  const kind = classifyQualificationText(value);
  return kind ? comparableRankForKind(kind) : undefined;
}
