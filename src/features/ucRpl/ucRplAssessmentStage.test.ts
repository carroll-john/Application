import { describe, expect, it } from "vitest";
import {
  shouldShowUcCourseCatalogue,
  type UcRplAssessmentStage,
} from "./ucRplAssessmentStage";

describe("shouldShowUcCourseCatalogue", () => {
  it("keeps the catalogue on the initial CV upload screen", () => {
    expect(shouldShowUcCourseCatalogue("intro")).toBe(true);
  });

  it.each<UcRplAssessmentStage>(["parsing", "review", "results"])(
    "hides the catalogue during the %s screen",
    (stage) => {
      expect(shouldShowUcCourseCatalogue(stage)).toBe(false);
    },
  );
});
