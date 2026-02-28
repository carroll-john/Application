import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type TertiaryQualification,
} from "./applicationData";
import { validateApplication } from "./applicationValidation";

function makeValidTertiaryQualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "ter-1",
    institution: "Wollongong University",
    country: "Australia",
    level: "Bachelor",
    courseName: "Performing Arts",
    startMonth: "January",
    startYear: "2020",
    completed: true,
    endMonth: "December",
    endYear: "2022",
    transcriptDocumentName: "transcript.pdf",
    certificateDocumentName: "certificate.pdf",
    ...overrides,
  };
}

function makeValidApplication(
  overrides: Partial<ApplicationData> = {},
): ApplicationData {
  return {
    ...initialApplicationData,
    personalDetails: {
      ...initialApplicationData.personalDetails,
      title: "Mr",
      firstName: "John",
      lastName: "Carroll",
      gender: "Male",
      dateOfBirth: "1990-02-03",
      email: "john.carroll@keypathedu.com.au",
      phone: "0412345678",
      ...overrides.personalDetails,
    },
    contactDetails: {
      ...initialApplicationData.contactDetails,
      citizenshipStatus: "Australian Citizen",
      language: "English",
      aboriginal: "No",
      schoolLevel: "Year 12 or equivalent",
      residentialAddress: {
        ...initialApplicationData.contactDetails.residentialAddress,
        formattedAddress: "68 Barringo Way, Caroline Springs VIC 3023",
      },
      ...overrides.contactDetails,
    },
    tertiaryQualifications:
      overrides.tertiaryQualifications ?? [makeValidTertiaryQualification()],
    employmentExperiences:
      overrides.employmentExperiences ?? initialApplicationData.employmentExperiences,
    professionalAccreditations:
      overrides.professionalAccreditations ??
      initialApplicationData.professionalAccreditations,
    secondaryQualifications:
      overrides.secondaryQualifications ?? initialApplicationData.secondaryQualifications,
    languageTests: overrides.languageTests ?? initialApplicationData.languageTests,
    cvUploaded: overrides.cvUploaded ?? false,
    cvDocument: overrides.cvDocument,
    cvFileName: overrides.cvFileName,
    applicationMeta: {
      ...initialApplicationData.applicationMeta,
      ...overrides.applicationMeta,
    },
  };
}

describe("validateApplication", () => {
  it("returns no errors for a valid application", () => {
    expect(validateApplication(makeValidApplication())).toEqual([]);
  });

  it("requires visible parent education fields when a parent count is selected", () => {
    const errors = validateApplication(
      makeValidApplication({
        tertiaryQualifications: [],
        cvUploaded: true,
        employmentExperiences: [
          {
            id: "emp-1",
            company: "Keypath",
            position: "Advisor",
            type: "Full-time",
            startMonth: "January",
            startYear: "2022",
            endMonth: "",
            endYear: "",
            currentRole: true,
            duties: "Support students",
          },
        ],
        contactDetails: {
          ...initialApplicationData.contactDetails,
          citizenshipStatus: "Australian Citizen",
          language: "English",
          aboriginal: "No",
          schoolLevel: "Year 12 or equivalent",
          residentialAddress: {
            ...initialApplicationData.contactDetails.residentialAddress,
            formattedAddress: "68 Barringo Way, Caroline Springs VIC 3023",
          },
          parentsCount: "2",
          parent1Details: "Bachelor degree",
          parent2Details: "",
        },
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Parent/Guardian 2 Education Level",
          path: "/section1/family-support?from=review",
        }),
      ]),
    );
  });

  it("requires a certificate when a tertiary qualification is marked completed", () => {
    const errors = validateApplication(
      makeValidApplication({
        tertiaryQualifications: [
          makeValidTertiaryQualification({
            certificateDocumentName: undefined,
            certificateDocument: undefined,
          }),
        ],
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Certificate of Completion",
        }),
      ]),
    );
  });

  it("requires the section 2 alternate path when no tertiary study, cv, or employment exists", () => {
    const errors = validateApplication(
      makeValidApplication({
        tertiaryQualifications: [],
        cvUploaded: false,
        employmentExperiences: [],
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subsection: "Submission requirements",
          field: "CV upload or a tertiary qualification",
        }),
        expect.objectContaining({
          subsection: "Submission requirements",
          field: "Employment experience or a tertiary qualification",
        }),
      ]),
    );
  });
});
