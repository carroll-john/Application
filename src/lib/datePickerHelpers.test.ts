import { describe, expect, it } from "vitest";
import {
  getBirthDateOpenToDate,
  getYearRange,
  getYearStart,
  parseIsoDate,
  sameDateValue,
  toIsoDate,
} from "./datePickerHelpers";

describe("datePickerHelpers", () => {
  it("parses valid ISO dates and rejects invalid ones", () => {
    expect(parseIsoDate("1990-03-19")).toEqual(new Date(1990, 2, 19));
    expect(parseIsoDate("1990-02-30")).toBeNull();
    expect(parseIsoDate("19/03/1990")).toBeNull();
  });

  it("formats dates back to ISO strings", () => {
    expect(toIsoDate(new Date(1990, 2, 19))).toBe("1990-03-19");
  });

  it("builds descending year ranges", () => {
    expect(getYearRange(2026, 2024)).toEqual(["2026", "2025", "2024"]);
  });

  it("opens empty month/year pickers at the start of the year", () => {
    expect(getYearStart(new Date(2026, 2, 10))).toEqual(new Date(2026, 0, 1));
  });

  it("opens birth-date pickers on a more useful adult reference year", () => {
    expect(getBirthDateOpenToDate(new Date(2026, 2, 10))).toEqual(
      new Date(2008, 0, 1),
    );
  });

  it("compares picker dates by their actual stored value", () => {
    expect(sameDateValue(new Date(2020, 6, 1), new Date(2020, 6, 1))).toBe(
      true,
    );
    expect(sameDateValue(new Date(2020, 6, 1), new Date(2021, 6, 1))).toBe(
      false,
    );
    expect(sameDateValue(null, null)).toBe(true);
  });
});
