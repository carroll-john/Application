import type { EligibilityAnswers } from "../../../lib/courseEligibility";

const PENDING_ELIGIBILITY_STORAGE_KEY =
  "application-prototype:pending-eligibility-check";

export function savePendingEligibilityCheck(
  courseCode: string,
  answers: EligibilityAnswers,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    PENDING_ELIGIBILITY_STORAGE_KEY,
    JSON.stringify({ answers, courseCode }),
  );
}

export function loadPendingEligibilityCheck(courseCode: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(
    PENDING_ELIGIBILITY_STORAGE_KEY,
  );

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      answers?: EligibilityAnswers;
      courseCode?: string;
    };

    return parsed.courseCode === courseCode && parsed.answers
      ? parsed.answers
      : null;
  } catch {
    return null;
  }
}

export function clearPendingEligibilityCheck() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_ELIGIBILITY_STORAGE_KEY);
}
