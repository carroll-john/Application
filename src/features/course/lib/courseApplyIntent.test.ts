import { describe, expect, it } from "vitest";
import {
  buildCourseApplyRedirectPath,
  hasAutoApplyIntent,
} from "./courseApplyIntent";

describe("buildCourseApplyRedirectPath", () => {
  it("builds an auto-apply redirect for the given course", () => {
    expect(buildCourseApplyRedirectPath("DATA-SCI")).toBe(
      "/courses/DATA-SCI?apply=1&eligible=1",
    );
  });

  it("produces a path the auto-apply predicate accepts", () => {
    const path = buildCourseApplyRedirectPath("MBA");
    const search = path.slice(path.indexOf("?"));

    expect(hasAutoApplyIntent(new URLSearchParams(search))).toBe(true);
  });
});

describe("hasAutoApplyIntent", () => {
  it("requires both the apply and eligible flags", () => {
    expect(hasAutoApplyIntent(new URLSearchParams("apply=1&eligible=1"))).toBe(
      true,
    );
    expect(hasAutoApplyIntent(new URLSearchParams("apply=1"))).toBe(false);
    expect(hasAutoApplyIntent(new URLSearchParams("eligible=1"))).toBe(false);
    expect(hasAutoApplyIntent(new URLSearchParams(""))).toBe(false);
  });
});
