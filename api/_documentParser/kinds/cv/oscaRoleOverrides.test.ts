import { describe, expect, it } from "vitest";
import { applyExactOscaRoleOverride } from "./oscaRoleOverrides";

function experience(position: string) {
  return {
    company: "Example employer",
    oscaConfidence: "low",
    oscaOccupationCode: "999999",
    oscaOccupationTitle: "Previous match",
    oscaRationale: "Previous rationale",
    oscaSkillLevel: 4,
    position,
  };
}

describe("applyExactOscaRoleOverride", () => {
  it.each([
    "Minister for the National Disability Insurance Scheme",
    "Minister for Government Services",
  ])("maps %s to Government Minister", (position) => {
    expect(applyExactOscaRoleOverride(experience(position))).toMatchObject({
      oscaConfidence: "high",
      oscaOccupationCode: "121332",
      oscaOccupationTitle: "Government Minister",
      oscaSkillLevel: 1,
      position,
    });
  });

  it("maps National Secretary to Chief Executive Officer", () => {
    expect(
      applyExactOscaRoleOverride(experience("  NATIONAL   SECRETARY ")),
    ).toMatchObject({
      oscaConfidence: "high",
      oscaOccupationCode: "121131",
      oscaOccupationTitle: "Chief Executive Officer",
      oscaSkillLevel: 1,
    });
  });

  it.each(["Shadow Minister for Government Services", "Assistant National Secretary"])(
    "does not override the nearby title %s",
    (position) => {
      const original = experience(position);

      expect(applyExactOscaRoleOverride(original)).toBe(original);
    },
  );
});
