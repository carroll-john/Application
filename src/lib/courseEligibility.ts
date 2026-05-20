export type CourseEducationLevel =
  | "High school"
  | "Diploma"
  | "Bachelor degree"
  | "Masters degree"
  | "Doctorate";

export type CourseExperienceLevel =
  | "Less than 2 years"
  | "2-5 years"
  | "5+ years";

export interface EligibilityAnswers {
  educationLevel?: string;
  experienceRange?: string;
  goal?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export type EligibilityRule =
  | {
      type: "min_education";
      minEducation: CourseEducationLevel;
    }
  | {
      type: "min_education_or_experience";
      minEducation: CourseEducationLevel;
      minExperienceYears: number;
    };

export interface CourseEligibilityConfig {
  goalsOptions: string[];
  educationOptions: CourseEducationLevel[];
  experienceOptions: CourseExperienceLevel[];
  rules: EligibilityRule[];
  successCopy?: string;
  ineligibleCopy?: string;
}

const educationRank: Record<CourseEducationLevel, number> = {
  "High school": 1,
  Diploma: 2,
  "Bachelor degree": 3,
  "Masters degree": 4,
  Doctorate: 5,
};

const experienceRank: Record<CourseExperienceLevel, number> = {
  "Less than 2 years": 0,
  "2-5 years": 2,
  "5+ years": 5,
};

function meetsMinimumEducation(
  educationLevel: string | undefined,
  minimumEducation: CourseEducationLevel,
) {
  const normalizedEducation = educationLevel as CourseEducationLevel | undefined;

  if (!normalizedEducation) {
    return false;
  }

  return educationRank[normalizedEducation] >= educationRank[minimumEducation];
}

function meetsMinimumExperience(
  experienceRange: string | undefined,
  minimumExperienceYears: number,
) {
  const normalizedExperience = experienceRange as CourseExperienceLevel | undefined;

  if (!normalizedExperience) {
    return false;
  }

  return experienceRank[normalizedExperience] >= minimumExperienceYears;
}

function evaluateRule(
  rule: EligibilityRule,
  answers: EligibilityAnswers,
) {
  switch (rule.type) {
    case "min_education":
      return meetsMinimumEducation(answers.educationLevel, rule.minEducation);
    case "min_education_or_experience":
      return (
        meetsMinimumEducation(answers.educationLevel, rule.minEducation) ||
        meetsMinimumExperience(answers.experienceRange, rule.minExperienceYears)
      );
    default:
      return false;
  }
}

export function evaluateCourseEligibility(
  config: CourseEligibilityConfig,
  answers: EligibilityAnswers,
): EligibilityResult {
  const eligible = config.rules.some((rule) => evaluateRule(rule, answers));

  return {
    eligible,
    reason: eligible ? config.successCopy : config.ineligibleCopy,
  };
}

export function getCourseMinimumEducation(
  config: CourseEligibilityConfig,
): CourseEducationLevel {
  return config.rules[0]?.minEducation ?? "Bachelor degree";
}

export function hasCourseExperienceAlternative(
  config: CourseEligibilityConfig,
) {
  return config.rules.some(
    (rule) =>
      rule.type === "min_education_or_experience" &&
      rule.minExperienceYears > 0,
  );
}
