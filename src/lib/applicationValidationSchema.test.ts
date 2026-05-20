import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type EmploymentExperience,
  type TertiaryQualification,
} from "./applicationData";
import {
  getNextIncompleteStep,
  getSubmissionValidationIssues,
  isEmploymentExperienceChronologyValid,
  isSubmissionReady,
  isTertiaryQualificationSubmissionReady,
} from "./applicationValidationSchema";

function makeBaseApplication(
  overrides: Partial<ApplicationData> = {},
): ApplicationData {
  return {
    ...initialApplicationData,
    personalDetails: {
      ...initialApplicationData.personalDetails,
      title: "Ms",
      firstName: "Casey",
      lastName: "Nguyen",
      gender: "Female",
      dateOfBirth: "1998-02-03",
      email: "casey.nguyen@keypathedu.com.au",
      phone: "0412345678",
      ...overrides.personalDetails,
    },
    contactDetails: {
      ...initialApplicationData.contactDetails,
      citizenshipStatus: "Australian Citizen",
      residentialAddress: {
        ...initialApplicationData.contactDetails.residentialAddress,
        formattedAddress: "1 Test Street, Melbourne VIC 3000",
      },
      language: "English",
      aboriginal: "No",
      schoolLevel: "Year 12 or equivalent",
      parentsCount: "0",
      hasDisability: false,
      ...overrides.contactDetails,
    },
    tertiaryQualifications:
      overrides.tertiaryQualifications ?? initialApplicationData.tertiaryQualifications,
    employmentExperiences:
      overrides.employmentExperiences ?? initialApplicationData.employmentExperiences,
    professionalAccreditations:
      overrides.professionalAccreditations ??
      initialApplicationData.professionalAccreditations,
    secondaryQualifications:
      overrides.secondaryQualifications ?? initialApplicationData.secondaryQualifications,
    languageTests: overrides.languageTests ?? initialApplicationData.languageTests,
    cvUploaded: overrides.cvUploaded ?? initialApplicationData.cvUploaded,
    cvDocument: overrides.cvDocument,
    cvFileName: overrides.cvFileName,
    applicationMeta: {
      ...initialApplicationData.applicationMeta,
      ...overrides.applicationMeta,
    },
  };
}

function makeTertiaryQualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "ter-1",
    institution: "University of Melbourne",
    country: "Australia",
    level: "Bachelor",
    courseName: "Commerce",
    startMonth: "February",
    startYear: "2020",
    completed: true,
    endMonth: "December",
    endYear: "2022",
    transcriptDocumentName: "transcript.pdf",
    certificateDocumentName: "certificate.pdf",
    ...overrides,
  };
}

function makeEmploymentExperience(
  overrides: Partial<EmploymentExperience> = {},
): EmploymentExperience {
  return {
    id: "emp-1",
    company: "Example Co",
    position: "Coordinator",
    type: "Full-time",
    startMonth: "January",
    startYear: "2022",
    endMonth: "December",
    endYear: "2022",
    currentRole: false,
    duties: "Managed day-to-day work.",
    ...overrides,
  };
}

describe("applicationValidationSchema", () => {
  it("uses the same schema to separate step completion from submission readiness", () => {
    const data = makeBaseApplication({
      tertiaryQualifications: [
        makeTertiaryQualification({
          transcriptDocumentName: undefined,
          transcriptDocument: undefined,
        }),
      ],
    });

    expect(getNextIncompleteStep(data)).toBeNull();
    expect(isSubmissionReady(data)).toBe(false);
    expect(getSubmissionValidationIssues(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Academic Transcript",
        }),
      ]),
    );
  });

  it("derives the next incomplete step from step-scoped schema rules", () => {
    const data = makeBaseApplication({
      personalDetails: {
        ...initialApplicationData.personalDetails,
        firstName: "Casey",
        lastName: "Nguyen",
        gender: "Female",
        dateOfBirth: "1998-02-03",
        email: "casey.nguyen@keypathedu.com.au",
        phone: "0412345678",
      },
    });

    expect(getNextIncompleteStep(data)).toBe("Basic information");
  });

  it("reuses tertiary submission checks for qualification status", () => {
    expect(
      isTertiaryQualificationSubmissionReady(
        makeTertiaryQualification({
          certificateDocumentName: undefined,
          certificateDocument: undefined,
        }),
      ),
    ).toBe(false);
  });

  it("flags out-of-order qualification and employment date ranges", () => {
    const invalidQualification = makeTertiaryQualification({
      startMonth: "December",
      startYear: "2022",
      endMonth: "January",
      endYear: "2022",
    });
    const invalidEmployment = makeEmploymentExperience({
      startMonth: "June",
      startYear: "2023",
      endMonth: "May",
      endYear: "2023",
    });
    const data = makeBaseApplication({
      employmentExperiences: [invalidEmployment],
      tertiaryQualifications: [invalidQualification],
    });

    expect(isTertiaryQualificationSubmissionReady(invalidQualification)).toBe(false);
    expect(isEmploymentExperienceChronologyValid(invalidEmployment)).toBe(false);
    expect(getSubmissionValidationIssues(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Start date must be before or the same as end date",
        }),
        expect.objectContaining({
          field: "Employment 1: Start date must be before or the same as end date",
        }),
      ]),
    );
  });

  it("requires family background branches that are still unanswered", () => {
    const data = makeBaseApplication({
      contactDetails: {
        ...initialApplicationData.contactDetails,
        citizenshipStatus: "Australian Citizen",
        residentialAddress: {
          ...initialApplicationData.contactDetails.residentialAddress,
          formattedAddress: "1 Test Street, Melbourne VIC 3000",
        },
        language: "English",
        aboriginal: "No",
        schoolLevel: "Year 12 or equivalent",
        parentsCount: "",
        hasDisability: null,
      },
    });

    expect(getSubmissionValidationIssues(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Number of parents/guardians",
        }),
        expect.objectContaining({
          field: "Disability, impairment or long-term condition",
        }),
      ]),
    );
  });
});
