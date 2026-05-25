import { describe, expect, it } from "vitest";
import type { TertiaryQualification } from "../applicationData";
import { matcherFixtures } from "./matcherFixtures";
import {
  applyTranscriptQualificationDraft,
  clearTertiaryQualificationFromTranscript,
  countDraftedFields,
  isQualificationCoreEmpty,
  mapExtractedDataToQualification,
  mergeQualificationDraft,
  mergeQualificationFromTranscriptParse,
  normalizeQualificationLevel,
  qualificationFieldDraftDiffers,
} from "./mapToTertiaryQualification";

function emptyQualification(): TertiaryQualification {
  return {
    id: "test-id",
    institution: "",
    country: "Australia",
    level: "",
    courseName: "",
    startMonth: "",
    startYear: "",
    completed: true,
    endMonth: "",
    endYear: "",
  };
}

describe("normalizeQualificationLevel", () => {
  it("maps bachelor program names to Bachelor", () => {
    expect(normalizeQualificationLevel("Bachelor of Information Technology")).toBe(
      "Bachelor",
    );
  });

  it("maps masters program names to Masters", () => {
    expect(normalizeQualificationLevel("Master of Business Administration")).toBe(
      "Masters",
    );
  });

  it("returns empty for unknown levels", () => {
    expect(normalizeQualificationLevel("Certificate IV")).toBe("");
  });
});

describe("mapExtractedDataToQualification", () => {
  it("maps matcher fixture evidence to qualification fields", () => {
    const draft = mapExtractedDataToQualification(matcherFixtures[0].evidence);

    expect(draft.institution).toBe("The University of Melbourne");
    expect(draft.country).toBe("Australia");
    expect(draft.level).toBe("Bachelor");
    expect(draft.completed).toBe(true);
  });

  it("parses start and completion dates when present", () => {
    const draft = mapExtractedDataToQualification({
      studyDetails: {
        startDate: { confidence: 0.9, normalizedValue: "March 2020" },
        completionDate: { confidence: 0.9, normalizedValue: "July 2024" },
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
        programName: { confidence: 0.9, normalizedValue: "Bachelor of Science" },
      },
    });

    expect(draft.startMonth).toBe("March");
    expect(draft.startYear).toBe("2020");
    expect(draft.endMonth).toBe("July");
    expect(draft.endYear).toBe("2024");
    expect(draft.courseName).toBe("Bachelor of Science");
  });
});

describe("mergeQualificationDraft", () => {
  it("fills only empty fields", () => {
    const existing: TertiaryQualification = {
      ...emptyQualification(),
      institution: "Existing University",
    };

    const merged = mergeQualificationDraft(existing, {
      institution: "Parsed University",
      country: "Australia",
      level: "Bachelor",
      courseName: "Bachelor of IT",
      startMonth: "March",
      startYear: "2020",
      completed: true,
      endMonth: "July",
      endYear: "2024",
    });

    expect(merged.institution).toBe("Existing University");
    expect(merged.level).toBe("Bachelor");
    expect(merged.courseName).toBe("Bachelor of IT");
  });

  it("does not overwrite completed when core fields already exist", () => {
    const existing: TertiaryQualification = {
      ...emptyQualification(),
      institution: "Monash University",
      completed: false,
    };

    const merged = mergeQualificationDraft(existing, {
      ...mapExtractedDataToQualification(matcherFixtures[0].evidence),
      completed: true,
    });

    expect(merged.completed).toBe(false);
  });
});

describe("applyTranscriptQualificationDraft", () => {
  it("replaces existing qualification fields from a new transcript parse", () => {
    const existing: TertiaryQualification = {
      ...emptyQualification(),
      institution: "Old University",
      level: "Diploma",
      courseName: "Old Course",
      startMonth: "January",
      startYear: "2018",
      endMonth: "December",
      endYear: "2020",
    };

    const merged = applyTranscriptQualificationDraft(existing, {
      institution: "The University of Melbourne",
      country: "Australia",
      level: "Bachelor",
      courseName: "Bachelor of Science",
      startMonth: "March",
      startYear: "2020",
      completed: true,
      endMonth: "July",
      endYear: "2024",
    });

    expect(merged.institution).toBe("The University of Melbourne");
    expect(merged.level).toBe("Bachelor");
    expect(merged.courseName).toBe("Bachelor of Science");
    expect(merged.startYear).toBe("2020");
    expect(merged.endYear).toBe("2024");
  });
});

describe("mergeQualificationFromTranscriptParse", () => {
  it("fills empty fields only for a blank qualification", () => {
    const existing = emptyQualification();
    const draft = mapExtractedDataToQualification(matcherFixtures[0].evidence);

    const merged = mergeQualificationFromTranscriptParse(existing, draft);

    expect(merged.institution).toBe("The University of Melbourne");
    expect(merged.level).toBe("Bachelor");
  });

  it("replaces populated fields when a new transcript is parsed", () => {
    const existing: TertiaryQualification = {
      ...emptyQualification(),
      institution: "Old University",
      level: "Diploma",
      courseName: "Old Course",
    };
    const draft = mapExtractedDataToQualification(matcherFixtures[0].evidence);

    const merged = mergeQualificationFromTranscriptParse(existing, draft);

    expect(merged.institution).toBe("The University of Melbourne");
    expect(merged.level).toBe("Bachelor");
    expect(
      qualificationFieldDraftDiffers(existing, draft),
    ).toBe(true);
  });
});

describe("isQualificationCoreEmpty", () => {
  it("returns true for a blank qualification", () => {
    expect(isQualificationCoreEmpty(emptyQualification())).toBe(true);
  });

  it("returns false when institution is filled", () => {
    expect(
      isQualificationCoreEmpty({
        ...emptyQualification(),
        institution: "University",
      }),
    ).toBe(false);
  });
});

describe("clearTertiaryQualificationFromTranscript", () => {
  it("clears qualification fields and transcript metadata", () => {
    const cleared = clearTertiaryQualificationFromTranscript({
      ...emptyQualification(),
      institution: "Monash University",
      courseName: "Bachelor of IT",
      transcriptDocument: {
        id: "doc-1",
        name: "transcript.pdf",
        size: 1,
        type: "application/pdf",
        lastModified: 1,
        uploadedAt: new Date().toISOString(),
      },
      transcriptEligibility: {
        checkedAt: new Date().toISOString(),
        confidence: 0.9,
        extractedData: {},
        manualReviewRequired: false,
        missingInformation: [],
        outcome: "eligible",
        recommendedNextStep: "Proceed",
        requirementsChecked: [],
      },
    });

    expect(cleared.institution).toBe("");
    expect(cleared.courseName).toBe("");
    expect(cleared.transcriptDocument).toBeUndefined();
    expect(cleared.transcriptEligibility).toBeUndefined();
  });
});

describe("countDraftedFields", () => {
  it("counts populated draft fields", () => {
    expect(
      countDraftedFields({
        institution: "Uni",
        country: "Australia",
        level: "Bachelor",
        courseName: "BSc",
        startMonth: "March",
        startYear: "2020",
        completed: true,
        endMonth: "July",
        endYear: "2024",
      }),
    ).toBe(6);
  });
});
