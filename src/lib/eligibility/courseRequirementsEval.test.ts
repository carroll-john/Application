import { describe, expect, it } from "vitest";
import { evaluateCourseRequirements, isEvalPassing } from "./courseRequirementsEval";
import type { CourseRequirementsV2 } from "./courseRequirementsV2";

describe("courseRequirementsEval", () => {
  it("passes when expected and actual v2 structures match", () => {
    const expected: CourseRequirementsV2 = {
      version: 2,
      global: [],
      pathways: [
        {
          id: "default",
          requirements: [
            {
              id: "completed-bachelor",
              kind: "qualification_completed",
              params: {},
              sourceText: "Bachelor degree.",
              weight: "mandatory",
            },
          ],
        },
      ],
    };

    const result = evaluateCourseRequirements("test-course", expected, expected);
    expect(isEvalPassing(result)).toBe(true);
    expect(result.scores.structureAccuracy).toBe(1);
    expect(result.scores.safetyPass).toBe(true);
  });

  it("fails structure when pathway ids differ", () => {
    const expected: CourseRequirementsV2 = {
      version: 2,
      global: [],
      pathways: [{ id: "pathway-a", requirements: [] }],
    };
    const actual: CourseRequirementsV2 = {
      version: 2,
      global: [],
      pathways: [{ id: "pathway-b", requirements: [] }],
    };

    const result = evaluateCourseRequirements("test-course", expected, actual);
    expect(result.scores.structureAccuracy).toBe(0);
    expect(isEvalPassing(result)).toBe(false);
  });
});
