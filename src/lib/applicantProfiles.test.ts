import { describe, expect, it } from "vitest";
import {
  deriveApplicantProfileSeed,
  getApplicantDisplayName,
  hasApplicantProfile,
  type ApplicantProfileSeed,
} from "./applicantProfiles";
import { initialApplicationData } from "./applicationData";

describe("deriveApplicantProfileSeed", () => {
  it("returns null until an applicant email exists", () => {
    expect(deriveApplicantProfileSeed(initialApplicationData)).toBeNull();
  });

  it("normalizes the profile seed from application personal details", () => {
    const application = {
      ...initialApplicationData,
      personalDetails: {
        ...initialApplicationData.personalDetails,
        email: "  Test.User@Example.com ",
        firstName: " Test ",
        lastName: " User ",
        preferredName: " Tester ",
        phone: " 0400 000 000 ",
      },
    };

    expect(deriveApplicantProfileSeed(application)).toEqual<ApplicantProfileSeed>({
      email: "test.user@example.com",
      firstName: "Test",
      lastName: "User",
      preferredName: "Tester",
      phone: "0400 000 000",
    });
  });

  it("requires first name, last name, and email before treating the applicant profile as present", () => {
    expect(hasApplicantProfile(initialApplicationData)).toBe(false);

    expect(
      hasApplicantProfile({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          email: "applicant@example.com",
          firstName: "Applicant",
          lastName: "User",
        },
      }),
    ).toBe(true);
  });

  it("prefers preferred name when presenting the applicant display name", () => {
    expect(
      getApplicantDisplayName({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          firstName: "Taylor",
          lastName: "Ng",
          preferredName: "Tay",
          email: "tay@example.com",
        },
      }),
    ).toBe("Tay");
  });
});
