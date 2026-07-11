import {
  ALL_REQUIREMENT_KINDS,
  requirementEvidenceSource,
  requirementKindLabels,
  type EvidenceSource,
  type RequirementKind,
} from "./requirements";
import { evaluateOne } from "./requirementEvaluators.js";
import type { EvaluationContext } from "./requirementEvaluators.js";

export interface RequirementKindRegistryEntry {
  kind: RequirementKind;
  label: string;
  evidenceSource: EvidenceSource;
  parserPromptFragment: string;
  /** Whether the pre-apply eligibility modal should ask a self-assessment question. */
  hasSelfAssessmentQuestion: boolean;
  evaluate: typeof evaluateOne;
}

const parserPromptFragments: Record<RequirementKind, string> = {
  qualification_completed:
    "qualification_completed: applicant must have completed the prior qualification. params: {}.",
  qualification_level:
    'qualification_level: minimum prior qualification level. params: { level: "high_school" | "diploma" | "bachelor" | "honours" | "masters" | "doctorate" }.',
  academic_threshold:
    'academic_threshold: minimum WAM or GPA. params: { metric: "wam" | "gpa", min: number, scale?: number }.',
  english_proficiency:
    "english_proficiency: params: { acceptedPathways: [...] } with completion_in_country or english_test pathways.",
  work_experience:
    "work_experience: params: { minYears: number, relevantTo?: string }.",
  field_of_study:
    "field_of_study: params: { acceptedAreas: string[] }.",
};

const selfAssessmentKinds = new Set<RequirementKind>([
  "qualification_completed",
  "qualification_level",
  "academic_threshold",
  "work_experience",
  "field_of_study",
  "english_proficiency",
]);

export const requirementKindRegistry: Record<RequirementKind, RequirementKindRegistryEntry> =
  Object.fromEntries(
    ALL_REQUIREMENT_KINDS.map((kind) => [
      kind,
      {
        kind,
        label: requirementKindLabels[kind],
        evidenceSource: requirementEvidenceSource[kind],
        parserPromptFragment: parserPromptFragments[kind],
        hasSelfAssessmentQuestion: selfAssessmentKinds.has(kind),
        evaluate: evaluateOne,
      },
    ]),
  ) as Record<RequirementKind, RequirementKindRegistryEntry>;

export function buildParserKindInstructions(): string {
  return ALL_REQUIREMENT_KINDS.map(
    (kind) => `- ${requirementKindRegistry[kind].parserPromptFragment}`,
  ).join("\n");
}

export function isRegisteredRequirementKind(value: string): value is RequirementKind {
  return ALL_REQUIREMENT_KINDS.includes(value as RequirementKind);
}

export function evaluateRegisteredRequirement(
  instance: Parameters<typeof evaluateOne>[0],
  context: EvaluationContext,
) {
  return requirementKindRegistry[instance.kind].evaluate(instance, context);
}
