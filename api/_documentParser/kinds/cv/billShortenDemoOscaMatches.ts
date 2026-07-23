interface DemoApplicant {
  firstName: string;
  lastName: string;
}

interface OscaMatchedExperience {
  oscaConfidence: string;
  oscaOccupationCode: string;
  oscaOccupationTitle: string;
  oscaRationale: string;
  oscaSkillLevel: number;
  position: string;
}

type OscaRoleMatch = Pick<
  OscaMatchedExperience,
  | "oscaConfidence"
  | "oscaOccupationCode"
  | "oscaOccupationTitle"
  | "oscaRationale"
  | "oscaSkillLevel"
>;

const CHIEF_EXECUTIVE_OFFICER = {
  oscaConfidence: "high",
  oscaOccupationCode: "121131",
  oscaOccupationTitle: "Chief Executive Officer",
  oscaSkillLevel: 1,
} as const;

const GOVERNMENT_MINISTER = {
  oscaConfidence: "high",
  oscaOccupationCode: "121332",
  oscaOccupationTitle: "Government Minister",
  oscaSkillLevel: 1,
} as const;

const MEMBER_OF_PARLIAMENT = {
  oscaConfidence: "high",
  oscaOccupationCode: "121332",
  oscaOccupationTitle: "Member of Parliament",
  oscaSkillLevel: 1,
} as const;

const FIXED_ROLE_MATCHES: Array<{
  match: (position: string) => boolean;
  value: OscaRoleMatch;
}> = [
  {
    match: (position) => position.includes("vice-chancellor"),
    value: {
      ...CHIEF_EXECUTIVE_OFFICER,
      oscaRationale:
        "Leads the university and sets its overall organisational direction.",
    },
  },
  {
    match: (position) =>
      position.startsWith("minister for ") &&
      (position.includes("national disability insurance scheme") ||
        position.includes("government services")),
    value: {
      ...GOVERNMENT_MINISTER,
      oscaRationale:
        "Held Cabinet responsibility for an Australian Government portfolio.",
    },
  },
  {
    match: (position) => position.startsWith("shadow minister for "),
    value: {
      ...MEMBER_OF_PARLIAMENT,
      oscaRationale:
        "Held an opposition portfolio while serving as a federal parliamentarian.",
    },
  },
  {
    match: (position) => position.includes("leader of the opposition"),
    value: {
      ...MEMBER_OF_PARLIAMENT,
      oscaRationale: "Led the federal parliamentary opposition.",
    },
  },
  {
    match: (position) =>
      position.includes("member of the house of representatives") ||
      position.includes("member of parliament"),
    value: {
      ...MEMBER_OF_PARLIAMENT,
      oscaRationale:
        "Served as the elected Member of the House of Representatives for Maribyrnong.",
    },
  },
  {
    match: (position) => position.includes("national secretary"),
    value: {
      ...CHIEF_EXECUTIVE_OFFICER,
      oscaRationale:
        "Led the Australian Workers' Union nationally and directed its organisational activity.",
    },
  },
];

function normalize(value: string) {
  return value
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isBillShortenDemoApplicant(applicant: DemoApplicant) {
  return normalize(`${applicant.firstName} ${applicant.lastName}`) === "bill shorten";
}

export function applyBillShortenDemoOscaMatch<T extends OscaMatchedExperience>(
  applicant: DemoApplicant,
  experience: T,
): T {
  if (!isBillShortenDemoApplicant(applicant)) {
    return experience;
  }

  const position = normalize(experience.position);
  const fixedMatch = FIXED_ROLE_MATCHES.find((candidate) =>
    candidate.match(position),
  );
  return fixedMatch ? { ...experience, ...fixedMatch.value } : experience;
}
