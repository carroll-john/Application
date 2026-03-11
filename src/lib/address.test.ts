import { describe, expect, it } from "vitest";
import {
  createEmptyStructuredAddress,
  formatStructuredAddress,
} from "./address";

describe("formatStructuredAddress", () => {
  it("prefixes a separate unit number onto a manual formatted address", () => {
    expect(
      formatStructuredAddress({
        ...createEmptyStructuredAddress(),
        formattedAddress: "68 Barringo Way, Caroline Springs VIC 3023",
        unitNumber: "12B",
      }),
    ).toBe("Unit 12B, 68 Barringo Way, Caroline Springs VIC 3023");
  });

  it("builds a structured address with a unit number from parsed fields", () => {
    expect(
      formatStructuredAddress({
        ...createEmptyStructuredAddress(),
        country: "Australia",
        postcode: "3023",
        state: "VIC",
        streetAddress: "68 Barringo Way",
        suburb: "Caroline Springs",
        unitNumber: "8",
      }),
    ).toBe("Unit 8, 68 Barringo Way, Caroline Springs VIC 3023, Australia");
  });

  it("does not duplicate the unit number when it is already part of the street line", () => {
    expect(
      formatStructuredAddress({
        ...createEmptyStructuredAddress(),
        streetAddress: "Unit 4, 20 Collins Street",
        suburb: "Melbourne",
        state: "VIC",
        postcode: "3000",
        unitNumber: "4",
      }),
    ).toBe("Unit 4, 20 Collins Street, Melbourne VIC 3000");
  });
});
