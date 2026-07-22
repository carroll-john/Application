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
  course: CourseCatalogEntry;
  creditDetail: string;
  rationale: string;
  relevanceScore: number;
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
  cyber: ["security", "technology", "information", "digital"],
  education: ["teaching", "learning", "leadership"],
  engineer: ["technology", "systems", "project", "management"],
  health: ["public", "clinical", "care", "leadership"],
  manager: ["management", "leadership", "business", "strategy"],
  marketing: ["communication", "business", "digital", "strategy"],
  project: ["management", "leadership", "business", "delivery"],
  public: ["government", "policy", "administration", "leadership"],
  technology: ["information", "digital", "data", "systems"],
};

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

function courseRelevance(course: CourseCatalogEntry, experiences: CvRecognitionExperience[]) {
  const courseTokens = tokenize(
    [
      course.title,
      course.subjectArea ?? "",
      course.summary ?? "",
      course.outcomes ?? "",
      course.coreSubjects.join(" "),
    ].join(" "),
  );
  const roleTokens = tokenize(
    experiences
      .filter((experience) => experience.includeInAssessment)
      .map((experience) =>
        [
          experience.position,
          experience.duties,
          experience.oscaOccupationTitle,
        ].join(" "),
      )
      .join(" "),
  );

  if (courseTokens.size === 0 || roleTokens.size === 0) {
    return 0;
  }

  const overlap = Array.from(roleTokens).filter((token) => courseTokens.has(token)).length;
  const domainPenalty = SPECIALIST_DOMAIN_GUARDS.reduce((penalty, guard) => {
    const courseIsSpecialist = guard.some((term) => courseTokens.has(term));
    const roleShowsDomain = guard.some((term) => roleTokens.has(term));
    return penalty + (courseIsSpecialist && !roleShowsDomain ? 3 : 0);
  }, 0);
  const adjustedOverlap = Math.max(0, overlap - domainPenalty);

  return Math.round(
    (adjustedOverlap / Math.max(4, Math.min(roleTokens.size, 18))) * 100,
  );
}

export function rankUcCourses(
  courses: CourseCatalogEntry[],
  experiences: CvRecognitionExperience[],
  admission: UcAdmissionAssessment,
): UcCourseMatch[] {
  const ranked = courses
    .map((course) => ({ course, relevanceScore: courseRelevance(course, experiences) }))
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore || a.course.title.localeCompare(b.course.title),
    );

  return ranked.map(({ course, relevanceScore }, index) => {
    const hasAdmissionBand = admission.equivalentGpa !== null;
    const category =
      hasAdmissionBand && index < 6
        ? "best_match"
        : hasAdmissionBand || relevanceScore > 0
          ? "needs_review"
          : "other";
    const creditDetail =
      relevanceScore >= 17
        ? "Related experience identified; an individual RPL assessment may be available."
        : "Supporting evidence and an individual faculty assessment are required.";

    return {
      admissionDetail: hasAdmissionBand
        ? `Your experience may meet UC's general admission standard at an equivalent GPA of ${admission.equivalentGpa!.toFixed(1)}.`
        : "Your experience needs faculty review against the general admission standard.",
      category,
      course,
      creditDetail,
      rationale: hasAdmissionBand
        ? `Based on OSCA Skill Level ${admission.skillLevel} and ${admission.experienceYears} years of relevant experience. Course-specific prerequisites and professional requirements still apply.`
        : `${admission.rationale} Course-specific prerequisites and professional requirements still apply.`,
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
