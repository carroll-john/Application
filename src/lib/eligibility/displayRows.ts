import type {
  RequirementInstance,
  RequirementKind,
} from "./requirements";
import { requirementKindLabel } from "./requirements";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
} from "./types";

export interface EligibilityDisplayRow {
  id: string;
  /**
   * Verbatim entry-requirement sentence to render as the row heading.
   */
  sourceText: string;
  /**
   * Short kind label (e.g. "English language proficiency"); empty string when this row was produced
   * by the legacy path that has no kind metadata.
   */
  kindLabel: string;
  status: EligibilityRequirementStatus;
  explanation: string;
}

const NOT_EVALUATED_EXPLANATION = "Not evaluated automatically — admissions will verify this requirement manually.";

function combineRequirementStatuses(
  ...statuses: Array<EligibilityRequirementStatus | undefined>
): EligibilityRequirementStatus {
  const values = statuses.filter(Boolean) as EligibilityRequirementStatus[];
  if (values.includes("fail")) {
    return "fail";
  }
  if (values.includes("unknown")) {
    return "unknown";
  }
  if (values.length > 0 && values.every((status) => status === "pass")) {
    return "pass";
  }
  return "unknown";
}

function combineExplanations(...parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function findQualificationLevelPartner(
  requirements: readonly RequirementInstance[],
  completion: RequirementInstance,
) {
  if (completion.kind !== "qualification_completed" || completion.alternativeGroupId) {
    return undefined;
  }

  return requirements.find(
    (candidate) =>
      candidate.kind === "qualification_level" &&
      !candidate.alternativeGroupId &&
      candidate.weight === completion.weight &&
      candidate.sourceText === completion.sourceText,
  );
}

/**
 * Builds the list of rows to render in the eligibility result UI.
 *
 * When `requirements` is non-empty, output is driven off the canonical requirement instances: one
 * row per instance, joined to its check by id; a "Not evaluated automatically" row is emitted when
 * the matcher did not produce a check for that instance.
 *
 * When `requirements` is empty (legacy deterministic-rules path), output falls back to the raw
 * check list directly.
 */
export function buildEligibilityDisplayRows(
  requirements: readonly RequirementInstance[] | undefined,
  checks: readonly EligibilityRequirementCheck[],
): EligibilityDisplayRow[] {
  if (!requirements || requirements.length === 0) {
    return checks.map((check) => ({
      id: check.id,
      sourceText: check.requirement,
      kindLabel: "",
      status: check.status,
      explanation: check.explanation,
    }));
  }

  const checksById = new Map<string, EligibilityRequirementCheck>(
    checks.map((check) => [check.id, check]),
  );
  // Alternative-group matcher output uses a synthetic id like "<groupId>:satisfied" — also index by
  // the group id so requirements within the same group can locate their folded result.
  for (const check of checks) {
    const colon = check.id.indexOf(":");
    if (colon > 0) {
      const groupId = check.id.slice(0, colon);
      if (!checksById.has(groupId)) {
        checksById.set(groupId, check);
      }
    }
  }

  const rows: EligibilityDisplayRow[] = [];
  const emittedAlternativeGroups = new Set<string>();
  const skippedRequirementIds = new Set<string>();

  // Pre-count alternative-group members so we can drop degenerate 1-member groups (mirrors the
  // matcher's defense-in-depth behaviour).
  const alternativeGroupSizes = new Map<string, number>();
  for (const instance of requirements) {
    if (instance.alternativeGroupId && instance.weight === "alternative") {
      alternativeGroupSizes.set(
        instance.alternativeGroupId,
        (alternativeGroupSizes.get(instance.alternativeGroupId) ?? 0) + 1,
      );
    }
  }

  for (const instance of requirements) {
    if (skippedRequirementIds.has(instance.id)) {
      continue;
    }

    // Only fold true OR-groups (weight === "alternative"). A mandatory item that happens to carry an
    // alternativeGroupId renders as its own row so users see each hard requirement individually.
    if (instance.alternativeGroupId && instance.weight === "alternative") {
      if (emittedAlternativeGroups.has(instance.alternativeGroupId)) {
        continue;
      }
      emittedAlternativeGroups.add(instance.alternativeGroupId);
      // Drop single-member alternative groups (see matcher.ts for rationale).
      if ((alternativeGroupSizes.get(instance.alternativeGroupId) ?? 0) < 2) {
        continue;
      }
      const groupCheck =
        checksById.get(instance.alternativeGroupId) ?? checksById.get(instance.id);
      rows.push({
        id: instance.alternativeGroupId,
        sourceText: instance.sourceText,
        kindLabel: kindLabelFor(instance.kind),
        status: groupCheck?.status ?? "unknown",
        explanation: groupCheck?.explanation ?? NOT_EVALUATED_EXPLANATION,
      });
      continue;
    }

    if (instance.kind === "qualification_completed") {
      const levelPartner = findQualificationLevelPartner(requirements, instance);
      if (levelPartner) {
        skippedRequirementIds.add(levelPartner.id);
        const completionCheck = checksById.get(instance.id);
        const levelCheck = checksById.get(levelPartner.id);
        rows.push({
          id: instance.id,
          sourceText: instance.sourceText,
          kindLabel: kindLabelFor("qualification_completed"),
          status: combineRequirementStatuses(completionCheck?.status, levelCheck?.status),
          explanation:
            combineExplanations(completionCheck?.explanation, levelCheck?.explanation) ||
            NOT_EVALUATED_EXPLANATION,
        });
        continue;
      }
    }

    const check = checksById.get(instance.id);
    rows.push({
      id: instance.id,
      sourceText: instance.sourceText,
      kindLabel: kindLabelFor(instance.kind),
      status: check?.status ?? "unknown",
      explanation: check?.explanation ?? NOT_EVALUATED_EXPLANATION,
    });
  }

  return rows;
}

function kindLabelFor(kind: RequirementKind): string {
  return requirementKindLabel(kind);
}
