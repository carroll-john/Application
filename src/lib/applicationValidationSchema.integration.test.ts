import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type LanguageTest,
  type TertiaryQualification,
} from "./applicationData";
import type { UploadedDocument } from "./documentStorage";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import { getSubmissionValidationIssues } from "./applicationValidationSchema";

function makeCompletionAssessment(
  completionStatus = "Completed",
): TranscriptEligibilityAssessment {
  return {
    checkedAt: new Date().toISOString(),
    confidence: 0.9,
    extractedData: {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: completionStatus },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    recommendedNextStep: "",
    requirementsChecked: [],
  };
}

function makeRemoteDocument(
  overrides: Partial<UploadedDocument> = {},
): UploadedDocument {
  return {
    id: "doc-1",
    name: "document.pdf",
    size: 1024,
    type: "application/pdf",
    lastModified: Date.now(),
    uploadedAt: new Date().toISOString(),
    source: "remote",
    storageBucket: "application-documents",
    storagePath: "user-1/app-1/cv/doc-1-document.pdf",
    ...overrides,
  };
}

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
    transcriptDocument: makeRemoteDocument({
      id: "doc-transcript",
      name: "transcript.pdf",
      storagePath: "user-1/app-1/transcript/doc-transcript-transcript.pdf",
    }),
    certificateDocument: makeRemoteDocument({
      id: "doc-certificate",
      name: "certificate.pdf",
      storagePath: "user-1/app-1/certificate/doc-certificate-certificate.pdf",
    }),
    // A completed qualification whose transcript evidences completion needs no certificate.
    transcriptEligibility: makeCompletionAssessment(),
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
      parentsCount: "0",
      hasDisability: false,
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

function makeIeltsTest(overrides: Partial<LanguageTest> = {}): LanguageTest {
  return {
    id: "ielts-1",
    type: "IELTS",
    name: "IELTS Academic",
    year: "2025",
    overallScore: "6.5",
    listeningScore: "6",
    readingScore: "6",
    writingScore: "6",
    speakingScore: "6",
    document: makeRemoteDocument({
      id: "doc-ielts",
      name: "ielts.pdf",
      storagePath: "user-1/app-1/language/doc-ielts.pdf",
    }),
    documentName: "ielts.pdf",
    ...overrides,
  };
}

function makeMbaOnlineApplication(overrides: Partial<ApplicationData> = {}) {
  const transcriptEligibility = makeCompletionAssessment();
  transcriptEligibility.requirementsChecked = [
    {
      id: "completed-bachelor",
      requirement: "Completed bachelor",
      status: "pass",
      explanation: "Completed.",
    },
  ];

  return makeValidApplication({
    applicationMeta: {
      selectedCourse: {
        code: "mba-online",
        title: "Master of Business Administration (Online)",
        provider: "Southern Cross University",
        intake: "Upcoming intake",
      },
      ...overrides.applicationMeta,
    },
    tertiaryQualifications: [
      makeValidTertiaryQualification({
        country: "Indonesia",
        transcriptEligibility,
      }),
    ],
    ...overrides,
  });
}

describe("getSubmissionValidationIssues", () => {
  it("returns no errors for a valid application", () => {
    expect(getSubmissionValidationIssues(makeValidApplication())).toEqual([]);
  });

  it("requires visible parent education fields when a parent count is selected", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        tertiaryQualifications: [],
        cvUploaded: true,
        cvDocument: makeRemoteDocument({
          id: "doc-cv",
          name: "resume.pdf",
          storagePath: "user-1/app-1/cv/doc-cv-resume.pdf",
        }),
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

  it("requires disability details when support needs are declared", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        contactDetails: {
          ...initialApplicationData.contactDetails,
          citizenshipStatus: "Australian Citizen",
          language: "English",
          aboriginal: "No",
          schoolLevel: "Year 12 or equivalent",
          parentsCount: "0",
          hasDisability: true,
          disabilityDetails: "",
          residentialAddress: {
            ...initialApplicationData.contactDetails.residentialAddress,
            formattedAddress: "68 Barringo Way, Caroline Springs VIC 3023",
          },
        },
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Disability support details",
          path: "/section1/family-support?from=review",
        }),
      ]),
    );
  });

  it("does not treat document names without stored files as uploaded", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        tertiaryQualifications: [
          makeValidTertiaryQualification({
            transcriptDocument: undefined,
            transcriptDocumentName: "transcript.pdf",
            certificateDocument: undefined,
            certificateDocumentName: "certificate.pdf",
          }),
        ],
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Academic Transcript",
        }),
      ]),
    );
    expect(errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Certificate of Completion",
        }),
      ]),
    );
  });

  it("does not treat cv file names without stored documents as uploaded", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        tertiaryQualifications: [],
        cvUploaded: true,
        cvFileName: "resume.pdf",
        cvDocument: undefined,
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
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subsection: "Submission requirements",
          field: "CV upload or a tertiary qualification",
        }),
      ]),
    );
  });

  it("does not require a certificate when the transcript evidences completion", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        tertiaryQualifications: [
          makeValidTertiaryQualification({
            certificateDocument: undefined,
            certificateDocumentName: undefined,
          }),
        ],
      }),
    );

    expect(errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Qualification 1: Certificate of Completion",
        }),
      ]),
    );
  });

  it("requires a certificate when completed but the transcript can't evidence completion", () => {
    const errors = getSubmissionValidationIssues(
      makeValidApplication({
        tertiaryQualifications: [
          makeValidTertiaryQualification({
            completed: true,
            certificateDocument: undefined,
            certificateDocumentName: undefined,
            transcriptEligibility: makeCompletionAssessment("Discontinued"),
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
    const errors = getSubmissionValidationIssues(
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

  it("requires program-specific English evidence when the transcript is not from an accepted English-speaking country", () => {
    const errors = getSubmissionValidationIssues(makeMbaOnlineApplication());

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subsection: "Program evidence",
          path: "/section2/add-language-test?from=review",
        }),
      ]),
    );
  });

  it("accepts program-specific English evidence when an IELTS score meets the course threshold", () => {
    const errors = getSubmissionValidationIssues(
      makeMbaOnlineApplication({ languageTests: [makeIeltsTest()] }),
    );

    expect(errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subsection: "Program evidence",
          path: expect.stringContaining("language-test"),
        }),
      ]),
    );
  });
});
