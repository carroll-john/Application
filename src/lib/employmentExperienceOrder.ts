import type { EmploymentExperience } from "./applicationData";

const MONTH_INDEX = new Map(
  [
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
  ].flatMap((month, index) => {
    const monthNumber = index + 1;
    const normalizedMonth = month.toLowerCase();

    return [
      [normalizedMonth, monthNumber] as const,
      [normalizedMonth.slice(0, 3), monthNumber] as const,
      [String(monthNumber), monthNumber] as const,
      [String(monthNumber).padStart(2, "0"), monthNumber] as const,
    ];
  }),
);

function monthYearKey(month: string, year: string) {
  const normalizedYearText = year.trim();
  const normalizedYear = Number.parseInt(normalizedYearText, 10);

  if (!/^\d{4}$/.test(normalizedYearText) || !Number.isFinite(normalizedYear)) {
    return null;
  }

  const normalizedMonth = MONTH_INDEX.get(month.trim().toLowerCase()) ?? 0;
  return normalizedYear * 12 + normalizedMonth;
}

function mostRecentDateKey(experience: EmploymentExperience) {
  if (experience.currentRole) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    monthYearKey(experience.endMonth, experience.endYear) ??
    monthYearKey(experience.startMonth, experience.startYear) ??
    Number.NEGATIVE_INFINITY
  );
}

function startDateKey(experience: EmploymentExperience) {
  return (
    monthYearKey(experience.startMonth, experience.startYear) ??
    Number.NEGATIVE_INFINITY
  );
}

function compareDescending(left: number, right: number) {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
}

/**
 * Returns employment history in reverse chronological order without mutating
 * the persisted collection. Current roles come first, followed by completed
 * roles ordered by end date. Start date breaks ties between overlapping roles.
 */
export function orderEmploymentExperiencesByMostRecent(
  experiences: readonly EmploymentExperience[],
) {
  return experiences
    .map((experience, originalIndex) => ({ experience, originalIndex }))
    .sort((left, right) => {
      const mostRecentDifference = compareDescending(
        mostRecentDateKey(left.experience),
        mostRecentDateKey(right.experience),
      );

      if (mostRecentDifference !== 0) {
        return mostRecentDifference;
      }

      const startDateDifference = compareDescending(
        startDateKey(left.experience),
        startDateKey(right.experience),
      );

      return startDateDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ experience }) => experience);
}
