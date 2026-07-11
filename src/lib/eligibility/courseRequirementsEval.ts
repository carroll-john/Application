import { createHash } from "node:crypto";
import {
  flattenCourseRequirementsV2,
  isCourseRequirementsV2,
  isMatcherUnsafe,
  type CourseRequirementsV2,
} from "./courseRequirementsV2";
import type { RequirementKind } from "./requirements";

export interface CourseRequirementsEvalScores {
  leafRecall: number;
  paramAccuracy: number;
  structureAccuracy: number;
  sourceTextFidelity: number;
  safetyPass: boolean;
}

export interface CourseRequirementsEvalResult {
  courseCode: string;
  scores: CourseRequirementsEvalScores;
  missingLeafIds: string[];
  paramMismatches: string[];
  structureMismatches: string[];
  sourceTextMismatches: string[];
}

function stableLeafKey(requirement: RequirementInstance): string {
  return `${requirement.id}:${requirement.kind}`;
}

function normalizeParamsForCompare(params: RequirementInstance["params"]): string {
  return JSON.stringify(params, (_key, value) => (value === undefined ? null : value));
}

function collectLeaves(entry: unknown): RequirementInstance[] {
  if (isCourseRequirementsV2(entry)) {
    return flattenCourseRequirementsV2(entry);
  }
  if (Array.isArray(entry)) {
    return entry as RequirementInstance[];
  }
  return [];
}

function pathwaySignature(entry: unknown): string {
  if (!isCourseRequirementsV2(entry)) {
    if (Array.isArray(entry) && entry.length === 0) {
      return "v2:g[]p[]c[]";
    }
    return "flat";
  }
  const globalKinds = entry.global.map((requirement) => requirement.kind).sort().join(",");
  const pathwayIds = entry.pathways.map((pathway) => pathway.id).sort().join("|");
  const pathwayCounts = entry.pathways
    .map((pathway) => `${pathway.id}:${pathway.requirements.length}`)
    .sort()
    .join("|");
  return `v2:g[${globalKinds}]p[${pathwayIds}]c[${pathwayCounts}]`;
}

function compareStructure(expected: unknown, actual: unknown): string[] {
  const mismatches: string[] = [];
  if (pathwaySignature(expected) !== pathwaySignature(actual)) {
    mismatches.push(
      `structure: expected ${pathwaySignature(expected)}, actual ${pathwaySignature(actual)}`,
    );
  }

  if (isCourseRequirementsV2(expected) && isCourseRequirementsV2(actual)) {
    for (const expectedPathway of expected.pathways) {
      const actualPathway = actual.pathways.find((pathway) => pathway.id === expectedPathway.id);
      if (!actualPathway) {
        mismatches.push(`missing pathway: ${expectedPathway.id}`);
      }
    }
    for (const expectedGlobal of expected.global) {
      const actualGlobal = actual.global.find(
        (requirement) => requirement.id === expectedGlobal.id,
      );
      if (!actualGlobal) {
        mismatches.push(`missing global requirement: ${expectedGlobal.id}`);
      }
    }
  }

  return mismatches;
}

function compareSourceText(
  expectedLeaves: RequirementInstance[],
  actualLeaves: RequirementInstance[],
): string[] {
  const mismatches: string[] = [];
  const actualById = new Map(actualLeaves.map((leaf) => [leaf.id, leaf]));

  for (const expected of expectedLeaves) {
    const actual = actualById.get(expected.id);
    if (!actual) {
      continue;
    }
    if (actual.sourceText.trim() !== expected.sourceText.trim()) {
      mismatches.push(`sourceText:${expected.id}`);
    }
  }

  return mismatches;
}

function compareParams(
  expectedLeaves: RequirementInstance[],
  actualLeaves: RequirementInstance[],
): string[] {
  const mismatches: string[] = [];
  const actualById = new Map(actualLeaves.map((leaf) => [leaf.id, leaf]));

  for (const expected of expectedLeaves) {
    const actual = actualById.get(expected.id);
    if (!actual) {
      continue;
    }
    if (
      normalizeParamsForCompare(expected.params) !== normalizeParamsForCompare(actual.params)
    ) {
      mismatches.push(`params:${expected.id}`);
    }
    if (expected.weight !== actual.weight) {
      mismatches.push(`weight:${expected.id}`);
    }
    if (expected.alternativeGroupId !== actual.alternativeGroupId) {
      mismatches.push(`alternativeGroupId:${expected.id}`);
    }
  }

  return mismatches;
}

export function hashEntryRequirementsText(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export function evaluateCourseRequirements(
  courseCode: string,
  expected: unknown,
  actual: unknown,
): CourseRequirementsEvalResult {
  const expectedLeaves = collectLeaves(expected);
  const actualLeaves = collectLeaves(actual);
  const expectedKeys = new Set(expectedLeaves.map(stableLeafKey));
  const actualKeys = new Set(actualLeaves.map(stableLeafKey));

  const missingLeafIds = [...expectedKeys].filter((key) => !actualKeys.has(key));
  const leafRecall =
    expectedKeys.size === 0 ? 1 : (expectedKeys.size - missingLeafIds.length) / expectedKeys.size;

  const paramMismatches = compareParams(expectedLeaves, actualLeaves);
  const paramAccuracy =
    expectedLeaves.length === 0
      ? 1
      : (expectedLeaves.length - paramMismatches.length) / expectedLeaves.length;

  const structureMismatches = compareStructure(expected, actual);
  const structureAccuracy = structureMismatches.length === 0 ? 1 : 0;

  const sourceTextMismatches = compareSourceText(expectedLeaves, actualLeaves);
  const sourceTextFidelity =
    expectedLeaves.length === 0
      ? 1
      : (expectedLeaves.length - sourceTextMismatches.length) / expectedLeaves.length;

  const safetyPass = !isMatcherUnsafe(actualLeaves);

  return {
    courseCode,
    scores: {
      leafRecall,
      paramAccuracy,
      structureAccuracy,
      sourceTextFidelity,
      safetyPass,
    },
    missingLeafIds,
    paramMismatches,
    structureMismatches,
    sourceTextMismatches,
  };
}

export function summarizeKindCoverage(
  requirements: readonly RequirementInstance[],
): Record<RequirementKind, number> {
  const counts = {} as Record<RequirementKind, number>;
  for (const requirement of requirements) {
    counts[requirement.kind] = (counts[requirement.kind] ?? 0) + 1;
  }
  return counts;
}

export function isEvalPassing(result: CourseRequirementsEvalResult): boolean {
  return (
    result.scores.structureAccuracy === 1 &&
    result.scores.safetyPass &&
    result.scores.leafRecall >= 0.8
  );
}

export type { CourseRequirementsV2 };
