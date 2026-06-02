import { sanitizeText } from "./text";

function formatYearsValue(value: number) {
  return `${value}`;
}

function monthsToYears(months: number) {
  return Number.parseFloat((months / 12).toFixed(1));
}

/**
 * Collapses the wide range of provider duration phrasings (months/years,
 * full-time/part-time, ranges, min/max) into a single human-readable label.
 * Returns `undefined` for blank input.
 */
export function normalizeDurationLabel(rawDuration?: string | null) {
  const duration = sanitizeText(rawDuration);

  if (!duration) {
    return undefined;
  }

  const fullTimeEquivalentRangeMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*(?:to|[–-])\s*(\d+(?:\.\d+)?)\s*years?\s*full-time.*part-time equivalent/i,
  );
  if (fullTimeEquivalentRangeMatch?.[1] && fullTimeEquivalentRangeMatch?.[2]) {
    return `${fullTimeEquivalentRangeMatch[1]}-${fullTimeEquivalentRangeMatch[2]} years full-time or part-time equivalent`;
  }

  const fullTimeOrEquivalentMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*(?:full-time.*part-time equivalent|(?:or|and)\s*part-time equivalent|full-time or equivalent part-time)/i,
  );
  if (fullTimeOrEquivalentMatch?.[1]) {
    const years = Number.parseFloat(fullTimeOrEquivalentMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeAndPartTimeYearsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*full-time(?:[^\d]+(?:up to\s*)?)?(\d+(?:\.\d+)?)\s*years?\s*part-time/i,
  );
  if (fullTimeAndPartTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(fullTimeAndPartTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeAndPartTimeMonthsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*months?\s*full-time(?:[^\d]+(?:up to\s*)?)?(\d+(?:\.\d+)?)\s*months?\s*part-time/i,
  );
  if (fullTimeAndPartTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(fullTimeAndPartTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeOnlyMonthsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*months?\s*(?:\(?)(?:standard|full-time|full time)(?:\)?)/i,
  );
  if (fullTimeOnlyMonthsMatch?.[1] && /part[- ]time equivalent/i.test(duration)) {
    const years = monthsToYears(Number.parseFloat(fullTimeOnlyMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const yearsOrPartTimeEquivalentMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*\(?(?:or\s*)?part-time equivalent\)?/i,
  );
  if (yearsOrPartTimeEquivalentMatch?.[1]) {
    const years = Number.parseFloat(yearsOrPartTimeEquivalentMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const partTimeMonthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?.*part[- ]time/i);
  if (partTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(partTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years part-time`;
  }

  const partTimeYearsMatch = duration.match(/(\d+(?:\.\d+)?)\s*years?.*part[- ]time/i);
  if (partTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(partTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years part-time`;
  }

  const fullTimeMonthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?.*full[- ]time/i);
  if (fullTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(fullTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time`;
  }

  const fullTimeYearsMatch = duration.match(/(\d+(?:\.\d+)?)\s*years?.*full[- ]time/i);
  if (fullTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(fullTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years full-time`;
  }

  const monthRangeMatch = duration.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*months?/i);
  if (monthRangeMatch?.[1] && monthRangeMatch?.[2]) {
    const start = monthsToYears(Number.parseFloat(monthRangeMatch[1]));
    const end = monthsToYears(Number.parseFloat(monthRangeMatch[2]));
    return `${formatYearsValue(start)}-${formatYearsValue(end)} years`;
  }

  const monthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (monthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(monthsMatch[1]));
    return `${formatYearsValue(years)} years`;
  }

  const minimumMaximumMatch = duration.match(
    /minimum time\s*[-:]\s*(\d+(?:\.\d+)?)\s*year.*maximum time\s*[-:]\s*(\d+(?:\.\d+)?)\s*year/i,
  );
  if (minimumMaximumMatch?.[1] && minimumMaximumMatch?.[2]) {
    return `${minimumMaximumMatch[1]}-${minimumMaximumMatch[2]} years depending on study load`;
  }

  const multipleYearOptions = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*years?/gi)].map((match) =>
    Number.parseFloat(match[1] ?? "0"),
  );
  if (multipleYearOptions.length > 1) {
    const minimum = Math.min(...multipleYearOptions);
    const maximum = Math.max(...multipleYearOptions);
    if (minimum !== maximum) {
      return `${formatYearsValue(minimum)}-${formatYearsValue(maximum)} years`;
    }
  }

  return duration
    .replace(/\bPart-time\b/g, "part-time")
    .replace(/\bFull-time\b/g, "full-time");
}
