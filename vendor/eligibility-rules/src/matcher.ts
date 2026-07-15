import type { RequirementInstance } from "./requirements.js";
import { evaluateRegisteredRequirement } from "./requirementKindRegistry.js";
import type { EvaluationContext } from "./requirementEvaluators.js";
import type {
  EligibilityPathwayResult,
  EligibilityRequirementCheck,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types.js";

function pathwayBundleIds(instances: readonly RequirementInstance[]): string[] {
  const ids = new Set<string>();
  for (const instance of instances) {
    if (instance.pathwayBundleId) {
      ids.add(instance.pathwayBundleId);
    }
  }
  return [...ids];
}

function pathwayBundleForInstance(
  instances: readonly RequirementInstance[],
  instanceId: string,
): string | undefined {
  const direct = instances.find((instance) => instance.id === instanceId);
  if (direct?.pathwayBundleId) {
    return direct.pathwayBundleId;
  }
  return undefined;
}

function pathwayBundleForAlternativeGroup(
  instances: readonly RequirementInstance[],
  groupId: string,
): string | undefined {
  const member = instances.find(
    (instance) =>
      instance.alternativeGroupId === groupId && instance.weight === "alternative",
  );
  return member?.pathwayBundleId;
}

function pathwayBundleForCheck(
  instances: readonly RequirementInstance[],
  check: EligibilityRequirementCheck,
): string | undefined {
  if (check.pathwayId) {
    return check.pathwayId;
  }
  const direct = pathwayBundleForInstance(instances, check.id);
  if (direct) {
    return direct;
  }

  const groupDelimiter = check.id.indexOf(":");
  if (groupDelimiter > 0) {
    return pathwayBundleForAlternativeGroup(instances, check.id.slice(0, groupDelimiter));
  }

  return undefined;
}

function summarizePathway(
  id: string,
  checks: EligibilityRequirementCheck[],
): EligibilityPathwayResult {
  const failCount = checks.filter((check) => check.status === "fail").length;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const unknownCount = checks.filter((check) => check.status === "unknown").length;
  const status =
    failCount > 0
      ? "not_satisfied"
      : unknownCount > 0
        ? "pending"
        : "satisfied";

  return { checks, failCount, id, passCount, status, unknownCount };
}

export interface RequirementEvaluationResult {
  checks: EligibilityRequirementCheck[];
  pathwayResults: EligibilityPathwayResult[];
  selectedPathwayId?: string;
}

function pathwayStatusRank(status: EligibilityPathwayResult["status"]): number {
  if (status === "satisfied") {
    return 3;
  }
  if (status === "pending") {
    return 2;
  }
  return 1;
}

/**
 * Selects one coherent entry pathway. Fully satisfied pathways win, followed by pathways with
 * unresolved evidence but no failures, then the closest failed pathway. Ties keep catalog order.
 */
function selectPathwayChecks(
  instances: readonly RequirementInstance[],
  checks: readonly EligibilityRequirementCheck[],
): RequirementEvaluationResult {
  const bundleIds = pathwayBundleIds(instances);
  if (bundleIds.length < 2) {
    return { checks: [...checks], pathwayResults: [] };
  }

  const checksByBundle = new Map<string, EligibilityRequirementCheck[]>();

  for (const check of checks) {
    const bundleId = pathwayBundleForCheck(instances, check);
    if (!bundleId) {
      continue;
    }
    const bucket = checksByBundle.get(bundleId) ?? [];
    bucket.push(check);
    checksByBundle.set(bundleId, bucket);
  }

  const pathwayResults = bundleIds.map((bundleId) =>
    summarizePathway(bundleId, checksByBundle.get(bundleId) ?? []),
  );
  const selected = pathwayResults
    .map((result, index) => ({ index, result }))
    .sort((left, right) => {
      const statusDifference =
        pathwayStatusRank(right.result.status) - pathwayStatusRank(left.result.status);
      if (statusDifference !== 0) {
        return statusDifference;
      }
      if (left.result.failCount !== right.result.failCount) {
        return left.result.failCount - right.result.failCount;
      }
      if (left.result.passCount !== right.result.passCount) {
        return right.result.passCount - left.result.passCount;
      }
      if (left.result.unknownCount !== right.result.unknownCount) {
        return left.result.unknownCount - right.result.unknownCount;
      }
      return left.index - right.index;
    })[0]?.result;

  if (!selected) {
    return { checks: [...checks], pathwayResults };
  }

  return {
    checks: checks.filter((check) => {
      const pathwayId = pathwayBundleForCheck(instances, check);
      return !pathwayId || pathwayId === selected.id;
    }),
    pathwayResults,
    selectedPathwayId: selected.id,
  };
}

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
      reasonCode: "GROUP_SATISFIED",
      ...(passEntry.instance.pathwayBundleId
        ? { pathwayId: passEntry.instance.pathwayBundleId }
        : {}),
      explanation: `One alternative satisfied: ${passEntry.check.explanation}`,
      ...(passEntry.check.details ? { details: passEntry.check.details } : {}),
    };
  }

  const unknownEntry = group.find((entry) => entry.check.status === "unknown");
  if (unknownEntry) {
    return {
      id: `${groupId}:unknown`,
      requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
      status: "unknown",
      reasonCode: "GROUP_UNCONFIRMED",
      ...(unknownEntry.instance.pathwayBundleId
        ? { pathwayId: unknownEntry.instance.pathwayBundleId }
        : {}),
      explanation: `No alternative confirmed. ${unknownEntry.check.explanation}`,
      ...(unknownEntry.check.details ? { details: unknownEntry.check.details } : {}),
    };
  }

  return {
    id: `${groupId}:failed`,
    requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
    status: "fail",
    reasonCode: "GROUP_UNSATISFIED",
    ...(group[0]?.instance.pathwayBundleId
      ? { pathwayId: group[0].instance.pathwayBundleId }
      : {}),
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
export function evaluateRequirementsWithPathways(
  instances: readonly RequirementInstance[],
  evidence: TranscriptExtractedData,
  context: TranscriptEligibilityRequestContext,
): RequirementEvaluationResult {
  const evalCtx: EvaluationContext = { context, evidence };

  // Group by alternativeGroupId. Emission order is driven by a second pass over
  // `instances` below, so the group map itself does not need to track order.
  const groups = new Map<
    string,
    Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }>
  >();
  const standalone: Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }> = [];

  for (const instance of instances) {
    const check = evaluateRegisteredRequirement(instance, evalCtx);
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

  return selectPathwayChecks(instances, out);
}

export function evaluateRequirements(
  instances: readonly RequirementInstance[],
  evidence: TranscriptExtractedData,
  context: TranscriptEligibilityRequestContext,
): EligibilityRequirementCheck[] {
  return evaluateRequirementsWithPathways(instances, evidence, context).checks;
}

/**
 * Aggregates per-requirement check statuses into an overall eligibility outcome.
 *
 * Precedence (strongest signal first):
 *   ineligible            — any failed requirement that is NOT conditional (mandatory / alternative-group)
 *   conditionally_eligible — failures only on conditional requirements
 *   insufficient_data     — no failures, but some checks are unknown
 *   eligible              — everything passed
 *
 * `options.conditionalIds` is the set of check ids whose source requirement has
 * `weight: "conditional"`. When omitted, every failure is treated as hard (the
 * pre-conditional behavior), so existing callers are unaffected.
 */
export function aggregateOutcome(
  checks: ReadonlyArray<EligibilityRequirementCheck>,
  options?: { conditionalIds?: ReadonlySet<string> },
): {
  outcome: "eligible" | "conditionally_eligible" | "ineligible" | "insufficient_data";
  manualReviewRequired: boolean;
} {
  const conditionalIds = options?.conditionalIds;
  const failures = checks.filter((check) => check.status === "fail");
  const hasHardFailure = failures.some((check) => !conditionalIds?.has(check.id));
  const hasConditionalFailure = failures.some((check) => conditionalIds?.has(check.id));

  if (hasHardFailure) {
    return { outcome: "ineligible", manualReviewRequired: false };
  }
  if (hasConditionalFailure) {
    return { outcome: "conditionally_eligible", manualReviewRequired: true };
  }
  if (checks.some((check) => check.status === "unknown")) {
    return { outcome: "insufficient_data", manualReviewRequired: true };
  }
  return { outcome: "eligible", manualReviewRequired: false };
}
