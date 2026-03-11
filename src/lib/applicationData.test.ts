import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  mergeStoredApplicationData,
  normalizeConditionalContactDetails,
} from "./applicationData";

interface LegacyTertiaryQualificationSeed {
  id: string;
  institution: string;
  country: string;
  level: string;
  courseName: string;
  startMonth: string;
  startYear: string;
  completed: boolean;
  endMonth: string;
  endYear: string;
  document: {
    id: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
    uploadedAt: string;
  };
  documentName: string;
}

describe("mergeStoredApplicationData", () => {
  it("maps legacy tertiary document fields into the transcript slot", () => {
    const legacyQualification: LegacyTertiaryQualificationSeed = {
      id: "q1",
      institution: "Uni",
      country: "Australia",
      level: "Bachelor",
      courseName: "Business",
      startMonth: "January",
      startYear: "2020",
      completed: true,
      endMonth: "December",
      endYear: "2022",
      document: {
        id: "doc-1",
        name: "legacy-transcript.pdf",
        size: 1024,
        type: "application/pdf",
        lastModified: 1,
        uploadedAt: "2026-03-01T00:00:00.000Z",
      },
      documentName: "legacy-transcript.pdf",
    };

    const merged = mergeStoredApplicationData({
      tertiaryQualifications: [legacyQualification as never],
    });

    expect(merged.tertiaryQualifications[0].transcriptDocumentName).toBe(
      "legacy-transcript.pdf",
    );
    expect(merged.tertiaryQualifications[0].transcriptDocument?.id).toBe("doc-1");
  });

  it("fills missing structured address parts with empty defaults", () => {
    const merged = mergeStoredApplicationData({
      contactDetails: {
        residentialAddress: {
          formattedAddress: "1 Test St",
        },
      },
    } as never);

    expect(merged.contactDetails.residentialAddress).toEqual({
      formattedAddress: "1 Test St",
      unitNumber: "",
      streetAddress: "",
      suburb: "",
      state: "",
      postcode: "",
      country: "",
    });
  });

  it("preserves the selected course metadata when reloading stored application data", () => {
    const merged = mergeStoredApplicationData({
      applicationMeta: {
        selectedCourse: {
          code: "mba-online",
          title: "Master of Business Administration (MBA) online",
          intake: "12 May 2025",
        },
      },
    });

    expect(merged.applicationMeta.selectedCourse).toEqual({
      code: "mba-online",
      title: "Master of Business Administration (MBA) online",
      intake: "12 May 2025",
    });
  });

  it("treats untouched legacy disability defaults as unanswered support state", () => {
    const merged = mergeStoredApplicationData({
      contactDetails: {
        hasDisability: false,
      },
    } as never);

    expect(merged.contactDetails.hasDisability).toBeNull();
  });
});

describe("normalizeConditionalContactDetails", () => {
  it("clears parent education details that are hidden by the selected parent count", () => {
    const normalized = normalizeConditionalContactDetails({
      ...initialApplicationData.contactDetails,
      parentsCount: "1",
      parent1Details: "Bachelor degree",
      parent2Details: "Diploma",
      parent3Details: "Unknown",
    });

    expect(normalized.parent1Details).toBe("Bachelor degree");
    expect(normalized.parent2Details).toBe("");
    expect(normalized.parent3Details).toBe("");
  });

  it("clears disability details when the applicant selects no support need", () => {
    const normalized = normalizeConditionalContactDetails({
      ...initialApplicationData.contactDetails,
      hasDisability: false,
      disabilityDetails: "Low vision support",
    });

    expect(normalized.disabilityDetails).toBe("");
  });
});
