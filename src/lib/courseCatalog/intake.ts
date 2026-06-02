const MONTH_PATTERNS: Array<{ month: string; pattern: RegExp }> = [
  { month: "January", pattern: /\b(january|jan)\b/i },
  { month: "February", pattern: /\b(february|feb)\b/i },
  { month: "March", pattern: /\b(march|mar)\b/i },
  { month: "April", pattern: /\b(april|apr)\b/i },
  { month: "May", pattern: /\bmay\b/i },
  { month: "June", pattern: /\b(june|jun)\b/i },
  { month: "July", pattern: /\b(july|jul)\b/i },
  { month: "August", pattern: /\b(august|aug)\b/i },
  { month: "September", pattern: /\b(september|sep)\b/i },
  { month: "October", pattern: /\b(october|oct)\b/i },
  { month: "November", pattern: /\b(november|nov)\b/i },
  { month: "December", pattern: /\b(december|dec)\b/i },
];

const TERM_MONTH_FALLBACKS: Array<{ month: string; pattern: RegExp }> = [
  { month: "January", pattern: /\bsummer\b/i },
  { month: "March", pattern: /\b(term|session|semester)\s*1\b/i },
  { month: "May", pattern: /\bterm\s*2\b/i },
  { month: "July", pattern: /\b(term|session|semester)\s*2\b|\bterm\s*3\b/i },
  { month: "September", pattern: /\bterm\s*4\b/i },
  { month: "November", pattern: /\bterm\s*5\b|\bsummer\b/i },
];

/**
 * Picks a single intake label from a list of raw intake strings: prefers an
 * explicit month (with year when present), then a term/session fallback month,
 * then the first raw value, then a generic placeholder.
 */
export function normalizeIntakeLabel(intakeDates: string[]) {
  for (const intake of intakeDates) {
    for (const { month, pattern } of MONTH_PATTERNS) {
      if (pattern.test(intake)) {
        const yearMatch = intake.match(/\b(20\d{2})\b/);
        return yearMatch ? `${month} ${yearMatch[1]}` : month;
      }
    }
  }

  for (const intake of intakeDates) {
    for (const { month, pattern } of TERM_MONTH_FALLBACKS) {
      if (pattern.test(intake)) {
        return month;
      }
    }
  }

  return intakeDates[0] || "Upcoming intake";
}
