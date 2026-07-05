import type { ApplicationData } from "../../lib/applicationData";
import type { ProgramEvidenceRow } from "../../lib/eligibility/programEvidence";
import {
  getSection2Step,
  getSection2StepByPath,
  type Section2StepKey,
} from "../../lib/section2Steps";
import type { SectionState } from "./types";

export type Section2EvidenceSectionKey = keyof SectionState;

export interface Section2EvidencePrompt {
  actionLabel: string;
  /** Pathname only — callers append their own review suffix so child pages return here. */
  actionPath: string;
  explanation: string;
  explanationItems?: string[];
  heading: string;
  sectionKey: Section2EvidenceSectionKey;
  source: "requirement" | "generic";
}

export interface Section2EvidencePlan {
  hasAnyEvidence: boolean;
  hasSkips: boolean;
  isEvidenceReady: boolean;
  mode: "requirements" | "generic";
  /** The single evidence prompt to surface now; the next one appears once this resolves. */
  nextPrompt: Section2EvidencePrompt | null;
  /** Outstanding prompts including `nextPrompt` (skipped ones excluded). */
  remainingPromptCount: number;
  /** Prompts hidden because their section was skipped and still has no data. */
  skippedPrompts: Section2EvidencePrompt[];
  /** Non-blocking alternative pathway (e.g. work evidence), surfaced only when nothing blocks. */
  suggestion: Section2EvidencePrompt | null;
  visibleSections: ReadonlySet<Section2EvidenceSectionKey>;
}

const EVIDENCE_SECTION_KEYS: readonly Section2EvidenceSectionKey[] = [
  "tertiary",
  "cv",
  "employment",
  "accreditation",
  "secondary",
  "languageTest",
];

const stepKeyToSectionKey: Partial<Record<Section2StepKey, Section2EvidenceSectionKey>> = {
  accreditation: "accreditation",
  cv: "cv",
  employment: "employment",
  "language-test": "languageTest",
  secondary: "secondary",
  tertiary: "tertiary",
};

export function sectionHasData(
  data: ApplicationData,
  key: Section2EvidenceSectionKey,
): boolean {
  switch (key) {
    case "tertiary":
      return data.tertiaryQualifications.length > 0;
    case "cv":
      return data.cvUploaded;
    case "employment":
      return data.employmentExperiences.length > 0;
    case "accreditation":
      return data.professionalAccreditations.length > 0;
    case "secondary":
      return data.secondaryQualifications.length > 0;
    case "languageTest":
      return data.languageTests.length > 0;
  }
}

export function getEvidenceSectionKeyForPath(
  actionPath: string,
): Section2EvidenceSectionKey | null {
  const pathname = actionPath.split("?")[0] ?? actionPath;
  const step = getSection2StepByPath(pathname);
  return step ? (stepKeyToSectionKey[step.key] ?? null) : null;
}

function promptFromRow(row: ProgramEvidenceRow): Section2EvidencePrompt | null {
  if (!row.actionPath || !row.actionLabel) {
    return null;
  }

  const sectionKey = getEvidenceSectionKeyForPath(row.actionPath);
  if (!sectionKey) {
    return null;
  }

  return {
    actionLabel: row.actionLabel,
    actionPath: row.actionPath.split("?")[0] ?? row.actionPath,
    explanation: row.explanation,
    explanationItems: row.explanationItems,
    heading: row.heading,
    sectionKey,
    source: "requirement",
  };
}

/**
 * Fallback sequence for courses without published requirements: the documents that most
 * often carry program evidence, in the order the engine itself would ask for them.
 */
const genericEvidenceSequence: ReadonlyArray<{
  actionLabel: string;
  explanation: string;
  heading: string;
  sectionKey: Section2EvidenceSectionKey;
  stepKey: Section2StepKey;
}> = [
  {
    actionLabel: "Add transcript",
    explanation:
      "Upload your academic transcript. We'll read it and draft your qualification details for you to review.",
    heading: "Academic transcript",
    sectionKey: "tertiary",
    stepKey: "tertiary",
  },
  {
    actionLabel: "Add CV",
    explanation: "Add your CV so we can draft your employment history for you to review.",
    heading: "Curriculum Vitae (CV)",
    sectionKey: "cv",
    stepKey: "cv",
  },
  {
    actionLabel: "Add English evidence",
    explanation:
      "Add an approved English test result or other evidence of your English language proficiency.",
    heading: "English language proficiency",
    sectionKey: "languageTest",
    stepKey: "language-test",
  },
];

export function buildSection2EvidencePlan(options: {
  data: ApplicationData;
  groupedRows: readonly ProgramEvidenceRow[];
  hasPublishedRequirements: boolean;
  skippedSections: ReadonlySet<Section2EvidenceSectionKey>;
}): Section2EvidencePlan {
  const { data, groupedRows, hasPublishedRequirements, skippedSections } = options;
  const hasAnyEvidence = EVIDENCE_SECTION_KEYS.some((key) => sectionHasData(data, key));

  let prompts: Section2EvidencePrompt[];
  let isEvidenceReady: boolean;
  let suggestion: Section2EvidencePrompt | null = null;
  const mode: Section2EvidencePlan["mode"] = hasPublishedRequirements
    ? "requirements"
    : "generic";

  if (hasPublishedRequirements) {
    const blockingRows = groupedRows.filter((row) => row.isBlocking);
    prompts = blockingRows
      .map(promptFromRow)
      .filter((prompt): prompt is Section2EvidencePrompt => prompt !== null);
    isEvidenceReady = blockingRows.length === 0;
  } else {
    prompts = genericEvidenceSequence
      .filter((entry) => !sectionHasData(data, entry.sectionKey))
      .map((entry) => ({
        actionLabel: entry.actionLabel,
        actionPath: getSection2Step(entry.stepKey).addPath ?? "",
        explanation: entry.explanation,
        heading: entry.heading,
        sectionKey: entry.sectionKey,
        source: "generic" as const,
      }));
    isEvidenceReady = prompts.length === 0;
  }

  const activePrompts = prompts.filter((prompt) => !skippedSections.has(prompt.sectionKey));
  const skippedPrompts = prompts.filter((prompt) => skippedSections.has(prompt.sectionKey));
  const nextPrompt = activePrompts[0] ?? null;

  if (hasPublishedRequirements && !nextPrompt) {
    const alternativeRow = groupedRows.find((row) => row.status === "possible_alternative");
    const alternativePrompt = alternativeRow ? promptFromRow(alternativeRow) : null;
    suggestion =
      alternativePrompt && !skippedSections.has(alternativePrompt.sectionKey)
        ? alternativePrompt
        : null;
  }

  const visibleSections = new Set<Section2EvidenceSectionKey>();
  for (const key of EVIDENCE_SECTION_KEYS) {
    if (sectionHasData(data, key)) {
      visibleSections.add(key);
    }
  }

  return {
    hasAnyEvidence,
    hasSkips: skippedSections.size > 0,
    isEvidenceReady,
    mode,
    nextPrompt,
    remainingPromptCount: activePrompts.length,
    skippedPrompts,
    suggestion,
    visibleSections,
  };
}

const SKIPPED_SECTIONS_STORAGE_KEY = "section2.skippedEvidenceSections";

export function readSkippedSections(): Set<Section2EvidenceSectionKey> {
  try {
    const raw = window.sessionStorage.getItem(SKIPPED_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(
      parsed.filter((value): value is Section2EvidenceSectionKey =>
        EVIDENCE_SECTION_KEYS.includes(value as Section2EvidenceSectionKey),
      ),
    );
  } catch {
    return new Set();
  }
}

export function writeSkippedSections(skipped: ReadonlySet<Section2EvidenceSectionKey>) {
  try {
    window.sessionStorage.setItem(SKIPPED_SECTIONS_STORAGE_KEY, JSON.stringify([...skipped]));
  } catch {
    // Session storage is a best-effort convenience; ignore quota/availability failures.
  }
}
