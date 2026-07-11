import type {
  EligibilityCheckDetails,
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  RequirementReasonCode,
} from "./types";

/**
 * The closed set of requirement kinds the eligibility matcher knows how to evaluate.
 *
 * Adding a new kind requires (in order):
 *   1. A new entry in this union and the matching params interface below.
 *   2. A matching evaluator in `src/lib/eligibility/matcher.ts`.
 *   3. A UI label entry in `requirementKindLabels`.
 *   4. Parser-side coverage in `scripts/courseRequirementsParser/pipeline.ts` and
 *      `requirementKindRegistry.ts` so courses can declare it.
 */
export type RequirementKind =
  | "qualification_completed"
  | "qualification_level"
  | "academic_threshold"
  | "english_proficiency"
  | "work_experience"
  | "field_of_study";

export const ALL_REQUIREMENT_KINDS: readonly RequirementKind[] = [
  "qualification_completed",
  "qualification_level",
  "academic_threshold",
  "english_proficiency",
  "work_experience",
  "field_of_study",
] as const;

/**
 * Empty-params placeholder for kinds that don't currently need configuration. Modelled as a type
 * alias (rather than an empty interface) to satisfy the no-empty-interface lint rule while keeping
 * the door open for future params.
 */
export type QualificationCompletedParams = Record<string, never>;

export type QualificationLevel =
  | "high_school"
  | "diploma"
  | "bachelor"
  | "honours"
  | "masters"
  | "doctorate";

export interface QualificationLevelParams {
  level: QualificationLevel;
}

export type AcademicMetric = "wam" | "gpa";

export interface AcademicThresholdParams {
  metric: AcademicMetric;
  min: number;
  /**
   * Required when metric === "gpa". The denominator (e.g. 4.0 or 7.0).
   */
  scale?: number;
}

export type EnglishPathway =
  | {
      type: "completion_in_country";
      /**
       * ISO 3166-1 alpha-2 codes (e.g. "AU", "NZ"). Country comparison is case-insensitive and tolerant
       * of common full-name spellings via `englishMediumCountries.ts`.
       */
      countries: string[];
    }
  | {
      type: "english_test";
      test: "IELTS" | "TOEFL_iBT" | "PTE" | "CAE" | "OET";
      minOverall: number;
      minBand?: number;
    };

export interface EnglishProficiencyParams {
  acceptedPathways: EnglishPathway[];
}

export interface WorkExperienceParams {
  minYears: number;
  /**
   * Optional natural-language description of which experience counts (used for UI copy only;
   * the matcher does not currently filter on it).
   */
  relevantTo?: string;
}

export interface FieldOfStudyParams {
  /**
   * Free-text accepted study areas (e.g. ["business", "management", "commerce"]). Matching is
   * case-insensitive substring on the applicant's extracted programName / subjectArea.
   */
  acceptedAreas: string[];
}

export type RequirementWeight = "mandatory" | "alternative" | "conditional";

/**
 * Discriminated union that ties each kind to its params shape so consumers don't need casts.
 */
export type RequirementInstance =
  | (RequirementInstanceBase & {
      kind: "qualification_completed";
      params: QualificationCompletedParams;
    })
  | (RequirementInstanceBase & {
      kind: "qualification_level";
      params: QualificationLevelParams;
    })
  | (RequirementInstanceBase & {
      kind: "academic_threshold";
      params: AcademicThresholdParams;
    })
  | (RequirementInstanceBase & {
      kind: "english_proficiency";
      params: EnglishProficiencyParams;
    })
  | (RequirementInstanceBase & {
      kind: "work_experience";
      params: WorkExperienceParams;
    })
  | (RequirementInstanceBase & {
      kind: "field_of_study";
      params: FieldOfStudyParams;
    });

interface RequirementInstanceBase {
  /**
   * Stable identifier (e.g. "rmit-mit-completion"). Used as the EligibilityRequirementCheck.id
   * so UI and analytics can join checks back to the catalog source.
   */
  id: string;
  /**
   * Verbatim sentence from the course's published entry requirements. Rendered as the row heading
   * in the result UI so users see the original wording.
   */
  sourceText: string;
  weight: RequirementWeight;
  /**
   * When two or more requirements share an alternativeGroupId, satisfying any one of them satisfies
   * the group. The matcher treats the whole group as a single OR-check and emits one check row.
   */
  alternativeGroupId?: string;
  /**
   * Bundles requirements that must all pass together for one entry pathway. When a course declares
   * two or more distinct pathway bundles, satisfying any one bundle satisfies the pathway OR —
   * failures from other bundles do not gate eligibility.
   */
  pathwayBundleId?: string;
}

export const requirementKindLabels: Record<RequirementKind, string> = {
  qualification_completed: "Completed qualification",
  qualification_level: "Minimum qualification level",
  academic_threshold: "Academic results threshold",
  english_proficiency: "English language proficiency",
  work_experience: "Work experience",
  field_of_study: "Field of study",
};

export function requirementKindLabel(kind: RequirementKind): string {
  return requirementKindLabels[kind];
}

/**
 * Short, human-readable summary of an academic threshold (e.g. "60% WAM", "4/7 GPA"), used
 * wherever the UI needs a compact form instead of the full published requirement sentence.
 */
export function formatAcademicThreshold(params: AcademicThresholdParams): string {
  if (params.metric === "gpa") {
    return params.scale != null ? `${params.min}/${params.scale} GPA` : `${params.min} GPA`;
  }

  return params.scale === 100 ? `${params.min}% WAM` : `${params.min} WAM`;
}

/**
 * Comma-joined accepted study areas (e.g. "Business, Commerce, Management"), used wherever the
 * UI needs a compact form instead of the full published requirement sentence.
 */
export function formatFieldOfStudyAreas(params: FieldOfStudyParams): string {
  return params.acceptedAreas.join(", ");
}

const qualificationLevelLabels: Record<QualificationLevel, string> = {
  high_school: "High school",
  diploma: "Diploma",
  bachelor: "Bachelor degree",
  honours: "Honours degree",
  masters: "Masters degree",
  doctorate: "Doctorate",
};

/**
 * Short, human-readable "X or higher" summary of a minimum qualification level (e.g.
 * "Bachelor degree or higher"), used wherever the UI needs a compact form instead of the full
 * published requirement sentence.
 */
export function formatQualificationLevel(level: QualificationLevel): string {
  return `${qualificationLevelLabels[level]} or higher`;
}

/**
 * Convenience constructor for an `EligibilityRequirementCheck` that ties back to the
 * source `RequirementInstance`. The matcher returns these in the same order as the input instances.
 */
export function buildRequirementCheck(
  instance: RequirementInstance,
  status: EligibilityRequirementStatus,
  explanation: string,
  reasonCode?: RequirementReasonCode,
  details?: EligibilityCheckDetails,
): EligibilityRequirementCheck {
  return {
    id: instance.id,
    requirement: instance.sourceText,
    status,
    explanation,
    ...(reasonCode ? { reasonCode } : {}),
    ...(details ? { details } : {}),
  };
}

/**
 * Which document actually proves each requirement kind. A transcript scan can only judge
 * transcript-provable requirements; the rest must come from other evidence (CV for work
 * experience, test report / AHPRA registration for English) and should surface as "add this
 * document next" prompts rather than degrading the transcript verdict.
 */
export type EvidenceSource = "transcript" | "cv" | "english_evidence";

export const requirementEvidenceSource: Record<RequirementKind, EvidenceSource> = {
  qualification_completed: "transcript",
  qualification_level: "transcript",
  academic_threshold: "transcript",
  english_proficiency: "english_evidence",
  work_experience: "cv",
  field_of_study: "transcript",
};
