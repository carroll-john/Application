export const BILL_SHORTEN_UC_DEMO_COURSES = [
  {
    creditConfidence: "high",
    creditPoints: 6,
    title: "Master of Education (Leadership)",
  },
  {
    creditConfidence: "medium",
    creditPoints: 6,
    title: "Master of Education (STEM)",
  },
  {
    creditConfidence: "medium",
    creditPoints: 0,
    title: "Graduate Certificate in Educational Leadership",
  },
] as const;

function normalizeDemoIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isBillShortenUcDemoName(value: string) {
  const tokens = new Set(normalizeDemoIdentity(value).split(" ").filter(Boolean));
  return tokens.has("shorten") && (tokens.has("bill") || tokens.has("william"));
}
