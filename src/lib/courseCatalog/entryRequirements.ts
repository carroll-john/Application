import { sanitizeText } from "./text";

export interface ParsedEntryRequirementThresholds {
  minGpaScale?: number;
  minGpaValue?: number;
  minWam?: number;
  qualificationLevelRequirement?: string;
}

/**
 * Deterministic regex extraction of GPA/WAM/qualification thresholds from a
 * course's free-text `entry_requirements`. Used as a fallback when the offline
 * `scripts/parse-course-requirements.ts` pipeline has not produced canonical
 * `RequirementInstance[]` for a course.
 */
export function parseEntryRequirementThresholds(
  entryRequirements?: string | null,
): ParsedEntryRequirementThresholds {
  const text = sanitizeText(entryRequirements);
  if (!text) {
    return {};
  }

  const lowered = text.toLowerCase();
  const qualificationLevelRequirement = /\bbachelor\b/.test(lowered)
    ? "Bachelor degree"
    : /\bmaster\b/.test(lowered)
      ? "Masters degree"
      : /\bdiploma\b/.test(lowered)
        ? "Diploma"
        : undefined;

  let minWam: number | undefined;
  const wamMatch =
    text.match(/\bwam\b[\s\S]{0,40}?(\d{2}(?:\.\d+)?)\s*%?/i) ??
    text.match(/(\d{2}(?:\.\d+)?)\s*%?[\s\S]{0,30}\bwam\b/i);
  if (wamMatch?.[1]) {
    minWam = Number.parseFloat(wamMatch[1]);
  }

  let minGpaValue: number | undefined;
  let minGpaScale: number | undefined;
  const gpaMatch =
    text.match(/\bgpa\b[\s\S]{0,40}?(\d(?:\.\d+)?)\s*(?:\/|out of|on)\s*(\d(?:\.\d+)?)/i) ??
    text.match(/(\d(?:\.\d+)?)\s*(?:\/|out of|on)\s*(\d(?:\.\d+)?)[\s\S]{0,20}\bgpa\b/i);
  if (gpaMatch?.[1] && gpaMatch?.[2]) {
    minGpaValue = Number.parseFloat(gpaMatch[1]);
    minGpaScale = Number.parseFloat(gpaMatch[2]);
  }

  return {
    minGpaScale: Number.isFinite(minGpaScale) ? minGpaScale : undefined,
    minGpaValue: Number.isFinite(minGpaValue) ? minGpaValue : undefined,
    minWam: Number.isFinite(minWam) ? minWam : undefined,
    qualificationLevelRequirement,
  };
}
