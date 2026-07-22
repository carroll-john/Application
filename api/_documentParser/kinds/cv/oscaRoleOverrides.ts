interface OscaMatchedExperience {
  oscaConfidence: string;
  oscaOccupationCode: string;
  oscaOccupationTitle: string;
  oscaRationale: string;
  oscaSkillLevel: number;
  position: string;
}

type OscaRoleOverride = Pick<
  OscaMatchedExperience,
  | "oscaConfidence"
  | "oscaOccupationCode"
  | "oscaOccupationTitle"
  | "oscaRationale"
  | "oscaSkillLevel"
>;

const GOVERNMENT_MINISTER: OscaRoleOverride = {
  oscaConfidence: "high",
  oscaOccupationCode: "121332",
  oscaOccupationTitle: "Government Minister",
  oscaRationale:
    "The role is explicitly a government ministerial appointment, matching the OSCA Government Minister specialisation.",
  oscaSkillLevel: 1,
};

const CHIEF_EXECUTIVE_OFFICER: OscaRoleOverride = {
  oscaConfidence: "high",
  oscaOccupationCode: "121131",
  oscaOccupationTitle: "Chief Executive Officer",
  oscaRationale:
    "The National Secretary role is mapped to the OSCA Chief Executive Officer alternative title for this prototype.",
  oscaSkillLevel: 1,
};

const EXACT_ROLE_OVERRIDES = new Map<string, OscaRoleOverride>([
  [
    "minister for the national disability insurance scheme",
    GOVERNMENT_MINISTER,
  ],
  ["minister for government services", GOVERNMENT_MINISTER],
  ["national secretary", CHIEF_EXECUTIVE_OFFICER],
]);

function normalizeRoleTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function applyExactOscaRoleOverride<T extends OscaMatchedExperience>(
  experience: T,
): T {
  const override = EXACT_ROLE_OVERRIDES.get(
    normalizeRoleTitle(experience.position),
  );

  return override ? { ...experience, ...override } : experience;
}
