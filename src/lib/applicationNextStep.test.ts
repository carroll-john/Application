import { describe, expect, it } from "vitest";
import { initialApplicationData } from "./applicationData";
import { getNextIncompleteSection } from "./applicationNextStep";

describe("getNextIncompleteSection", () => {
  it("keeps applicant-profile seed data from skipping the real section 1 requirements", () => {
    expect(
      getNextIncompleteSection({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          firstName: "Alex",
          lastName: "Nguyen",
          email: "alex@example.com",
          phone: "0400000000",
        },
      }),
    ).toBe("Basic information");
  });

  it("moves to personal contact details until gender and date of birth are captured", () => {
    expect(
      getNextIncompleteSection({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          title: "Mr",
          firstName: "Alex",
          lastName: "Nguyen",
          email: "alex@example.com",
          phone: "0400000000",
        },
      }),
    ).toBe("Personal contact details");
  });

  it("returns null once the core section 2 submission rule is satisfied", () => {
    expect(
      getNextIncompleteSection({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          title: "Ms",
          firstName: "Alex",
          lastName: "Nguyen",
          gender: "Female",
          dateOfBirth: "2000-01-01",
          email: "alex@example.com",
          phone: "0400000000",
        },
        contactDetails: {
          ...initialApplicationData.contactDetails,
          citizenshipStatus: "Citizen",
          residentialAddress: {
            ...initialApplicationData.contactDetails.residentialAddress,
            formattedAddress: "1 Test St",
          },
        },
        tertiaryQualifications: [
          {
            id: "t1",
            institution: "Uni",
            country: "Australia",
            level: "Bachelor",
            courseName: "Business",
            startMonth: "January",
            startYear: "2020",
            completed: true,
            endMonth: "December",
            endYear: "2022",
          },
        ],
      }),
    ).toBeNull();
  });
});
