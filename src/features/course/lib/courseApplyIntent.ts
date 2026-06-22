/**
 * Single source of truth for the "auto-apply" deep link used to resume an
 * eligible applicant into their course application after an auth round-trip
 * (e.g. clicking an email verification link). The redirect builder and the
 * predicate that triggers the auto-apply flow must stay in lock-step, so they
 * live together here.
 */

export function buildCourseApplyRedirectPath(courseCode: string) {
  return `/courses/${courseCode}?apply=1&eligible=1`;
}

export function hasAutoApplyIntent(searchParams: URLSearchParams) {
  return (
    searchParams.get("apply") === "1" && searchParams.get("eligible") === "1"
  );
}
