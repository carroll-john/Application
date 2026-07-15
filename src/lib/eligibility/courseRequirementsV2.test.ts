import { describe, expect, it } from "vitest";
import {
  flattenCourseRequirementsV2,
  isMatcherUnsafe,
  isSinglePathwayUnsafe,
  validateCourseRequirementsV2,
  type CourseRequirementsV2,
} from "./courseRequirementsV2";
import type { RequirementInstance } from "./requirements";

describe("courseRequirementsV2", () => {
  it("flattens pathway-scoped requirements with pathwayBundleId", () => {
    const v2: CourseRequirementsV2 = {
      version: 2,
      global: [
        {
          id: "english",
          kind: "english_proficiency",
          params: {
            acceptedPathways: [{ type: "english_test", test: "IELTS", minOverall: 6.5 }],
          },
          sourceText: "IELTS 6.5",
          weight: "mandatory",
        },
      ],
      pathways: [
        {
          id: "pathway-a",
          label: "Related discipline",
          requirements: [
            {
              id: "completed-bachelor",
              kind: "qualification_completed",
              params: {},
              sourceText: "Bachelor in related discipline.",
              weight: "mandatory",
            },
          ],
        },
        {
          id: "pathway-b",
          requirements: [
            {
              id: "completed-any",
              kind: "qualification_completed",
              params: {},
              sourceText: "Bachelor in any discipline.",
              weight: "mandatory",
            },
          ],
        },
      ],
    };

    const flattened = flattenCourseRequirementsV2(v2);
    expect(flattened).toHaveLength(3);
    expect(flattened.filter((requirement) => !requirement.pathwayBundleId)).toHaveLength(1);
    expect(
      flattened.filter((requirement) => requirement.pathwayBundleId === "pathway-a"),
    ).toHaveLength(1);
    expect(isMatcherUnsafe(flattened)).toBe(false);
    expect(validateCourseRequirementsV2(v2)).toEqual([]);
  });

  it("flags unsafe flat lists without pathway containers", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "a",
        kind: "qualification_completed",
        params: {},
        sourceText: "Pathway A",
        weight: "mandatory",
      },
      {
        id: "b",
        kind: "qualification_completed",
        params: {},
        sourceText: "Pathway B",
        weight: "mandatory",
      },
    ];
    expect(isSinglePathwayUnsafe(requirements)).toBe(true);
    expect(isMatcherUnsafe(requirements)).toBe(true);
  });

  it("rejects GPA thresholds without a plausible scale", () => {
    const v2: CourseRequirementsV2 = {
      version: 2,
      global: [],
      pathways: [
        {
          id: "entry",
          requirements: [
            {
              id: "invalid-gpa",
              kind: "academic_threshold",
              params: { metric: "gpa", min: 60 },
              sourceText: "Equivalent GPA.",
              weight: "mandatory",
            },
          ],
        },
      ],
    };

    expect(validateCourseRequirementsV2(v2)).toContainEqual(
      expect.objectContaining({ code: "GPA_SCALE_INVALID" }),
    );
  });
});
