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

interface DemoPersonaFixture {
  applicantName: string;
  roleMatches: Array<{
    match: (position: string) => boolean;
    value: OscaRoleMatch;
  }>;
}

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

const TRAINING_AND_DEVELOPMENT_PROFESSIONAL = {
  oscaConfidence: "high",
  oscaOccupationCode: "222431",
  oscaOccupationTitle: "Training and Development Professional",
  oscaSkillLevel: 1,
} as const;

const PROGRAM_OR_PROJECT_ADMINISTRATOR = {
  oscaConfidence: "high",
  oscaOccupationCode: "511231",
  oscaOccupationTitle: "Program or Project Administrator",
  oscaSkillLevel: 2,
} as const;

const CALL_OR_CONTACT_CENTRE_OPERATOR = {
  oscaConfidence: "high",
  oscaOccupationCode: "551131",
  oscaOccupationTitle: "Call or Contact Centre Operator",
  oscaSkillLevel: 4,
} as const;

function normalize(value: string) {
  return value
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const DEMO_PERSONA_FIXTURES: DemoPersonaFixture[] = [
  {
    applicantName: "bill shorten",
    roleMatches: [
      {
        match: (position) => position.includes("vice chancellor"),
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
    ],
  },
  {
    applicantName: "maya patel",
    roleMatches: [
      {
        match: (position) =>
          position.includes("learning and development lead") ||
          position.includes("learning and capability lead"),
        value: {
          ...TRAINING_AND_DEVELOPMENT_PROFESSIONAL,
          oscaRationale:
            "Plans, delivers and evaluates organisation-wide learning and capability programs.",
        },
      },
      {
        match: (position) => position === "project coordinator",
        value: {
          ...PROGRAM_OR_PROJECT_ADMINISTRATOR,
          oscaRationale:
            "Coordinated project milestones, records, communications and stakeholder reporting.",
        },
      },
      {
        match: (position) =>
          position === "customer support adviser" ||
          position === "customer service adviser",
        value: {
          ...CALL_OR_CONTACT_CENTRE_OPERATOR,
          oscaRationale:
            "Answered customer enquiries, provided guided support, maintained records and escalated complex cases.",
        },
      },
    ],
  },
];

export function applyUcDemoOscaMatch<T extends OscaMatchedExperience>(
  applicant: DemoApplicant,
  experience: T,
): T {
  const applicantName = normalize(`${applicant.firstName} ${applicant.lastName}`);
  const fixture = DEMO_PERSONA_FIXTURES.find(
    (candidate) => candidate.applicantName === applicantName,
  );

  if (!fixture) {
    return experience;
  }

  const position = normalize(experience.position);
  const fixedMatch = fixture.roleMatches.find((candidate) =>
    candidate.match(position),
  );
  return fixedMatch ? { ...experience, ...fixedMatch.value } : experience;
}
