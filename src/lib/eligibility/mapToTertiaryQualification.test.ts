import { describe, expect, it } from "vitest";
import type { TertiaryQualification } from "../applicationData";
import { matcherFixtures } from "./matcherFixtures";
import {
  countDraftedFields,
  isQualificationCoreEmpty,
  mapExtractedDataToQualification,
  mergeQualificationDraft,
  normalizeQualificationLevel,
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
