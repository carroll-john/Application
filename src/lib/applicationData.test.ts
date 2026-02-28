import { describe, expect, it } from "vitest";
import { mergeStoredApplicationData } from "./applicationData";

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
      streetAddress: "",
      suburb: "",
      state: "",
      postcode: "",
      country: "",
    });
  });
});
