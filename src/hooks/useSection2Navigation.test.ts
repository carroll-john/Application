import { describe, expect, it } from "vitest";
import { SECTION2_QUALIFICATIONS_PATH } from "../lib/section2Steps";
import { createSection2NavigationPaths } from "./useSection2Navigation";

describe("createSection2NavigationPaths", () => {
  it("returns the qualifications path during normal wizard flow", () => {
    const paths = createSection2NavigationPaths((path) => path);

    expect(paths.qualificationsHubPath).toBe(SECTION2_QUALIFICATIONS_PATH);
    expect(paths.qualificationsPath).toBe(SECTION2_QUALIFICATIONS_PATH);
    expect(paths.returnToQualificationsPath).toBe(SECTION2_QUALIFICATIONS_PATH);
  });

  it("returns review when editing from review", () => {
    const paths = createSection2NavigationPaths((path) =>
      path === SECTION2_QUALIFICATIONS_PATH ? "/review" : path,
    );

    expect(paths.qualificationsHubPath).toBe(SECTION2_QUALIFICATIONS_PATH);
    expect(paths.qualificationsPath).toBe("/review");
    expect(paths.returnToQualificationsPath).toBe("/review");
  });
});
