import { format } from "date-fns";

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getYearRange(maxYear: number, minYear = 1900) {
  const years: string[] = [];

  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(String(year));
  }

  return years;
}

export function getYearStart(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), 0, 1);
}

export function getBirthDateOpenToDate(referenceDate: Date) {
  return new Date(referenceDate.getFullYear() - 18, 0, 1);
}

export function sameDateValue(left: Date | null, right: Date | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}
