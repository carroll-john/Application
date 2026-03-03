import { describe, expect, it } from "vitest";
import { createSeededLocalApplicantProfile } from "./applicantProfileStore";

describe("applicantProfileStore", () => {
  it("seeds a stable local profile from a company email", () => {
    expect(
      createSeededLocalApplicantProfile("john.carroll@keypathedu.com.au"),
    ).toEqual({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      id: "local-profile:john.carroll@keypathedu.com.au",
      lastName: "Carroll",
    });
  });

  it("collapses aliases and separators into sensible name defaults", () => {
    expect(
      createSeededLocalApplicantProfile("jane_mary-smith+demo@keypathedu.com.au"),
    ).toEqual({
      email: "jane_mary-smith+demo@keypathedu.com.au",
      firstName: "Jane",
      id: "local-profile:jane_mary-smith+demo@keypathedu.com.au",
      lastName: "Mary Smith",
    });
  });

  it("keeps single-token emails usable", () => {
    expect(
      createSeededLocalApplicantProfile("operations@keypathedu.com.au"),
    ).toEqual({
      email: "operations@keypathedu.com.au",
      firstName: "Operations",
      id: "local-profile:operations@keypathedu.com.au",
      lastName: "",
    });
  });
});
