import { describe, expect, it } from "vitest";
import { isMonthYearRangeOutOfOrder } from "./monthYearValidation";

describe("monthYearValidation", () => {
  it("returns false when the range is in chronological order", () => {
    expect(
      isMonthYearRangeOutOfOrder("January", "2020", "December", "2020"),
    ).toBe(false);
  });

  it("returns false when the start and end month are the same", () => {
    expect(isMonthYearRangeOutOfOrder("July", "2020", "July", "2020")).toBe(
      false,
    );
  });

  it("returns true when the start date is after the end date", () => {
    expect(isMonthYearRangeOutOfOrder("July", "2021", "June", "2021")).toBe(
      true,
    );
  });

  it("ignores incomplete ranges", () => {
    expect(isMonthYearRangeOutOfOrder("July", "2021", "", "")).toBe(false);
  });
});
