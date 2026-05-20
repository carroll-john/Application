import { months } from "./formOptions";

function toMonthYearValue(month: string, year: string) {
  const monthIndex = months.indexOf(month);
  const yearValue = Number(year);

  if (monthIndex < 0 || Number.isNaN(yearValue)) {
    return null;
  }

  return yearValue * 12 + monthIndex;
}

export function isMonthYearRangeOutOfOrder(
  startMonth: string,
  startYear: string,
  endMonth: string,
  endYear: string,
) {
  const startValue = toMonthYearValue(startMonth, startYear);
  const endValue = toMonthYearValue(endMonth, endYear);

  if (startValue === null || endValue === null) {
    return false;
  }

  return startValue > endValue;
}
