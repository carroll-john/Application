import { describe, expect, it } from "vitest";
import type { RequirementInstance } from "../eligibility/requirements";
import { getCourseCatalog } from "./buildCatalog";
import generated from "./requirements.generated.json";
import { getGeneratedRequirementsForCourse, isMatcherUnsafe } from "./requirementsLoader";
import { FALLBACK_COURSE_CODES } from "../eligibility/courseRequirementsGolden";

describe("isMatcherUnsafe", () => {
  it("treats a clean single-pathway course as safe", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "completed-bachelor",
        kind: "qualification_completed",
        params: {},
        sourceText: "Completion of a bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "wam-65",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
      {
        id: "english-ielts",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [
            { type: "english_test", test: "IELTS", minOverall: 6.5, minBand: 6 },
          ],
        },
        sourceText: "IELTS 6.5 overall.",
        weight: "mandatory",
      },
    ];

    expect(isMatcherUnsafe(requirements)).toBe(false);
  });

  it("flags courses with multiple flattened qualification pathways", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "bachelor-honours-related",
        kind: "qualification_completed",
        params: {},
        sourceText: "Bachelor honours in a related discipline.",
        weight: "mandatory",
      },
      {
        id: "graduate-cert-related",
        kind: "qualification_completed",
        params: {},
        sourceText: "Graduate certificate in a related discipline.",
        weight: "mandatory",
      },
      {
        id: "bachelor-any",
        kind: "qualification_completed",
        params: {},
        sourceText: "Bachelor degree or higher in any discipline.",
        weight: "mandatory",
      },
    ];

    expect(isMatcherUnsafe(requirements)).toBe(true);
  });

  it("flags courses with multiple mandatory fields of study", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "field-related-1",
        kind: "field_of_study",
        params: { acceptedAreas: ["Marketing"] },
        sourceText: "Prior study in a related discipline (Marketing).",
        weight: "mandatory",
      },
      {
        id: "field-related-2",
        kind: "field_of_study",
        params: { acceptedAreas: ["Communications"] },
        sourceText: "Prior study in a related discipline (Communications).",
        weight: "mandatory",
      },
    ];

    expect(isMatcherUnsafe(requirements)).toBe(true);
  });

  it("flags courses with two or more distinct alternative groups (multi-pathway)", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "entry-a-1",
        kind: "qualification_completed",
        params: {},
        sourceText: "Pathway A: bachelor in related discipline.",
        weight: "alternative",
        alternativeGroupId: "pathway-a",
      },
      {
        id: "entry-a-2",
        kind: "work_experience",
        params: { minYears: 2 },
        sourceText: "Pathway A: 2 years experience.",
        weight: "alternative",
        alternativeGroupId: "pathway-a",
      },
      {
        id: "entry-b-1",
        kind: "qualification_completed",
        params: {},
        sourceText: "Pathway B: graduate diploma.",
        weight: "alternative",
        alternativeGroupId: "pathway-b",
      },
      {
        id: "entry-b-2",
        kind: "work_experience",
        params: { minYears: 5 },
        sourceText: "Pathway B: 5 years experience.",
        weight: "alternative",
        alternativeGroupId: "pathway-b",
      },
    ];

    expect(isMatcherUnsafe(requirements)).toBe(true);
  });

  it("does NOT flag courses where multi-pathway is correctly expressed via a single OR group", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "bachelor-honours",
        kind: "qualification_completed",
        params: {},
        sourceText: "Bachelor honours in a related discipline.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
      {
        id: "graduate-cert",
        kind: "qualification_completed",
        params: {},
        sourceText: "Graduate certificate in a related discipline.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
    ];

    expect(isMatcherUnsafe(requirements)).toBe(false);
  });
});

/**
 * Locks matcher-vs-fallback routing for the whole generated catalog. After v2 pathway
 * migration, only courses with empty/unparseable requirements should fall back to
 * deterministicRules (see FALLBACK_COURSE_CODES).
 *
 * The explicit FALLBACK_COURSES list means any change in how a course routes (e.g. after re-running
 * scripts/parse-course-requirements.ts) shows up here as a failing test that must be consciously
 * reviewed, rather than silently shifting a course between the two evaluation engines.
 */
describe("catalog requirement routing", () => {
  // Derive codes from the real catalog (not the generated file's keys) so that a course added to
  // courses.raw.json without a matching generated entry is caught here instead of silently routing
  // to the legacy fallback.
  const courseCodes = getCourseCatalog().map((course) => course.code);

  const FALLBACK_COURSES = new Set<string>([...FALLBACK_COURSE_CODES]);

  it("every catalog course has a generated requirements entry", () => {
    const generatedKeys = new Set(
      Object.keys((generated as { courses: Record<string, unknown[]> }).courses),
    );
    const missing = courseCodes.filter((code) => !generatedKeys.has(code));
    // A catalog course with no generated entry would silently route to the legacy fallback;
    // fail loudly so the parser is re-run (or the fallback list is updated deliberately).
    expect(missing).toEqual([]);
  });

  it("exactly the documented courses fall back to the legacy engine", () => {
    const actualFallback = courseCodes
      .filter((code) => getGeneratedRequirementsForCourse(code) === undefined)
      .sort();
    expect(actualFallback).toEqual([...FALLBACK_COURSES].sort());
  });

  it("every matcher-exposed course is non-empty and matcher-safe", () => {
    for (const code of courseCodes) {
      const exposed = getGeneratedRequirementsForCourse(code);
      if (!exposed) continue;
      expect(exposed.length).toBeGreaterThan(0);
      expect(isMatcherUnsafe(exposed)).toBe(false);
    }
  });

  it("the matcher covers the majority of the catalog", () => {
    const matcherCount = courseCodes.filter(
      (code) => getGeneratedRequirementsForCourse(code) !== undefined,
    ).length;
    expect(matcherCount).toBeGreaterThan(courseCodes.length / 2);
  });
});
