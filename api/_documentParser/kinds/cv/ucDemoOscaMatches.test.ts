import { describe, expect, it } from "vitest";
import { applyUcDemoOscaMatch } from "./ucDemoOscaMatches";

const billShorten = { firstName: "Bill", lastName: "Shorten" };
const mayaPatel = { firstName: "Maya", lastName: "Patel" };

function experience(position: string) {
  return {
    company: "Example employer",
    oscaConfidence: "low",
    oscaOccupationCode: "999999",
    oscaOccupationTitle: "Model-produced match",
    oscaRationale: "Model-produced rationale",
    oscaSkillLevel: 4,
    position,
  };
}

describe("applyUcDemoOscaMatch", () => {
  it.each([
    ["Vice-Chancellor and President", "121131", "Chief Executive Officer"],
    [
      "Minister for the National Disability Insurance Scheme",
      "121332",
      "Government Minister",
    ],
    ["Minister for Government Services", "121332", "Government Minister"],
    [
      "Shadow Minister for the National Disability Insurance Scheme",
      "121332",
      "Member of Parliament",
    ],
    ["Leader of the Opposition", "121332", "Member of Parliament"],
    [
      "Member of the House of Representatives - Maribyrnong",
      "121332",
      "Member of Parliament",
    ],
    ["National Secretary", "121131", "Chief Executive Officer"],
  ])("preserves the Bill fixture for %s", (position, code, title) => {
    const result = applyUcDemoOscaMatch(billShorten, experience(position));

    expect(result).toMatchObject({
      oscaConfidence: "high",
      oscaOccupationCode: code,
      oscaOccupationTitle: title,
      oscaSkillLevel: 1,
      position,
    });
    expect(result.oscaRationale).not.toBe("Model-produced rationale");
  });

  it.each([
    [
      "Learning and Development Lead",
      "222431",
      "Training and Development Professional",
      1,
    ],
    [
      "Project Coordinator",
      "511231",
      "Program or Project Administrator",
      2,
    ],
    [
      "Customer Support Adviser",
      "551131",
      "Call or Contact Centre Operator",
      4,
    ],
  ])(
    "fixes Maya's %s role to OSCA %s",
    (position, code, title, skillLevel) => {
      const result = applyUcDemoOscaMatch(mayaPatel, experience(position));

      expect(result).toMatchObject({
        oscaConfidence: "high",
        oscaOccupationCode: code,
        oscaOccupationTitle: title,
        oscaSkillLevel: skillLevel,
        position,
      });
      expect(result.oscaRationale).not.toBe("Model-produced rationale");
    },
  );

  it.each([
    ["  MAYA ", " PATEL ", "Learning & Development Lead", "222431"],
    ["  BILL ", " SHORTEN ", "Member of Parliament (Maribyrnong)", "121332"],
  ])(
    "normalizes applicant spacing and role punctuation",
    (firstName, lastName, position, code) => {
      expect(
        applyUcDemoOscaMatch(
          { firstName, lastName },
          experience(position),
        ),
      ).toMatchObject({ oscaOccupationCode: code });
    },
  );

  it("accepts the Bill minister title without the optional article", () => {
    expect(
      applyUcDemoOscaMatch(
        billShorten,
        experience("Minister for National Disability Insurance Scheme"),
      ),
    ).toMatchObject({
      oscaOccupationCode: "121332",
      oscaOccupationTitle: "Government Minister",
    });
  });

  it("leaves a listed role untouched for another applicant", () => {
    const original = experience("Learning and Development Lead");

    expect(
      applyUcDemoOscaMatch(
        { firstName: "Alex", lastName: "Morgan" },
        original,
      ),
    ).toBe(original);
  });

  it("leaves an unlisted demo-persona role untouched", () => {
    const original = experience("Additional demo role");

    expect(applyUcDemoOscaMatch(mayaPatel, original)).toBe(original);
  });
});
