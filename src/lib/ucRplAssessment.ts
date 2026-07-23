import type {
  ApplicationData,
  EmploymentExperience,
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "./applicationData";
import type { CourseCatalogEntry } from "./courseCatalog";

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
  equivalentGpa: 4 | 5 | null;
  experienceMonths: number;
  experienceYears: number;
  occupationCode: string;
  occupationTitle: string;
  rationale: string;
  skillLevel: OscaSkillLevel | null;
  status: "may_meet" | "faculty_review";
}

export interface UcCourseMatch {
  admissionDetail: string;
  category: "best_match" | "needs_review" | "other";
  creditConfidence: UcGuidanceConfidence;
  course: CourseCatalogEntry;
  creditDetail: string;
  creditPoints: 6 | 12 | 18;
  entryConfidence: UcGuidanceConfidence;
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
  chancellor: ["leadership", "management", "strategy"],
  cyber: ["security", "technology", "information", "digital"],
  education: ["teaching", "learning"],
  educational: ["education", "teaching", "learning"],
  engineer: ["technology", "systems", "project", "management"],
  executive: ["leadership", "management", "strategy"],
  health: ["public", "clinical", "care", "leadership"],
  laws: ["law", "legal"],
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

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string) {
  const tokens = normalizeKey(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
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
  if (skillLevel === 1) {
    return "May be eligible for direct entry";
  }

  if (skillLevel === 2) {
    return experienceMonths >= 24
      ? "May be eligible for direct entry"
      : "More experience may be needed";
  }

  if (skillLevel === null) {
    return "More details needed";
  }

  return "UC will review this experience";
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
      technical.experienceMonths >= 24
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

function admissionBand(skillLevel: OscaSkillLevel | null, months: number) {
  if (skillLevel === 1) {
    if (months >= 36) return 5 as const;
    if (months >= 12) return 4 as const;
  }

  if (skillLevel === 2) {
    if (months >= 60) return 5 as const;
    if (months >= 24) return 4 as const;
  }

  return null;
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
      equivalentGpa: admissionBand(skillLevel, months),
      months,
      roles,
      skillLevel,
    };
  });

  candidates.sort((a, b) => {
    const gpaDifference = (b.equivalentGpa ?? 0) - (a.equivalentGpa ?? 0);
    if (gpaDifference !== 0) return gpaDifference;
    if (b.months !== a.months) return b.months - a.months;
    return (a.skillLevel ?? 9) - (b.skillLevel ?? 9);
  });

  const primary = candidates[0];
  const experienceMonths = primary?.months ?? 0;
  const experienceYears = Math.round((experienceMonths / 12) * 10) / 10;
  const representative = primary?.roles[0];
  const equivalentGpa = primary?.equivalentGpa ?? null;
  const skillLevel = primary?.skillLevel ?? null;

  if (equivalentGpa !== null && skillLevel !== null) {
    return {
      equivalentGpa,
      experienceMonths,
      experienceYears,
      occupationCode: representative?.oscaOccupationCode ?? "",
      occupationTitle:
        representative?.oscaOccupationTitle || representative?.position || "Confirmed occupation",
      rationale: `OSCA Skill Level ${skillLevel} with ${experienceYears} years of relevant experience maps to a UC equivalent GPA of ${equivalentGpa.toFixed(1)} under the prototype admission matrix.`,
      skillLevel,
      status: "may_meet",
    };
  }

  return {
    equivalentGpa: null,
    experienceMonths,
    experienceYears,
    occupationCode: representative?.oscaOccupationCode ?? "",
    occupationTitle:
      representative?.oscaOccupationTitle || representative?.position || "Experience supplied",
    rationale:
      skillLevel === 1
        ? "Skill Level 1 requires at least one year of relevant experience for the prototype admission matrix."
        : skillLevel === 2
          ? "Skill Level 2 requires at least two years of relevant experience for the prototype admission matrix."
          : "This experience needs faculty review because the prototype matrix only provides automatic bands for OSCA Skill Levels 1 and 2.",
    skillLevel,
    status: "faculty_review",
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
    relevanceScore: repeatsCompletedQualification
      ? 0
      : Math.max(0, Math.min(100, score)),
    repeatsCompletedQualification,
  };
}

function getCourseDurationYears(duration: string | undefined) {
  if (!duration) return null;

  const monthMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (monthMatch?.[1]) {
    return Number(monthMatch[1]) / 12;
  }

  const yearMatch = duration.match(/(\d+(?:\.\d+)?)\s*years?/i);
  return yearMatch?.[1] ? Number(yearMatch[1]) : null;
}

export function getUcIndicativeCreditPoints(
  course: CourseCatalogEntry,
): 6 | 12 | 18 {
  const durationYears = getCourseDurationYears(course.duration);

  if (durationYears !== null) {
    if (durationYears <= 0.75) return 6;
    if (durationYears < 2) return 12;
    return 18;
  }

  if (/graduate certificate/i.test(course.title)) return 6;
  if (/graduate diploma/i.test(course.title)) return 12;
  return 18;
}

export function rankUcCourses(
  courses: CourseCatalogEntry[],
  draft: CvRecognitionDraft,
  admission: UcAdmissionAssessment,
): UcCourseMatch[] {
  const profile = buildCourseMatchProfile(draft);
  const ranked = courses
    .map((course) => ({ course, ...courseRelevance(course, profile) }))
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore || a.course.title.localeCompare(b.course.title),
    );

  return ranked.map(({ course, relevanceScore }, index) => {
    const hasAdmissionBand = admission.equivalentGpa !== null;
    const maySupportDirectEntry =
      admission.skillLevel === 1 ||
      (admission.skillLevel === 2 && admission.experienceMonths >= 24);
    const category =
      hasAdmissionBand && index < 6
        ? "best_match"
        : hasAdmissionBand || relevanceScore > 0
          ? "needs_review"
          : "other";
    const creditPoints = getUcIndicativeCreditPoints(course);
    const creditDetail =
      relevanceScore >= 17
        ? `Your work appears related to this course. You may be eligible for up to ${creditPoints} credit points.`
        : "UC will need supporting evidence before deciding whether your experience can count towards this course.";

    return {
      admissionDetail: maySupportDirectEntry
        ? "Your work experience may support direct entry to this course. Additional course specific eligibility requirement may still apply."
        : "UC Admissions will review your work experience against this course’s entry requirements.",
      category,
      creditConfidence:
        relevanceScore >= 17 ? "high" : relevanceScore > 0 ? "medium" : "low",
      course,
      creditDetail,
      creditPoints,
      entryConfidence:
        category === "best_match"
          ? "high"
          : category === "needs_review"
            ? "medium"
            : "low",
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
