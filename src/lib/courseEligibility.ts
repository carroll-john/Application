import type { CourseCatalogEntry } from "./courseCatalog";
import type {
  AcademicThresholdParams,
  RequirementInstance,
} from "./eligibility/requirements";

export type CourseEducationLevel =
  | "High school"
  | "Diploma"
  | "Bachelor degree"
  | "Masters degree"
  | "Doctorate";

export type CourseExperienceLevel =
  | "1-2 years"
  | "3-5 years"
  | "5 years plus";

export interface EligibilityAnswers {
  academicThreshold?: string;
  educationLevel?: string;
  englishEvidence?: string;
  experienceRange?: string;
  fieldOfStudy?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface EligibilityQuestionOption {
  label: string;
  value: string;
}

export interface EligibilityQuestion {
  id: keyof EligibilityAnswers;
  label: string;
  options: EligibilityQuestionOption[];
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
  "1-2 years": 1,
  "3-5 years": 3,
  "5 years plus": 5,
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

const academicThresholdValues = [
  "Meets or exceeds the required WAM/GPA",
  "Below the required WAM/GPA",
  "Not sure",
] as const;

const englishEvidenceOptions = [
  "Completed qualification in an accepted English-speaking country",
  "Approved English test result",
  "Current AHPRA registration",
  "Need to provide evidence",
] as const;

const fieldOfStudyOptions = ["Related field", "Different field", "Not sure"] as const;

function toOptions(values: readonly string[]): EligibilityQuestionOption[] {
  return values.map((value) => ({ label: value, value }));
}

function hasRequirement(
  requirements: readonly RequirementInstance[],
  kind: RequirementInstance["kind"],
) {
  return requirements.some((requirement) => requirement.kind === kind);
}

function formatAcademicThreshold(params: AcademicThresholdParams): string {
  if (params.metric === "gpa") {
    return params.scale != null
      ? `${params.min}/${params.scale} GPA`
      : `${params.min} GPA`;
  }

  return params.scale === 100 ? `${params.min}% WAM` : `${params.min} WAM`;
}

function buildAcademicThresholdOptions(
  requirements: readonly RequirementInstance[],
): EligibilityQuestionOption[] {
  const requirement = requirements.find(
    (candidate): candidate is Extract<RequirementInstance, { kind: "academic_threshold" }> =>
      candidate.kind === "academic_threshold",
  );

  if (!requirement) {
    return toOptions(academicThresholdValues);
  }

  const threshold = formatAcademicThreshold(requirement.params);

  return [
    {
      label: `Meets or exceeds the required ${threshold}`,
      value: academicThresholdValues[0],
    },
    { label: `Below the required ${threshold}`, value: academicThresholdValues[1] },
    { label: "Not sure", value: academicThresholdValues[2] },
  ];
}

export function getCourseEligibilityQuestions(
  course: CourseCatalogEntry,
): EligibilityQuestion[] {
  const requirements = course.requirements ?? [];
  if (requirements.length === 0) {
    return [
      {
        id: "educationLevel",
        label: "Select: Education level",
        options: toOptions(course.eligibility.educationOptions),
      },
      ...(hasCourseExperienceAlternative(course.eligibility)
        ? [
            {
              id: "experienceRange" as const,
              label: "Select: Experience",
              options: toOptions(course.eligibility.experienceOptions),
            },
          ]
        : []),
    ];
  }

  const questions: EligibilityQuestion[] = [];
  if (
    hasRequirement(requirements, "qualification_completed") ||
    hasRequirement(requirements, "qualification_level")
  ) {
    questions.push({
      id: "educationLevel",
      label: "Highest completed qualification",
      options: toOptions(course.eligibility.educationOptions),
    });
  }
  if (hasRequirement(requirements, "academic_threshold")) {
    questions.push({
      id: "academicThreshold",
      label: "Academic result",
      options: buildAcademicThresholdOptions(requirements),
    });
  }
  if (hasRequirement(requirements, "work_experience")) {
    questions.push({
      id: "experienceRange",
      label: "Relevant work experience",
      options: toOptions(course.eligibility.experienceOptions),
    });
  }
  if (hasRequirement(requirements, "field_of_study")) {
    questions.push({
      id: "fieldOfStudy",
      label: "Prior field of study",
      options: toOptions(fieldOfStudyOptions),
    });
  }
  if (hasRequirement(requirements, "english_proficiency")) {
    questions.push({
      id: "englishEvidence",
      label: "English evidence",
      options: toOptions(englishEvidenceOptions),
    });
  }

  return questions;
}

export function isCourseEligibilityFormComplete(
  course: CourseCatalogEntry,
  answers: EligibilityAnswers,
) {
  return getCourseEligibilityQuestions(course).every((question) =>
    Boolean(answers[question.id]),
  );
}

export function evaluateCourseRequirementAnswers(
  course: CourseCatalogEntry,
  answers: EligibilityAnswers,
): EligibilityResult {
  const requirements = course.requirements ?? [];
  if (requirements.length === 0) {
    return evaluateCourseEligibility(course.eligibility, answers);
  }

  const doesNotMeetAcademic =
    answers.academicThreshold === "Below the required WAM/GPA" ||
    answers.academicThreshold === "Not sure";
  const doesNotMeetField =
    answers.fieldOfStudy === "Different field" || answers.fieldOfStudy === "Not sure";
  const needsEnglishEvidence = answers.englishEvidence === "Need to provide evidence";

  if (doesNotMeetAcademic || doesNotMeetField || needsEnglishEvidence) {
    return {
      eligible: false,
      reason:
        "This program has evidence requirements that need more detail or admissions review before you can rely on the automated check.",
    };
  }

  return {
    eligible: true,
    reason: `Your answers indicate you may have the evidence needed for ${course.title}. You can add documents and details in the application.`,
  };
}
