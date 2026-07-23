import { describe, expect, it } from "vitest";
import { brandConfigs } from "./brand";

describe("brand configuration", () => {
  it("keeps StudyNext as the default catalogue and UC isolated", () => {
    expect(brandConfigs.studynext.catalogId).toBe("default");
    expect(brandConfigs.uc.catalogId).toBe("uc");
    expect(brandConfigs.uc.logo?.alt).toBe("University of Canberra");
    expect(brandConfigs.uc.support.email).not.toMatch(/studynext/i);
  });
});
