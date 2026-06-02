import type { RequirementInstance } from "./requirements.js";
import {
  evaluateOne,
  type EvaluationContext,
} from "./requirementEvaluators.js";
import type {
  EligibilityRequirementCheck,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types.js";

/**
 * Folds an alternative group (multiple requirements that share an alternativeGroupId) into a single
 * check. Status is the strongest result across the group: pass beats unknown beats fail.
 */
function foldAlternativeGroup(
  groupId: string,
  group: ReadonlyArray<{ instance: RequirementInstance; check: EligibilityRequirementCheck }>,
): EligibilityRequirementCheck {
  const passEntry = group.find((entry) => entry.check.status === "pass");
  if (passEntry) {
    return {
      id: `${groupId}:satisfied`,
      requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
      status: "pass",
      explanation: `One alternative satisfied: ${passEntry.check.explanation}`,
    };
  }

  const unknownEntry = group.find((entry) => entry.check.status === "unknown");
  if (unknownEntry) {
    return {
      id: `${groupId}:unknown`,
      requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
      status: "unknown",
      explanation: `No alternative confirmed. ${unknownEntry.check.explanation}`,
    };
  }

  return {
    id: `${groupId}:failed`,
    requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
    status: "fail",
    explanation: "None of the listed alternatives was satisfied by the supplied evidence.",
  };
}

/**
 * Pure function: given a course's requirement instances and the applicant's extracted evidence (plus
 * the request context as a fallback for form-level values), produce exactly one check per requirement.
 *
 * Requirements sharing an `alternativeGroupId` are folded into a single OR-check that emits in place
 * of the first member of the group.
 */
export function evaluateRequirements(
  instances: readonly RequirementInstance[],
  evidence: TranscriptExtractedData,
  context: TranscriptEligibilityRequestContext,
): EligibilityRequirementCheck[] {
  const evalCtx: EvaluationContext = { context, evidence };

  // Group by alternativeGroupId. Emission order is driven by a second pass over
  // `instances` below, so the group map itself does not need to track order.
  const groups = new Map<
    string,
    Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }>
  >();
  const standalone: Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }> = [];

  for (const instance of instances) {
    const check = evaluateOne(instance, evalCtx);
    // Only fold OR-groups. A mandatory requirement that happens to carry an alternativeGroupId is
    // treated as standalone — sharing an ID is necessary but not sufficient for fold behaviour.
    if (instance.alternativeGroupId && instance.weight === "alternative") {
      const key = instance.alternativeGroupId;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({ instance, check });
    } else {
      standalone.push({ instance, check });
    }
  }

  // Emit in input order: when we hit the first member of a group, emit the folded result; skip later
  // members of that same group.
  const emittedGroups = new Set<string>();
  const out: EligibilityRequirementCheck[] = [];

  for (const instance of instances) {
    if (instance.alternativeGroupId && instance.weight === "alternative") {
      if (emittedGroups.has(instance.alternativeGroupId)) {
        continue;
      }
      emittedGroups.add(instance.alternativeGroupId);
      const group = groups.get(instance.alternativeGroupId);
      // A single-member alternative group is degenerate: it represents an unmatched "ad-hoc entry
      // pathway" clause that the parser was meant to skip. Dropping it here prevents such items from
      // gating eligibility when the applicant satisfies the main mandatory pathway.
      if (group && group.length >= 2) {
        out.push(foldAlternativeGroup(instance.alternativeGroupId, group));
      }
    } else {
      const entry = standalone.find((item) => item.instance.id === instance.id);
      if (entry) {
        out.push(entry.check);
      }
    }
  }

  return out;
}

/**
 * Aggregates per-requirement check statuses into an overall eligibility outcome.
 * Mirrors the precedence used in deterministicRules.ts so the legacy and new paths produce consistent
 * outcome semantics during the migration.
 */
export function aggregateOutcome(checks: ReadonlyArray<EligibilityRequirementCheck>): {
  outcome: "eligible" | "ineligible" | "insufficient_data";
  manualReviewRequired: boolean;
} {
  if (checks.some((check) => check.status === "fail")) {
    return { outcome: "ineligible", manualReviewRequired: false };
  }
  if (checks.some((check) => check.status === "unknown")) {
    return { outcome: "insufficient_data", manualReviewRequired: true };
  }
  return { outcome: "eligible", manualReviewRequired: false };
}
