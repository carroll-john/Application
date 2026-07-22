import { describe, expect, it } from "vitest";
import { applyBillShortenDemoOscaMatch } from "./billShortenDemoOscaMatches";

const billShorten = { firstName: "Bill", lastName: "Shorten" };

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

describe("applyBillShortenDemoOscaMatch", () => {
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
  ])("fixes %s to %s %s", (position, code, title) => {
    const result = applyBillShortenDemoOscaMatch(
      billShorten,
      experience(position),
    );

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
    "Member of the House of Representatives — Maribyrnong",
    "Member of Parliament (Maribyrnong)",
  ])("normalizes applicant spacing and the role variant %s", (position) => {
    expect(
      applyBillShortenDemoOscaMatch(
        { firstName: "  BILL ", lastName: " SHORTEN " },
        experience(position),
      ),
    ).toMatchObject({
      oscaOccupationCode: "121332",
      oscaOccupationTitle: "Member of Parliament",
    });
  });

  it("accepts the minister title without the optional article", () => {
    expect(
      applyBillShortenDemoOscaMatch(
        billShorten,
        experience("Minister for National Disability Insurance Scheme"),
      ),
    ).toMatchObject({
      oscaOccupationCode: "121332",
      oscaOccupationTitle: "Government Minister",
    });
  });

  it("leaves the same role untouched for another applicant", () => {
    const original = experience("National Secretary");

    expect(
      applyBillShortenDemoOscaMatch(
        { firstName: "Alex", lastName: "Morgan" },
        original,
      ),
    ).toBe(original);
  });

  it("leaves an unlisted Bill Shorten role untouched", () => {
    const original = experience("Additional demo role");

    expect(applyBillShortenDemoOscaMatch(billShorten, original)).toBe(original);
  });
});
