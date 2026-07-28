import { describe, expect, it } from "vitest";
import { brandConfigs } from "./brand";

describe("brand configuration", () => {
  it("keeps StudyNext as the default catalogue and UC isolated", () => {
    expect(brandConfigs.studynext.catalogId).toBe("default");
    expect(brandConfigs.uc.catalogId).toBe("uc");
    expect(brandConfigs.studynext.themeId).toBe("studynext");
    expect(brandConfigs.uc.themeId).toBe("studynext");
    expect(brandConfigs.uc.serviceLabel).toBe("Apply");
    expect(brandConfigs.uc.support.email).not.toMatch(/studynext/i);
  });
});
