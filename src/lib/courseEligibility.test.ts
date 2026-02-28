import { describe, expect, it } from "vitest";
import { isEligibleForMbaCourse } from "./courseEligibility";

describe("isEligibleForMbaCourse", () => {
  it("rejects applicants with less than two years of experience and below a bachelor degree", () => {
    expect(
      isEligibleForMbaCourse({
        education: "High school",
        experience: "Less than 2 years",
      }),
    ).toBe(false);
  });

  it("accepts applicants with a bachelor degree even with low experience", () => {
    expect(
      isEligibleForMbaCourse({
        education: "Bachelor degree",
        experience: "Less than 2 years",
      }),
    ).toBe(true);
  });

  it("accepts applicants with enough experience even without a bachelor degree", () => {
    expect(
      isEligibleForMbaCourse({
        education: "Diploma",
        experience: "2-5 years",
      }),
    ).toBe(true);
  });
});
