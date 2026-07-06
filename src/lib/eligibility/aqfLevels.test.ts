import { describe, expect, it } from "vitest";
import {
  classifyQualificationRank,
  classifyQualificationText,
  meetsQualificationLevel,
} from "./aqfLevels";

describe("classifyQualificationText", () => {
  it.each([
    ["Graduate Certificate of Business", "graduate_certificate"],
    ["graduate_certificate", "graduate_certificate"],
    ["Graduate Diploma in Management", "graduate_diploma"],
    ["Bachelor of Commerce", "bachelor"],
    ["Bachelor Honours in Science", "honours"],
    ["Master of Business Administration", "masters"],
    ["Doctor of Philosophy", "doctorate"],
    ["Advanced Diploma of Nursing", "diploma"],
    ["Year 12 Certificate", "high_school"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(classifyQualificationText(input)).toBe(expected);
  });
});

describe("meetsQualificationLevel", () => {
  it("treats graduate certificate as bachelor-or-higher", () => {
    expect(meetsQualificationLevel("graduate_certificate", "bachelor")).toBe(true);
    expect(meetsQualificationLevel("graduate_diploma", "bachelor")).toBe(true);
  });

  it("does not treat diploma as bachelor-or-higher", () => {
    expect(meetsQualificationLevel("diploma", "bachelor")).toBe(false);
  });

  it("treats honours and bachelor as meeting bachelor requirement", () => {
    expect(meetsQualificationLevel("honours", "bachelor")).toBe(true);
    expect(meetsQualificationLevel("bachelor", "bachelor")).toBe(true);
  });
});

describe("classifyQualificationRank", () => {
  it("orders graduate certificate above bachelor", () => {
    const gradCert = classifyQualificationRank("Graduate Certificate");
    const bachelor = classifyQualificationRank("Bachelor degree");
    expect(gradCert).toBeDefined();
    expect(bachelor).toBeDefined();
    expect(gradCert!).toBeGreaterThan(bachelor!);
  });
});
