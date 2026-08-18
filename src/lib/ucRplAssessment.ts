import type {
  ApplicationData,
  EmploymentExperience,
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "./applicationData";
import type { CourseCatalogEntry } from "./courseCatalog";
import {
  assessUcOscaSkilledWorkPathway,
  assessUcWorkExperienceEntry,
  type UcPriorStudyCategory,
  type UcWorkEntryPathwayAssessment,
  type UcWorkEntryPathwayType,
  type UcWorkEntryStatus,
} from "./eligibility/ucWorkExperienceEntry";

export type OscaSkillLevel = 1 | 2 | 3 | 4 | 5;
export type OscaConfidence = "high" | "medium" | "low";
export type UcGuidanceConfidence = "high" | "medium" | "low";

export interface CvRecognitionExperience extends EmploymentExperience {
  includeInAssessment: boolean;
  oscaConfidence: OscaConfidence;
  oscaOccupationCode: string;
  oscaOccupationTitle: string;
  oscaRationale: string;
  oscaSkillLevel: OscaSkillLevel | null;
}

export interface CvRecognitionProfile {
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  title: string;
}

export interface CvRecognitionDraft {
  experiences: CvRecognitionExperience[];
  model?: string;
  professionalAccreditations: ProfessionalAccreditation[];
  profile: CvRecognitionProfile;
  secondaryQualifications: SecondaryQualification[];
  tertiaryQualifications: TertiaryQualification[];
}

export interface UcAdmissionAssessment {
  experienceMonths: number;
  experienceYears: number;
  occupationCode: string;
  occupationTitle: string;
  rationale: string;
  skillLevel: OscaSkillLevel | null;
  status: "may_meet" | "needs_review";
}

export interface UcCourseMatch {
  admissionDetail: string;
  category: "best_match" | "needs_review" | "other";
  creditConfidence: UcGuidanceConfidence;
  course: CourseCatalogEntry;
  creditDetail: string;
  entryConfidence: UcGuidanceConfidence;
  entryPathway: UcWorkEntryPathwayType;
  entryStatus: UcWorkEntryStatus;
  relevanceScore: number;
}

export type UcOscaExperienceSummaryKey =
  | `level-${OscaSkillLevel}`
  | "needs-review";

export interface UcOscaExperienceSummary {
  experienceMonths: number;
  experienceYears: number;
  includedRoleCount: number;
  key: UcOscaExperienceSummaryKey;
  roles: CvRecognitionExperience[];
  skillLevel: OscaSkillLevel | null;
}

export interface UcExperienceReviewSummary {
  headline: string;
  points: string[];
}

const MONTH_INDEX = new Map(
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((month, index) => [month.toLowerCase(), index]),
);

const STOP_WORDS = new Set([
  "and",
  "for",
  "from",
  "into",
  "of",
  "the",
  "this",
  "to",
  "with",
  "your",
]);

const RELATED_TERMS: Record<string, string[]> = {
  administration: ["business", "management", "leadership", "governance"],
  analyst: ["analytics", "data", "business", "research"],
  business: ["administration", "leadership", "management", "strategy"],
  chancellor: ["leadership", "management", "strategy"],
  cyber: ["security", "technology", "information", "digital"],
  education: ["teaching", "learning"],
  educational: ["education", "teaching", "learning"],
  engineer: ["technology", "systems", "project", "management"],
  executive: ["leadership", "management", "strategy"],
  health: ["public", "clinical", "care", "leadership"],
  laws: ["law", "legal"],
  lead: ["leadership"],
  leader: ["leadership"],
  leaders: ["leadership"],
  leading: ["leadership"],
  leads: ["leadership"],
  llb: ["law", "legal", "juris"],
  manager: ["management", "leadership", "business", "strategy"],
  marketing: ["communication", "business", "digital", "strategy"],
  mba: ["business", "administration", "management"],
  project: ["management", "leadership", "business", "delivery"],
  president: ["leadership", "strategy"],
  public: ["government", "policy", "administration", "leadership"],
  strategic: ["strategy"],
  technology: ["information", "digital", "data", "systems"],
  university: ["education", "learning", "research"],
};

const QUALIFICATION_AWARD_TERMS = new Set([
  "advanced",
  "award",
  "bachelor",
  "bachelors",
  "certificate",
  "degree",
  "diploma",
  "graduate",
  "master",
  "masters",
  "postgraduate",
  "qualification",
  "undergraduate",
]);

const TRANSFERABLE_PROFILE_TERMS = new Set([
  "capability",
  "leadership",
  "management",
  "practice",
  "professional",
  "research",
  "strategy",
]);

const SPECIALIST_DOMAIN_GUARDS = [
  ["building", "construction"],
  ["counselling"],
  ["education", "teaching"],
  ["law", "legal"],
  ["nursing", "clinical"],
  ["social"],
] as const;

const SPECIALIST_COURSE_EVIDENCE = [
  {
    matches: (course: CourseCatalogEntry) => /\bstem\b/i.test(course.title),
    terms: ["engineering", "mathematics", "maths", "science", "scientific", "stem"],
  },
  {
    matches: (course: CourseCatalogEntry) =>
      /^master of teaching\b/i.test(course.title),
    terms: ["classroom", "curriculum", "pedagogy", "school", "teacher", "teaching"],
  },
  {
    matches: (course: CourseCatalogEntry) =>
      /\btesol\b/i.test(course.title) ||
      /^teaching english as a second language\b/i.test(course.title),
    terms: ["efl", "english", "esl", "language", "linguistics", "tesol"],
  },
] as const;

const POLICY_OR_GOVERNMENT_EVIDENCE_TERMS = [
  "government",
  "policy",
  "regulatory",
  "minister",
  "department",
  "council",
] as const;

const BEST_MATCH_LIMIT = 3;

const EXPERIENCE_YEAR_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function directTokens(value: string) {
  return new Set(
    normalizeKey(value)
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function tokenize(value: string) {
  const tokens = directTokens(value);
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    RELATED_TERMS[token]?.forEach((related) => expanded.add(related));
  });

  return expanded;
}

function overlapCount(left: Set<string>, right: Set<string>) {
  return Array.from(left).filter((token) => right.has(token)).length;
}

function qualificationDomainTokens(value: string) {
  return new Set(
    Array.from(tokenize(value)).filter(
      (token) =>
        !QUALIFICATION_AWARD_TERMS.has(token) &&
        !TRANSFERABLE_PROFILE_TERMS.has(token),
    ),
  );
}

function awardRank(value: string) {
  const normalized = normalizeKey(value);

  if (/\b(phd|doctor of philosophy|doctorate)\b/.test(normalized)) return 10;
  if (/\b(master|masters|mba|juris doctor)\b/.test(normalized)) return 9;
  if (/\bgraduate (certificate|diploma)\b/.test(normalized)) return 8;
  if (/\b(bachelor|bachelors|llb)\b/.test(normalized)) return 7;
  if (/\badvanced diploma\b/.test(normalized)) return 6;
  if (/\bdiploma\b/.test(normalized)) return 5;
  if (/\bcertificate iv\b/.test(normalized)) return 4;
  return null;
}

function parseYear(value: string) {
  const year = Number.parseInt(value, 10);
  return Number.isFinite(year) && year >= 1900 && year <= 2200 ? year : null;
}

function toMonthNumber(yearValue: string, monthValue: string, fallbackMonth: number) {
  const year = parseYear(yearValue);

  if (year === null) {
    return null;
  }

  const month = MONTH_INDEX.get(monthValue.trim().toLowerCase()) ?? fallbackMonth;
  return year * 12 + month;
}

function roleInterval(role: EmploymentExperience, now: Date) {
  const start = toMonthNumber(role.startYear, role.startMonth, 11);
  const end = role.currentRole
    ? now.getFullYear() * 12 + now.getMonth() + 1
    : toMonthNumber(role.endYear, role.endMonth, 0);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return { start, end };
}

function unionMonths(roles: EmploymentExperience[], now: Date) {
  const intervals = roles
    .map((role) => roleInterval(role, now))
    .filter((interval): interval is { end: number; start: number } => Boolean(interval))
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return 0;
  }

  let total = 0;
  let current = { ...intervals[0] };

  intervals.slice(1).forEach((interval) => {
    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      return;
    }

    total += current.end - current.start;
    current = { ...interval };
  });

  return total + current.end - current.start;
}

export function summarizeUcExperienceByOscaLevel(
  experiences: CvRecognitionExperience[],
  now = new Date(),
): UcOscaExperienceSummary[] {
  const groups = new Map<OscaSkillLevel | null, CvRecognitionExperience[]>();

  experiences.forEach((experience) => {
    const skillLevel = experience.oscaSkillLevel;
    groups.set(skillLevel, [...(groups.get(skillLevel) ?? []), experience]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => (left ?? 6) - (right ?? 6))
    .map(([skillLevel, roles]) => {
      const includedRoles = roles.filter((role) => role.includeInAssessment);
      const experienceMonths = unionMonths(includedRoles, now);

      return {
        experienceMonths,
        experienceYears: Math.round((experienceMonths / 12) * 10) / 10,
        includedRoleCount: includedRoles.length,
        key: skillLevel ? `level-${skillLevel}` : "needs-review",
        roles,
        skillLevel,
      };
    });
}

export function getUcCourseMatchExperienceSummary(
  summaries: UcOscaExperienceSummary[],
  skillLevel: OscaSkillLevel | null,
) {
  return (
    summaries.find(
      (summary) =>
        summary.skillLevel === skillLevel && summary.includedRoleCount > 0,
    ) ??
    summaries.find((summary) => summary.includedRoleCount > 0) ??
    null
  );
}

export function formatUcExperienceDuration(months: number) {
  if (months <= 0) {
    return "Duration needs review";
  }

  if (months < 12) {
    return `${months} ${months === 1 ? "month" : "months"} experience`;
  }

  const years = Math.round((months / 12) * 10) / 10;
  return `${years} ${years === 1 ? "year" : "years"} experience`;
}

export function getUcExperienceGroupLabel(skillLevel: OscaSkillLevel | null) {
  switch (skillLevel) {
    case 1:
      return "Senior or highly specialised roles";
    case 2:
      return "Technical or supervisory roles";
    case 3:
      return "Skilled roles";
    case 4:
      return "Operational roles";
    case 5:
      return "Entry-level roles";
    default:
      return "Roles needing more information";
  }
}

export function getUcWorkEntryGuidance(
  skillLevel: OscaSkillLevel | null,
  experienceMonths: number,
) {
  if (skillLevel === 1 || skillLevel === 2) {
    return getOscaPathwayStatus(skillLevel, experienceMonths) === "may_meet"
      ? "May be eligible for direct entry"
      : "More experience may be needed";
  }

  if (skillLevel === null) {
    return "More details needed";
  }

  return "UC will review this experience";
}

function getOscaPathwayStatus(
  skillLevel: 1 | 2,
  experienceMonths: number,
) {
  return assessUcOscaSkilledWorkPathway({
    [skillLevel]: experienceMonths,
  }).status;
}

function formatUcExperienceAmount(months: number) {
  return formatUcExperienceDuration(months).replace(/ experience$/, "");
}

function includedRoleDescription(
  summary: UcOscaExperienceSummary,
  description: string,
) {
  const roleLabel = summary.includedRoleCount === 1 ? "role" : "roles";

  if (summary.experienceMonths <= 0) {
    const verb = summary.includedRoleCount === 1 ? "has" : "have";
    return `${summary.includedRoleCount} ${description} ${roleLabel} ${verb} dates that need review`;
  }

  const verb = summary.includedRoleCount === 1 ? "adds" : "add";

  return `${summary.includedRoleCount} ${description} ${roleLabel} ${verb} up to ${formatUcExperienceAmount(summary.experienceMonths)} of experience`;
}

export function getUcExperienceReviewSummary(
  summaries: UcOscaExperienceSummary[],
): UcExperienceReviewSummary {
  const includedSummaries = summaries.filter(
    (summary) => summary.includedRoleCount > 0,
  );

  if (includedSummaries.length === 0) {
    return {
      headline: "Choose the roles to include",
      points: [
        "Select at least one role to see guidance based on your experience.",
      ],
    };
  }

  const senior = includedSummaries.find((summary) => summary.skillLevel === 1);
  const technical = includedSummaries.find((summary) => summary.skillLevel === 2);
  const otherRoleCount = includedSummaries
    .filter((summary) => summary.skillLevel !== null && summary.skillLevel >= 3)
    .reduce((total, summary) => total + summary.includedRoleCount, 0);
  const needsReview = includedSummaries.find(
    (summary) => summary.skillLevel === null,
  );
  const points: string[] = [];

  if (senior) {
    points.push(
      "Your senior or highly specialised experience may support UC’s work-experience pathway.",
    );
  }

  if (technical) {
    const experienceAmount = formatUcExperienceAmount(
      technical.experienceMonths,
    );
    points.push(
      getOscaPathwayStatus(2, technical.experienceMonths) === "may_meet"
        ? `${experienceAmount} in technical or supervisory roles meets UC’s two-year experience guide.`
        : `${experienceAmount} in technical or supervisory roles is below UC’s two-year experience guide.`,
    );
  }

  if (otherRoleCount > 0) {
    points.push(
      `${otherRoleCount} other ${otherRoleCount === 1 ? "role" : "roles"} will be considered by UC Admissions alongside the course requirements.`,
    );
  }

  if (needsReview) {
    points.push(
      `${needsReview.includedRoleCount} ${needsReview.includedRoleCount === 1 ? "role needs" : "roles need"} more detail before ${needsReview.includedRoleCount === 1 ? "it can" : "they can"} be included in this guidance.`,
    );
  }

  const supportsDirectEntry = Boolean(
    (senior &&
      getOscaPathwayStatus(1, senior.experienceMonths) === "may_meet") ||
      (technical &&
        getOscaPathwayStatus(2, technical.experienceMonths) === "may_meet"),
  );

  return {
    headline: supportsDirectEntry
      ? "Your experience may support direct entry"
      : technical
        ? "More experience may be needed for direct entry"
        : needsReview && otherRoleCount === 0
          ? "Review needed before we can show guidance"
          : "UC will review your experience",
    points,
  };
}

export function getUcExperienceReviewGuidance(
  summaries: UcOscaExperienceSummary[],
) {
  const includedSummaries = summaries.filter(
    (summary) => summary.includedRoleCount > 0,
  );

  if (includedSummaries.length === 0) {
    return "Select at least one role to see guidance based on your experience. UC Admissions will review your responsibilities and confirm eligibility.";
  }

  const sentences: string[] = [];
  const senior = includedSummaries.find((summary) => summary.skillLevel === 1);
  const technical = includedSummaries.find((summary) => summary.skillLevel === 2);
  const otherRoleCount = includedSummaries
    .filter((summary) => summary.skillLevel !== null && summary.skillLevel >= 3)
    .reduce((total, summary) => total + summary.includedRoleCount, 0);
  const needsReview = includedSummaries.find(
    (summary) => summary.skillLevel === null,
  );

  if (senior) {
    sentences.push(
      "Given your experience in senior and highly specialised roles, you may be eligible for direct entry.",
    );
  }

  if (technical) {
    const prefix = sentences.length === 0 ? "Based on your CV, your" : "Your";
    const thresholdCopy =
      getOscaPathwayStatus(2, technical.experienceMonths) === "may_meet"
        ? "This meets UC’s two-year experience guide."
        : "UC’s guide usually requires at least two years in these roles.";
    sentences.push(
      `${prefix} ${includedRoleDescription(technical, "technical or supervisory")}. ${thresholdCopy}`,
    );
  }

  if (otherRoleCount > 0) {
    const roleLabel = otherRoleCount === 1 ? "role" : "roles";
    const prefix = sentences.length === 0 ? "Based on your CV, you have" : "You also have";
    sentences.push(
      `${prefix} ${otherRoleCount} other ${roleLabel} for UC Admissions to consider against the work-experience entry requirements.`,
    );
  }

  if (needsReview) {
    const roleLabel = needsReview.includedRoleCount === 1 ? "role" : "roles";
    const pronoun = needsReview.includedRoleCount === 1 ? "it" : "they";
    const prefix = sentences.length === 0 ? "We need" : "We also need";
    sentences.push(
      `${prefix} more detail about ${needsReview.includedRoleCount} ${roleLabel} before ${pronoun} can be included in this guidance.`,
    );
  }

  sentences.push(
    "UC Admissions will review your responsibilities and confirm eligibility.",
  );
  return sentences.join(" ");
}

export function assessUcAdmission(
  experiences: CvRecognitionExperience[],
  now = new Date(),
): UcAdmissionAssessment {
  const included = experiences.filter(
    (experience) => experience.includeInAssessment && experience.oscaSkillLevel,
  );
  const groups = new Map<string, CvRecognitionExperience[]>();

  included.forEach((experience) => {
    const occupationKey =
      normalizeKey(experience.oscaOccupationCode) ||
      normalizeKey(experience.oscaOccupationTitle) ||
      `role-${experience.id}`;
    groups.set(occupationKey, [...(groups.get(occupationKey) ?? []), experience]);
  });

  const candidates = Array.from(groups.values()).map((roles) => {
    const months = unionMonths(roles, now);
    const skillLevel = roles[0]?.oscaSkillLevel ?? null;
    return {
      mayMeet:
        (skillLevel === 1 || skillLevel === 2) &&
        getOscaPathwayStatus(skillLevel, months) === "may_meet",
      months,
      roles,
      skillLevel,
    };
  });

  candidates.sort((a, b) => {
    if (a.mayMeet !== b.mayMeet) return a.mayMeet ? -1 : 1;
    const skillDifference = (a.skillLevel ?? 9) - (b.skillLevel ?? 9);
    return skillDifference !== 0 ? skillDifference : b.months - a.months;
  });

  const primary = candidates[0];
  const experienceMonths = primary?.months ?? 0;
  const experienceYears = Math.round((experienceMonths / 12) * 10) / 10;
  const representative = primary?.roles[0];
  const skillLevel = primary?.skillLevel ?? null;

  if (primary?.mayMeet && skillLevel !== null) {
    return {
      experienceMonths,
      experienceYears,
      occupationCode: representative?.oscaOccupationCode ?? "",
      occupationTitle:
        representative?.oscaOccupationTitle || representative?.position || "Confirmed occupation",
      rationale:
        skillLevel === 1
          ? "This role is classified at OSCA Skill Level 1, which may support UC’s skilled-work entry pathway for an approved course."
          : `This role is classified at OSCA Skill Level 2 and includes ${experienceYears} years of experience, meeting UC’s published two-year guide for an approved course.`,
      skillLevel,
      status: "may_meet",
    };
  }

  return {
    experienceMonths,
    experienceYears,
    occupationCode: representative?.oscaOccupationCode ?? "",
    occupationTitle:
      representative?.oscaOccupationTitle || representative?.position || "Experience supplied",
    rationale:
      skillLevel === 1
        ? "The Skill Level 1 role needs valid dates before it can support UC’s skilled-work entry pathway."
        : skillLevel === 2
          ? "UC’s published skilled-work guide requires at least two years in an OSCA Skill Level 2 occupation."
          : "This CV does not yet demonstrate UC’s published OSCA Skill Level 1 or Skill Level 2 work-entry guide.",
    skillLevel,
    status: "needs_review",
  };
}

function experienceTokens(experiences: CvRecognitionExperience[]) {
  return tokenize(
    experiences
      .map((experience) =>
        [
          experience.position,
          experience.duties,
          experience.oscaOccupationTitle,
        ].join(" "),
      )
      .join(" "),
  );
}

function directExperienceTokens(experiences: CvRecognitionExperience[]) {
  return directTokens(
    experiences
      .map((experience) =>
        [
          experience.position,
          experience.duties,
          experience.oscaOccupationTitle,
        ].join(" "),
      )
      .join(" "),
  );
}

function mostRecentExperiences(experiences: CvRecognitionExperience[]) {
  const current = experiences.filter((experience) => experience.currentRole);

  if (current.length > 0) {
    return current;
  }

  const dated = experiences.map((experience) => ({
    experience,
    recency:
      toMonthNumber(experience.endYear, experience.endMonth, 11) ??
      toMonthNumber(experience.startYear, experience.startMonth, 11) ??
      Number.NEGATIVE_INFINITY,
  }));
  const mostRecent = Math.max(...dated.map(({ recency }) => recency));

  return dated
    .filter(({ recency }) => recency === mostRecent)
    .map(({ experience }) => experience);
}

function completedQualificationTokens(
  qualifications: TertiaryQualification[],
) {
  return tokenize(
    qualifications
      .filter((qualification) => qualification.completed)
      .map((qualification) => `${qualification.level} ${qualification.courseName}`)
      .join(" "),
  );
}

function courseRepeatsCompletedQualification(
  course: CourseCatalogEntry,
  qualifications: TertiaryQualification[],
) {
  const courseRank = awardRank(course.title);

  if (courseRank === null) {
    return false;
  }

  const courseDomains = qualificationDomainTokens(
    `${course.title} ${course.subjectArea ?? ""}`,
  );

  return qualifications.some((qualification) => {
    if (!qualification.completed) return false;

    const qualificationRank = awardRank(
      `${qualification.level} ${qualification.courseName}`,
    );
    if (qualificationRank === null || qualificationRank < courseRank) {
      return false;
    }

    const qualificationDomains = qualificationDomainTokens(
      qualification.courseName,
    );
    const overlap = overlapCount(courseDomains, qualificationDomains);

    return (
      overlap > 0 &&
      (courseDomains.size <= 2 || overlap >= 2 || overlap / courseDomains.size >= 0.5)
    );
  });
}

function buildCourseMatchProfile(draft: CvRecognitionDraft) {
  const includedExperiences = draft.experiences.filter(
    (experience) => experience.includeInAssessment,
  );
  const roleTokens = experienceTokens(includedExperiences);
  const evidenceTokens = directExperienceTokens(includedExperiences);
  const directionTokens = experienceTokens(
    mostRecentExperiences(includedExperiences),
  );
  const qualificationTokens = completedQualificationTokens(
    draft.tertiaryQualifications,
  );
  const profileTokens = new Set([...roleTokens, ...qualificationTokens]);
  const highestQualificationRank = Math.max(
    0,
    ...draft.tertiaryQualifications
      .filter((qualification) => qualification.completed)
      .map((qualification) =>
        awardRank(`${qualification.level} ${qualification.courseName}`) ?? 0,
      ),
  );

  return {
    directionTokens,
    evidenceTokens,
    highestQualificationRank,
    profileTokens,
    qualificationTokens,
    roleTokens,
    tertiaryQualifications: draft.tertiaryQualifications,
  };
}

function courseRelevance(
  course: CourseCatalogEntry,
  profile: ReturnType<typeof buildCourseMatchProfile>,
) {
  const courseTokens = tokenize(
    [
      course.title,
      course.subjectArea ?? "",
      course.summary ?? "",
      course.outcomes ?? "",
      course.coreSubjects.join(" "),
    ].join(" "),
  );
  const {
    directionTokens,
    evidenceTokens,
    highestQualificationRank,
    profileTokens,
    qualificationTokens,
    roleTokens,
    tertiaryQualifications,
  } = profile;

  if (courseTokens.size === 0 || profileTokens.size === 0) {
    return { relevanceScore: 0, repeatsCompletedQualification: false };
  }

  const domainPenalty = SPECIALIST_DOMAIN_GUARDS.reduce((penalty, guard) => {
    const courseIsSpecialist = guard.some((term) => courseTokens.has(term));
    const profileShowsDomain = guard.some((term) => profileTokens.has(term));
    return penalty + (courseIsSpecialist && !profileShowsDomain ? 18 : 0);
  }, 0);
  const repeatsCompletedQualification = courseRepeatsCompletedQualification(
    course,
    tertiaryQualifications,
  );
  const lacksSpecialistEvidence = SPECIALIST_COURSE_EVIDENCE.some(
    (guard) =>
      guard.matches(course) &&
      !guard.terms.some((term) => evidenceTokens.has(term)),
  );
  const lacksPolicyOrGovernmentEvidence =
    /\b(public policy|policy evaluation|gender policy|lgbtqia\+? policy)\b/i.test(
      course.title,
    ) &&
    !POLICY_OR_GOVERNMENT_EVIDENCE_TERMS.some((term) =>
      evidenceTokens.has(term),
    );
  const courseRank = awardRank(course.title) ?? 0;
  const progressionBonus =
    highestQualificationRank > 0 && courseRank >= highestQualificationRank
      ? 4
      : 0;
  const score =
    overlapCount(courseTokens, directionTokens) * 12 +
    overlapCount(courseTokens, roleTokens) * 3 +
    overlapCount(courseTokens, qualificationTokens) * 2 +
    progressionBonus -
    domainPenalty;

  return {
    relevanceScore:
      repeatsCompletedQualification ||
      lacksSpecialistEvidence ||
      lacksPolicyOrGovernmentEvidence
        ? 0
        : Math.max(0, Math.min(100, score)),
    repeatsCompletedQualification,
  };
}

function publishedExperienceOnlyMinimumYears(course: CourseCatalogEntry) {
  const pathway = course.entryRequirementItems.find((item) =>
    /^Experience pathway\s+[—-]\s+at least\s+/i.test(item),
  );

  if (!pathway) {
    return null;
  }

  const match = pathway.match(
    /\bat least\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/i,
  );
  const value = match?.[1]?.toLowerCase();

  if (!value) {
    return null;
  }

  const numericValue = Number.parseInt(value, 10);
  return Number.isFinite(numericValue)
    ? numericValue
    : EXPERIENCE_YEAR_WORDS[value] ?? null;
}

function classifyPriorStudy(
  draft: CvRecognitionDraft,
): UcPriorStudyCategory {
  const completedRanks = draft.tertiaryQualifications
    .filter((qualification) => qualification.completed)
    .flatMap((qualification) => {
      const rank = awardRank(
        `${qualification.level} ${qualification.courseName}`,
      );
      return rank === null ? [] : [rank];
    });
  const highestCompletedRank = Math.max(0, ...completedRanks);

  if (highestCompletedRank >= 7) {
    return "completed_bachelor_or_higher";
  }
  if (highestCompletedRank >= 5) {
    return "diploma_or_associate";
  }
  if (highestCompletedRank === 4) {
    return "certificate_iv_or_year_12";
  }

  const hasPartialBachelor = draft.tertiaryQualifications.some(
    (qualification) =>
      !qualification.completed &&
      (awardRank(`${qualification.level} ${qualification.courseName}`) ?? 0) >=
        7,
  );
  if (hasPartialBachelor) {
    return "partial_bachelor";
  }

  const secondaryEvidence = normalizeKey(
    draft.secondaryQualifications
      .map(
        (qualification) =>
          `${qualification.type} ${qualification.qualification}`,
      )
      .join(" "),
  );
  if (
    /\b(year 12|secondary school|senior secondary|certificate of education|atar)\b/.test(
      secondaryEvidence,
    )
  ) {
    return "certificate_iv_or_year_12";
  }

  // A CV that omits study is not evidence that the applicant has no prior
  // qualification. The explicit "no prior qualification" form answer must be
  // collected before the ten/seven-year matrix can be applied.
  return "unknown";
}

function courseProfileTokens(course: CourseCatalogEntry) {
  return tokenize(
    [
      course.title,
      course.subjectArea ?? "",
      course.summary ?? "",
      course.outcomes ?? "",
      course.coreSubjects.join(" "),
    ].join(" "),
  );
}

function roleProfileTokens(role: CvRecognitionExperience) {
  return tokenize(
    [role.position, role.duties, role.oscaOccupationTitle].join(" "),
  );
}

function hasCourseSpecificRoleEvidence(
  course: CourseCatalogEntry,
  role: CvRecognitionExperience,
) {
  const roleTokens = roleProfileTokens(role);
  const courseTokens = courseProfileTokens(course);
  const policyOrGovernmentCourse =
    /\b(government|public policy|policy evaluation|gender policy|lgbtqia\+? policy)\b/i.test(
      course.title,
    );

  if (policyOrGovernmentCourse) {
    const directRoleTokens = directTokens(
      [role.position, role.duties, role.oscaOccupationTitle].join(" "),
    );
    if (
      !POLICY_OR_GOVERNMENT_EVIDENCE_TERMS.some((term) =>
        directRoleTokens.has(term),
      )
    ) {
      return false;
    }
  }

  return overlapCount(courseTokens, roleTokens) > 0;
}

function relevantExperienceMonthsForCourse(
  course: CourseCatalogEntry,
  experiences: CvRecognitionExperience[],
  now: Date,
) {
  return unionMonths(
    experiences.filter((role) => hasCourseSpecificRoleEvidence(course, role)),
    now,
  );
}

function oscaSkillLevelMonths(
  experiences: CvRecognitionExperience[],
  now: Date,
) {
  return {
    1: unionMonths(
      experiences.filter((experience) => experience.oscaSkillLevel === 1),
      now,
    ),
    2: unionMonths(
      experiences.filter((experience) => experience.oscaSkillLevel === 2),
      now,
    ),
  };
}

function entryDetail(
  pathway: UcWorkEntryPathwayAssessment,
  status: UcWorkEntryStatus,
  skillMonths: ReturnType<typeof oscaSkillLevelMonths>,
) {
  if (status === "needs_review" && pathway.status === "may_meet") {
    return "Your work may support an entry pathway, but this course has additional requirements that UC Admissions must review.";
  }

  if (pathway.status !== "may_meet") {
    return "Your CV does not yet demonstrate a published work-experience entry pathway for this course. UC can review additional study or work evidence.";
  }

  if (pathway.pathway === "course_specific") {
    const requiredYears = (pathway.requiredMonths ?? 0) / 12;
    return `Your CV appears to show at least ${requiredYears} years of experience related to this course’s published entry pathway. UC Admissions will confirm relevance and eligibility.`;
  }

  if (pathway.pathway === "skilled_work") {
    return skillMonths[1] > 0
      ? "Your OSCA Skill Level 1 experience may support UC’s published work-based entry pathway for this course. UC Admissions will confirm eligibility."
      : "Your OSCA Skill Level 2 experience meets UC’s published two-year work guide for this course. UC Admissions will confirm eligibility.";
  }

  const requiredYears = (pathway.requiredMonths ?? 0) / 12;
  const relevance =
    pathway.pathway === "career_history_relevant" ? "relevant" : "general";
  return `Your CV appears to meet UC’s ${requiredYears}-year ${relevance} experience guide for this course. UC Admissions will confirm eligibility.`;
}

export function rankUcCourses(
  courses: CourseCatalogEntry[],
  draft: CvRecognitionDraft,
  _admission: UcAdmissionAssessment,
  now = new Date(),
): UcCourseMatch[] {
  const profile = buildCourseMatchProfile(draft);
  const includedExperiences = draft.experiences.filter(
    (experience) => experience.includeInAssessment,
  );
  const generalExperienceMonths = unionMonths(includedExperiences, now);
  const skillMonths = oscaSkillLevelMonths(includedExperiences, now);
  const priorStudyCategory = classifyPriorStudy(draft);
  const ranked = courses
    .map((course) => {
      const relevance = courseRelevance(course, profile);
      const workEntry = assessUcWorkExperienceEntry({
        courseSpecificRelevantYears:
          publishedExperienceOnlyMinimumYears(course),
        generalExperienceMonths,
        officialCourseCode: course.officialCourseCode,
        oscaSkillLevelMonths: skillMonths,
        priorStudyCategory,
        relevantExperienceMonths: relevantExperienceMonthsForCourse(
          course,
          includedExperiences,
          now,
        ),
      });

      return { course, ...relevance, workEntry };
    })
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore || a.course.title.localeCompare(b.course.title),
    );

  let bestMatchCount = 0;

  return ranked.map(({ course, relevanceScore, workEntry }) => {
    const isBestMatch = Boolean(
      workEntry.overallStatus === "may_meet" &&
        relevanceScore > 0 &&
        bestMatchCount < BEST_MATCH_LIMIT,
    );
    if (isBestMatch) {
      bestMatchCount += 1;
    }
    const category = isBestMatch
      ? "best_match"
      : workEntry.overallStatus !== "not_demonstrated" || relevanceScore > 0
        ? "needs_review"
        : "other";

    return {
      admissionDetail: entryDetail(
        workEntry.selectedPathway,
        workEntry.overallStatus,
        skillMonths,
      ),
      category,
      creditConfidence:
        relevanceScore >= 17 ? "high" : relevanceScore > 0 ? "medium" : "low",
      course,
      creditDetail:
        "Credit is assessed separately from admission. UC will need supporting study and work evidence before confirming any credit.",
      entryConfidence:
        workEntry.overallStatus === "may_meet"
          ? "high"
          : workEntry.overallStatus === "needs_review"
            ? "medium"
            : "low",
      entryPathway: workEntry.selectedPathway.pathway,
      entryStatus: workEntry.overallStatus,
      relevanceScore,
    };
  });
}

function fillBlank<T extends object>(current: T, suggestions: Partial<T>): T {
  const next = { ...current };

  (Object.keys(suggestions) as Array<keyof T>).forEach((key) => {
    const value = suggestions[key];
    const currentValue = next[key];
    if ((currentValue === "" || currentValue === null || currentValue === undefined) && value) {
      next[key] = value as T[keyof T];
    }
  });

  return next;
}

export function applyUcCvPrefill(
  application: ApplicationData,
  draft: CvRecognitionDraft,
  authenticatedEmail: string | null,
): ApplicationData {
  const title = ["Mr", "Mrs", "Ms", "Dr", "Prof"].includes(draft.profile.title)
    ? draft.profile.title
    : "";
  const personalDetails = fillBlank(application.personalDetails, {
    email: authenticatedEmail ?? "",
    firstName: draft.profile.firstName,
    lastName: draft.profile.lastName,
    middleName: draft.profile.middleName,
    phone: draft.profile.phone,
    title,
  });

  return {
    ...application,
    personalDetails,
    employmentExperiences:
      application.employmentExperiences.length > 0
        ? application.employmentExperiences
        : draft.experiences
            .filter((experience) => experience.includeInAssessment)
            .map((experience) => ({
              id: experience.id,
              company: experience.company,
              currentRole: experience.currentRole,
              duties: experience.duties,
              endMonth: experience.endMonth,
              endYear: experience.endYear,
              position: experience.position,
              startMonth: experience.startMonth,
              startYear: experience.startYear,
              type: experience.type,
            })),
    professionalAccreditations:
      application.professionalAccreditations.length > 0
        ? application.professionalAccreditations
        : draft.professionalAccreditations,
    secondaryQualifications:
      application.secondaryQualifications.length > 0
        ? application.secondaryQualifications
        : draft.secondaryQualifications,
    tertiaryQualifications:
      application.tertiaryQualifications.length > 0
        ? application.tertiaryQualifications
        : draft.tertiaryQualifications,
    workExperienceAssessments:
      application.employmentExperiences.length > 0
        ? application.workExperienceAssessments
        : {},
  };
}
