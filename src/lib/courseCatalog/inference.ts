import type {
  CourseEducationLevel,
  CourseExperienceLevel,
} from "../courseEligibility";
import { sanitizeText } from "./text";
import type { RawCourseEntry } from "./types";

export const DEFAULT_MIN_EDUCATION: CourseEducationLevel = "Bachelor degree";
export const DEFAULT_MIN_EXPERIENCE_YEARS = 3;

export const DEFAULT_EDUCATION_OPTIONS: readonly CourseEducationLevel[] = [
  "High school",
  "Diploma",
  "Bachelor degree",
  "Masters degree",
  "Doctorate",
];

export const DEFAULT_EXPERIENCE_OPTIONS: readonly CourseExperienceLevel[] = [
  "1-2 years",
  "3-5 years",
  "5 years plus",
];

export function inferCategories(subjectArea: string) {
  const normalized = subjectArea.toLowerCase();
  const categories: string[] = [];

  if (
    /\b(business|management|commerce|economics|marketing|leadership|human resource|project management)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Business");
  }

  if (
    /\b(technology|information technology|information and communication technology|ict|data|analytics|artificial intelligence|machine learning|cyber|digital|engineering|cloud)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Technology");
  }

  if (/\b(communication|media|journalism)\b/i.test(normalized)) {
    categories.push("Communication");
  }

  if (/\b(built environment|building|construction|architecture)\b/i.test(normalized)) {
    categories.push("Built Environment");
  }

  if (
    /\b(health|healthcare|public health|nursing|clinical|human services)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Health");
  }

  if (/\b(law|legal|juris)\b/i.test(normalized)) {
    categories.push("Law");
  }

  if (/\b(government|politics|public policy|public administration|policy)\b/i.test(normalized)) {
    categories.push("Politics & Society");
  }

  if (/\b(education|teaching|languages)\b/i.test(normalized)) {
    categories.push("Education");
  }

  return Array.from(new Set(categories));
}

export function inferCourseType(title: string) {
  if (/^bachelor/i.test(title)) {
    return {
      courseType: "Bachelor's",
      studyLevel: "Undergraduate",
    };
  }

  if (/^graduate certificate/i.test(title)) {
    return {
      courseType: "Graduate Certificate",
      studyLevel: "Postgraduate",
    };
  }

  if (/^master/i.test(title)) {
    return {
      courseType: "Master's",
      studyLevel: "Postgraduate",
    };
  }

  return {
    courseType: "Course",
    studyLevel: "Postgraduate",
  };
}

export function inferDelivery(course: RawCourseEntry) {
  const haystack = `${course.course_name} ${course.course_description ?? ""} ${course.provider_name}`;

  if (/100%\s*online|fully online|online/i.test(haystack)) {
    return "100% Online";
  }

  return "Flexible study";
}

export function inferEducationMinimum(
  course: RawCourseEntry,
  studyLevel: string,
): CourseEducationLevel {
  const requirements = sanitizeText(course.entry_requirements).toLowerCase();

  if (/doctorate|phd/.test(requirements)) {
    return "Doctorate";
  }

  if (/master'?s|masters degree|master degree/.test(requirements)) {
    return "Masters degree";
  }

  if (/bachelor/.test(requirements) || studyLevel === "Postgraduate") {
    return "Bachelor degree";
  }

  if (/diploma|advanced diploma|graduate certificate/.test(requirements)) {
    return "Diploma";
  }

  if (/year 12|high school|secondary/.test(requirements)) {
    return "High school";
  }

  return DEFAULT_MIN_EDUCATION;
}

export function inferExperienceMinimum(course: RawCourseEntry) {
  const requirements = sanitizeText(course.entry_requirements).toLowerCase();
  const years = [...requirements.matchAll(/(\d+)\s*\+?\s*years?/g)].map((match) =>
    Number.parseInt(match[1] ?? "0", 10),
  );

  if (years.length === 0) {
    return DEFAULT_MIN_EXPERIENCE_YEARS;
  }

  const maximumYears = Math.max(0, ...years);

  if (maximumYears >= 5) {
    return 5;
  }

  if (maximumYears >= 3) {
    return 3;
  }

  if (maximumYears >= 2) {
    return 2;
  }

  return 0;
}

function formatExperienceMinimum(minimumYears: number) {
  if (minimumYears >= 5) {
    return "five or more years";
  }

  if (minimumYears >= 3) {
    return "three or more years";
  }

  if (minimumYears >= 2) {
    return "two or more years";
  }

  return "relevant experience";
}

export function buildIneligibleCopy(
  title: string,
  minimumEducation: CourseEducationLevel,
  minimumExperienceYears: number,
) {
  if (minimumExperienceYears <= 0) {
    return `${title} expects ${minimumEducation.toLowerCase()} completion.`;
  }

  return `${title} expects either ${minimumEducation.toLowerCase()} study or ${formatExperienceMinimum(
    minimumExperienceYears,
  )} of relevant experience.`;
}
