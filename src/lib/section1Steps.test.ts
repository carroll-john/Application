import { describe, expect, it } from "vitest";
import { getSection1Step, section1Steps } from "./section1Steps";

describe("section1Steps", () => {
  it("defines a continuous wizard chain from overview to section 2", () => {
    expect(section1Steps[0]?.previousPath).toBe("/overview");
    expect(section1Steps[0]?.continuePath).toBe(section1Steps[1]?.path);
    expect(section1Steps.at(-1)?.continuePath).toBe("/section2/qualifications");

    for (let index = 1; index < section1Steps.length; index += 1) {
      const step = section1Steps[index];
      const previousStep = section1Steps[index - 1];

      expect(step.previousPath).toBe(previousStep.path);
      expect(previousStep.continuePath).toBe(step.path);
    }
  });

  it("returns stable metadata for each step key", () => {
    const basicInfo = getSection1Step("basic-info");

    expect(basicInfo.path).toBe("/section1/basic-info");
    expect(basicInfo.sectionLabel).toBe("Section 1 of 3");
    expect(basicInfo.progress).toBeGreaterThan(0);
  });
});
