import { describe, expect, it } from "vitest";
import type {
  ApplicationData,
  EmploymentExperience,
  LanguageTest,
  TertiaryQualification,
} from "../../lib/applicationData";
import { initialApplicationData } from "../../lib/applicationData";
import type { ProgramEvidenceRow } from "../../lib/eligibility/programEvidence";
import {
  buildSection2EvidencePlan,
  getEvidenceSectionKeyForPath,
  sectionHasData,
  type Section2EvidenceSectionKey,
} from "./section2EvidencePlan";

function application(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return { ...initialApplicationData, ...overrides };
}

function tertiaryQualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "tertiary-1",
    institution: "The University of Melbourne",
    country: "Australia",
    level: "Bachelor",
    courseName: "Bachelor of Information Technology",
    startMonth: "February",
    startYear: "2020",
    completed: true,
    endMonth: "December",
    endYear: "2023",
    ...overrides,
  };
}

function languageTest(overrides: Partial<LanguageTest> = {}): LanguageTest {
  return {
    id: "lang-1",
    type: "IELTS",
    name: "IELTS Academic",
    year: "2025",
    overallScore: "6.5",
    listeningScore: "6",
    readingScore: "6",
    writingScore: "6",
    speakingScore: "6",
    documentName: "ielts.pdf",
    ...overrides,
  };
}

function employmentExperience(
  overrides: Partial<EmploymentExperience> = {},
): EmploymentExperience {
  return {
    id: "employment-1",
    position: "Registered Nurse",
    company: "Melbourne Health",
    startMonth: "January",
    startYear: "2021",
    current: true,
    ...overrides,
  } as EmploymentExperience;
}

function evidenceRow(overrides: Partial<ProgramEvidenceRow> = {}): ProgramEvidenceRow {
  return {
    explanation: "Add your transcript to verify this requirement.",
    heading: "Academic transcript",
    id: "row-1",
    isBlocking: true,
    kindLabel: "Qualification level",
    requirementId: "req-1",
    sourceText: "A completed bachelor degree.",
    status: "needs_evidence",
    statusLabel: "Add evidence",
    actionLabel: "Add transcript",
    actionPath: "/section2/add-tertiary?from=review",
    ...overrides,
  };
}

const noSkips: ReadonlySet<Section2EvidenceSectionKey> = new Set();

describe("getEvidenceSectionKeyForPath", () => {
  it("maps add paths and strips query strings", () => {
    expect(getEvidenceSectionKeyForPath("/section2/add-tertiary?from=review")).toBe("tertiary");
    expect(getEvidenceSectionKeyForPath("/section2/add-cv")).toBe("cv");
    expect(getEvidenceSectionKeyForPath("/section2/add-language-test?from=review")).toBe(
      "languageTest",
    );
  });

  it("maps edit paths", () => {
    expect(getEvidenceSectionKeyForPath("/section2/edit-language-test/abc?from=review")).toBe(
      "languageTest",
    );
    expect(getEvidenceSectionKeyForPath("/section2/edit-accreditation/xyz")).toBe(
      "accreditation",
    );
  });

  it("returns null for unknown paths", () => {
    expect(getEvidenceSectionKeyForPath("/review")).toBeNull();
    expect(getEvidenceSectionKeyForPath("/section2/qualifications")).toBeNull();
  });
});

describe("buildSection2EvidencePlan in requirements mode", () => {
  it("surfaces the first blocking row as the single next prompt", () => {
    const plan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [
        evidenceRow(),
        evidenceRow({
          actionLabel: "Add English evidence",
          actionPath: "/section2/add-language-test?from=review",
          heading: "English Language Proficiency",
          id: "row-2",
          requirementId: "req-2",
        }),
      ],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });

    expect(plan.mode).toBe("requirements");
    expect(plan.nextPrompt?.sectionKey).toBe("tertiary");
    expect(plan.nextPrompt?.actionPath).toBe("/section2/add-tertiary");
    expect(plan.remainingPromptCount).toBe(2);
    expect(plan.isEvidenceReady).toBe(false);
    expect(plan.hasAnyEvidence).toBe(false);
  });

  it("advances to the next prompt when a section is skipped without marking evidence ready", () => {
    const plan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [
        evidenceRow(),
        evidenceRow({
          actionLabel: "Add English evidence",
          actionPath: "/section2/add-language-test?from=review",
          heading: "English Language Proficiency",
          id: "row-2",
          requirementId: "req-2",
        }),
      ],
      hasPublishedRequirements: true,
      skippedSections: new Set(["tertiary"]),
    });

    expect(plan.nextPrompt?.sectionKey).toBe("languageTest");
    expect(plan.remainingPromptCount).toBe(1);
    expect(plan.skippedPrompts.map((prompt) => prompt.sectionKey)).toEqual(["tertiary"]);
    expect(plan.isEvidenceReady).toBe(false);
    expect(plan.hasSkips).toBe(true);
  });

  it("is evidence ready only when no blocking rows remain", () => {
    const plan = buildSection2EvidencePlan({
      data: application({ tertiaryQualifications: [tertiaryQualification()] }),
      groupedRows: [evidenceRow({ isBlocking: false, status: "met", actionLabel: undefined, actionPath: undefined })],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });

    expect(plan.nextPrompt).toBeNull();
    expect(plan.isEvidenceReady).toBe(true);
    expect(plan.remainingPromptCount).toBe(0);
  });

  it("keeps evidence not-ready when all prompts are skipped", () => {
    const plan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [evidenceRow()],
      hasPublishedRequirements: true,
      skippedSections: new Set(["tertiary"]),
    });

    expect(plan.nextPrompt).toBeNull();
    expect(plan.isEvidenceReady).toBe(false);
    expect(plan.skippedPrompts).toHaveLength(1);
  });

  it("only surfaces a possible-alternative suggestion when nothing blocks", () => {
    const alternativeRow = evidenceRow({
      actionLabel: "Add CV",
      actionPath: "/section2/add-cv?from=review",
      heading: "Minimum WAM of 65",
      id: "row-alt",
      isBlocking: false,
      status: "possible_alternative",
    });

    const blockedPlan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [evidenceRow(), alternativeRow],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });
    expect(blockedPlan.suggestion).toBeNull();

    const openPlan = buildSection2EvidencePlan({
      data: application({ tertiaryQualifications: [tertiaryQualification()] }),
      groupedRows: [alternativeRow],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });
    expect(openPlan.suggestion?.sectionKey).toBe("cv");
    expect(openPlan.visibleSections.has("cv")).toBe(false);
    expect(openPlan.visibleSections.has("tertiary")).toBe(true);
  });

  it("hides a possible-alternative suggestion once its evidence section has data", () => {
    const cvAlternativeRow = evidenceRow({
      actionLabel: "Add CV",
      actionPath: "/section2/add-cv?from=review",
      heading: "Minimum WAM of 65",
      id: "row-alt",
      isBlocking: false,
      status: "possible_alternative",
    });

    const plan = buildSection2EvidencePlan({
      data: application({
        cvUploaded: true,
        tertiaryQualifications: [tertiaryQualification()],
      }),
      groupedRows: [cvAlternativeRow],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });

    expect(plan.suggestion).toBeNull();
    expect(plan.visibleSections.has("cv")).toBe(true);
  });
});

describe("buildSection2EvidencePlan in generic mode", () => {
  it("walks transcript, CV, then English evidence", () => {
    const empty = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: noSkips,
    });
    expect(empty.mode).toBe("generic");
    expect(empty.nextPrompt?.sectionKey).toBe("tertiary");
    expect(empty.remainingPromptCount).toBe(3);

    const withTertiary = buildSection2EvidencePlan({
      data: application({ tertiaryQualifications: [tertiaryQualification()] }),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: noSkips,
    });
    expect(withTertiary.nextPrompt?.sectionKey).toBe("cv");

    const withCv = buildSection2EvidencePlan({
      data: application({
        cvUploaded: true,
        tertiaryQualifications: [tertiaryQualification()],
      }),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: noSkips,
    });
    expect(withCv.nextPrompt?.sectionKey).toBe("languageTest");

    const complete = buildSection2EvidencePlan({
      data: application({
        cvUploaded: true,
        languageTests: [languageTest()],
        tertiaryQualifications: [tertiaryQualification()],
      }),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: noSkips,
    });
    expect(complete.nextPrompt).toBeNull();
    expect(complete.isEvidenceReady).toBe(true);
  });

  it("does not request English evidence when the transcript assessment already satisfies it", () => {
    const plan = buildSection2EvidencePlan({
      data: application({
        cvUploaded: true,
        tertiaryQualifications: [tertiaryQualification()],
      }),
      groupedRows: [
        evidenceRow({
          actionLabel: undefined,
          actionPath: undefined,
          heading: "English language proficiency",
          id: "english-met",
          isBlocking: false,
          kindLabel: "English language proficiency",
          requirementId: "english-proficiency",
          status: "met",
          statusLabel: "Met",
        }),
      ],
      hasPublishedRequirements: false,
      skippedSections: noSkips,
    });

    expect(plan.nextPrompt).toBeNull();
    expect(plan.remainingPromptCount).toBe(0);
    expect(plan.isEvidenceReady).toBe(true);
  });

  it("skipping a generic step advances to the next one", () => {
    const plan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: new Set(["tertiary"]),
    });

    expect(plan.nextPrompt?.sectionKey).toBe("cv");
    expect(plan.skippedPrompts.map((prompt) => prompt.sectionKey)).toEqual(["tertiary"]);
    expect(plan.isEvidenceReady).toBe(false);
  });
});

describe("visibleSections", () => {
  it("shows only sections that already have uploaded data", () => {
    const plan = buildSection2EvidencePlan({
      data: application({
        employmentExperiences: [employmentExperience()],
        tertiaryQualifications: [tertiaryQualification()],
      }),
      groupedRows: [
        evidenceRow({
          actionLabel: "Add English evidence",
          actionPath: "/section2/add-language-test?from=review",
          heading: "English Language Proficiency",
          id: "row-2",
          requirementId: "req-2",
        }),
      ],
      hasPublishedRequirements: true,
      skippedSections: noSkips,
    });

    expect([...plan.visibleSections].sort()).toEqual(["employment", "tertiary"]);
    expect(plan.visibleSections.has("languageTest")).toBe(false);
    expect(plan.visibleSections.has("accreditation")).toBe(false);
    expect(plan.hasAnyEvidence).toBe(true);
  });

  it("hides sections that are skipped and empty", () => {
    const plan = buildSection2EvidencePlan({
      data: application(),
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: new Set(["tertiary", "cv", "languageTest"]),
    });

    expect(plan.visibleSections.size).toBe(0);
    expect(plan.nextPrompt).toBeNull();
  });
});

describe("sectionHasData", () => {
  it("reflects each collection", () => {
    const data = application({
      cvUploaded: true,
      languageTests: [languageTest()],
    });
    expect(sectionHasData(data, "cv")).toBe(true);
    expect(sectionHasData(data, "languageTest")).toBe(true);
    expect(sectionHasData(data, "tertiary")).toBe(false);
    expect(sectionHasData(data, "secondary")).toBe(false);
  });
});
