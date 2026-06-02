import { findSentence, sanitizeText } from "./text";
import type { RawCourseEntry } from "./types";

const SUPPORT_OPTION_ORDER = ["CSP", "FEE-HELP", "HECS-HELP"] as const;
const FULL_TIME_UNITS_PER_YEAR = 8;
const MAX_REASONABLE_ANNUAL_FEE = 100_000;
const MAX_REASONABLE_TOTAL_FEE = 250_000;

export interface FeeSummary {
  feeSummary: string | undefined;
  supportSummary: string | undefined;
  supportOptions: string[];
  feeNotes: string[];
}

function normalizeMoneyDisplay(value: string) {
  return value
    .replace(/\b(?:AUD|AU\$)\s*/gi, "$")
    .replace(/\s*[–-]\s*/g, "–")
    .replace(/(\d)\.00\b/g, "$1")
    .trim();
}

function extractMoneyValue(value: string) {
  const match = value.match(
    /(?:AUD|AU\$|\$)\s*\d[\d,]*(?:\.\d+)?(?:\s*[–-]\s*(?:AUD|AU\$|\$)?\s*\d[\d,]*(?:\.\d+)?)?/i,
  );

  return match ? normalizeMoneyDisplay(match[0]) : "";
}

function parseMoneyAmount(value: string) {
  const normalized = extractMoneyValue(value);

  if (!normalized) {
    return null;
  }

  const numeric = normalized.match(/\$([\d,]+(?:\.\d+)?)/);

  if (!numeric?.[1]) {
    return null;
  }

  return Number.parseFloat(numeric[1].replace(/,/g, ""));
}

function formatCurrencyAmount(value: number) {
  return new Intl.NumberFormat("en-AU", {
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function extractRateAmount(value: string, rate: "unit" | "subject") {
  if (!value) {
    return "";
  }

  const beforeRatePattern = new RegExp(
    `((?:AUD|AU\\$|\\$)\\s*\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:per|/)\\s*${rate}s?\\b`,
    "ig",
  );
  const beforeRateMatches = [...value.matchAll(beforeRatePattern)];

  if (beforeRateMatches.length > 0) {
    const amount = beforeRateMatches[beforeRateMatches.length - 1]?.[1];
    return amount ? normalizeMoneyDisplay(amount) : "";
  }

  const afterRatePattern = new RegExp(
    `(?:per|/)\\s*${rate}s?\\b[^$\\d]{0,24}((?:AUD|AU\\$|\\$)\\s*\\d[\\d,]*(?:\\.\\d+)?)`,
    "ig",
  );
  const afterRateMatch = afterRatePattern.exec(value);

  if (afterRateMatch?.[1]) {
    return normalizeMoneyDisplay(afterRateMatch[1]);
  }

  return "";
}

function hasOutlierFeeSummary(feeSummary: string) {
  const amount = parseMoneyAmount(feeSummary);

  if (!amount) {
    return false;
  }

  if (/\btotal\b/i.test(feeSummary)) {
    return amount > MAX_REASONABLE_TOTAL_FEE;
  }

  return amount > MAX_REASONABLE_ANNUAL_FEE;
}

/**
 * Derives a display fee summary, support-option list, and explanatory notes
 * from a course's free-text `tuition_fees` and `fee_help_eligibility`.
 */
export function buildFeeSummary(course: RawCourseEntry): FeeSummary {
  const tuition = sanitizeText(course.tuition_fees);
  const feeHelp = sanitizeText(course.fee_help_eligibility);

  if (!tuition && !feeHelp) {
    return {
      feeSummary: undefined,
      supportSummary: undefined,
      supportOptions: [] as string[],
      feeNotes: [] as string[],
    };
  }

  const perUnitSentence = findSentence(tuition, /\bper unit\b/i);
  const perSubjectSentence = findSentence(tuition, /\bper subject\b/i);
  const perUnitAmount = extractRateAmount(perUnitSentence, "unit") || extractMoneyValue(perUnitSentence);
  const perSubjectAmount =
    extractRateAmount(perSubjectSentence, "subject") || extractMoneyValue(perSubjectSentence);
  const perUnitValue = parseMoneyAmount(perUnitAmount || perUnitSentence);
  const perSubjectValue = parseMoneyAmount(perSubjectAmount || perSubjectSentence);
  const totalAmount = extractMoneyValue(
    findSentence(
      tuition,
      /\b(total (?:course |program )?(?:cost|fees?)|approximate total|estimated total|total tuition fees)\b/i,
    ),
  );
  const rangeAmount = extractMoneyValue(findSentence(tuition, /\b(range|ranges?)\b/i));
  const cspAmount = extractMoneyValue(
    findSentence(tuition, /\b(commonwealth supported|student contribution|csp)\b/i),
  );
  const annualAmount = extractMoneyValue(
    findSentence(
      tuition,
      /\b(annual fee|annual indicative fees|1 yr full-time|first-year fee|first year|per 120 credit points|per year)\b/i,
    ),
  );
  const anyAmount = extractMoneyValue(tuition);

  let feeSummary = "";
  const feeNotes: string[] = [];
  const supportOptions: string[] = [];
  const hasCommonwealthSupport = /\b(commonwealth supported|csp)\b/i.test(tuition);

  if (perUnitAmount) {
    feeSummary = perUnitValue
      ? `Approx. ${formatCurrencyAmount(perUnitValue * FULL_TIME_UNITS_PER_YEAR)} per year`
      : `Approx. ${perUnitAmount} per unit`;
    feeNotes.push("Based on a full-time load of 8 units per year.");
    if (totalAmount) {
      feeNotes.push(`Approx. ${totalAmount} total for the full course.`);
    }
  } else if (perSubjectAmount) {
    feeSummary = perSubjectValue
      ? `Approx. ${formatCurrencyAmount(perSubjectValue * FULL_TIME_UNITS_PER_YEAR)} per year`
      : `Approx. ${perSubjectAmount} per subject`;
    feeNotes.push("Based on a full-time load of 8 subjects per year.");
    if (rangeAmount) {
      feeNotes.push(`Approx. ${rangeAmount} total, depending on subject count.`);
    } else if (totalAmount) {
      feeNotes.push(`Approx. ${totalAmount} total for the full course.`);
    }
  } else if (cspAmount && annualAmount && cspAmount !== annualAmount) {
    feeSummary = `Approx. ${annualAmount} per year`;
  } else if (cspAmount) {
    feeSummary = `Approx. ${cspAmount} per year`;
  } else if (totalAmount) {
    feeSummary = `Approx. ${totalAmount} total`;
  } else if (rangeAmount) {
    feeSummary = `Approx. ${rangeAmount} total`;
  } else if (annualAmount) {
    feeSummary = `Approx. ${annualAmount} per year`;
  } else if (anyAmount) {
    feeSummary = `Approx. ${anyAmount}`;
  } else if (feeHelp) {
    feeSummary = "Contact provider for current fees";
  }

  const supportSignals = new Set<string>();

  if (hasCommonwealthSupport) {
    supportSignals.add("CSP");
  }

  if (/\bfee-help\b/i.test(`${tuition} ${feeHelp}`)) {
    supportSignals.add("FEE-HELP");
  }

  if (/\bhecs-help\b/i.test(`${tuition} ${feeHelp}`)) {
    supportSignals.add("HECS-HELP");
  }

  supportOptions.push(
    ...SUPPORT_OPTION_ORDER.filter((option) => supportSignals.has(option)),
  );

  const supportSummary = supportOptions.join(" · ");

  if (/ssaf|student services and amenities fee/i.test(tuition)) {
    feeNotes.push("Student services fees may apply.");
  }

  if (/additional costs|study tours|travel|accommodation/i.test(tuition)) {
    feeNotes.push("Additional study or travel costs may apply.");
  }

  if (/scholarship|discount|rebate|alumni/i.test(tuition)) {
    feeNotes.push("Scholarships or discounts may be available.");
  }

  if (feeSummary && hasOutlierFeeSummary(feeSummary)) {
    feeSummary = "Contact provider for current fees";
    feeNotes.push("Published fee data varies; confirm current pricing with the provider.");
  }

  return {
    feeSummary: feeSummary || undefined,
    supportSummary: supportSummary || undefined,
    supportOptions,
    feeNotes,
  };
}
