export interface AcademicUnitResultInput {
  counted?: boolean | null;
  creditPoints?: number | string | null;
  grade?: string | null;
  mark?: number | string | null;
  notes?: string | null;
  title?: string | null;
  unitCode?: string | null;
}

export interface WamCalculationResult {
  includedUnitCount: number;
  totalCreditPoints: number;
  totalWeightedPoints: number;
  wam: number;
}

const NON_WAM_GRADE_PATTERN =
  /\b(?:rpl|ex|cpl|credit\s+transfer|advanced\s+standing|exempt(?:ion|ed)?|withdrawn|wdn|wdr|in\s+progress|not\s+finalised|not\s+finalized)\b/i;

function parseFiniteNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isExcludedUnitResult(unit: AcademicUnitResultInput): boolean {
  if (unit.counted === false) {
    return true;
  }

  const gradeAndNotes = [unit.grade, unit.notes].filter(Boolean).join(" ");
  return NON_WAM_GRADE_PATTERN.test(gradeAndNotes);
}

export function calculateWamFromUnitResults(
  units: readonly AcademicUnitResultInput[] | undefined,
): WamCalculationResult | undefined {
  if (!units || units.length === 0) {
    return undefined;
  }

  let includedUnitCount = 0;
  let totalCreditPoints = 0;
  let totalWeightedPoints = 0;

  for (const unit of units) {
    if (!unit || isExcludedUnitResult(unit)) {
      continue;
    }

    const creditPoints = parseFiniteNumber(unit.creditPoints);
    const mark = parseFiniteNumber(unit.mark);

    if (
      creditPoints === undefined ||
      creditPoints <= 0 ||
      mark === undefined ||
      mark < 0 ||
      mark > 100
    ) {
      continue;
    }

    includedUnitCount += 1;
    totalCreditPoints += creditPoints;
    totalWeightedPoints += mark * creditPoints;
  }

  if (includedUnitCount === 0 || totalCreditPoints <= 0) {
    return undefined;
  }

  return {
    includedUnitCount,
    totalCreditPoints,
    totalWeightedPoints,
    wam: totalWeightedPoints / totalCreditPoints,
  };
}

export interface ResolvedComparableWam {
  explanationLead: string;
  source: "calculated" | "extracted" | "gpa_mapped";
  wam: number;
}

/**
 * Resolves the WAM used for threshold comparison. Counted unit marks are authoritative when
 * present; extracted transcript aggregates and GPA mapping are fallbacks only.
 */
export function resolveComparableWam(options: {
  calculatedWam?: WamCalculationResult;
  extractedWam?: number;
  gpaScale?: number;
  gpaValue?: number;
  mapGpaToPercent?: (gpa: number, scale: number) => number | undefined;
}): ResolvedComparableWam | undefined {
  const { calculatedWam, extractedWam, gpaScale, gpaValue, mapGpaToPercent } = options;

  if (calculatedWam) {
    return {
      explanationLead: `Calculated WAM ${calculatedWam.wam.toFixed(1)} from ${calculatedWam.includedUnitCount} counted unit results (${calculatedWam.totalCreditPoints} credit points). `,
      source: "calculated",
      wam: calculatedWam.wam,
    };
  }

  if (extractedWam !== undefined) {
    return {
      explanationLead: "",
      source: "extracted",
      wam: extractedWam,
    };
  }

  if (gpaValue !== undefined && gpaScale !== undefined && gpaScale > 0) {
    const wam = mapGpaToPercent
      ? mapGpaToPercent(gpaValue, gpaScale)
      : (gpaValue / gpaScale) * 100;
    if (wam !== undefined) {
      return {
        explanationLead: `Mapped GPA ${gpaValue}/${gpaScale} to approximately ${wam.toFixed(1)}% WAM. `,
        source: "gpa_mapped",
        wam,
      };
    }
  }

  return undefined;
}

