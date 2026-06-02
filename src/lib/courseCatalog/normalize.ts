import type { CourseCatalogEntry, RawCourseEntry } from "./types";
import { slugify } from "./slugify";
import { getFirstSentence, sanitizeText, toValueList } from "./text";
import { buildFeeSummary } from "./fees";
import { normalizeDurationLabel } from "./duration";
import { normalizeIntakeLabel } from "./intake";
import {
  DEFAULT_EDUCATION_OPTIONS,
  DEFAULT_EXPERIENCE_OPTIONS,
  buildIneligibleCopy,
  inferCategories,
  inferCourseType,
  inferDelivery,
  inferEducationMinimum,
  inferExperienceMinimum,
} from "./inference";

// Re-exported for backward compatibility with existing importers
// (`features/section2/tertiaryTranscriptParsePolicy.ts`).
export {
  parseEntryRequirementThresholds,
  type ParsedEntryRequirementThresholds,
} from "./entryRequirements";

/**
 * Builds the `transformCourse` mapper that turns a raw catalog entry into the
 * normalized `CourseCatalogEntry` consumed by the app. The free-text parsing
 * and field-inference logic lives in the focused sibling modules (`fees`,
 * `duration`, `intake`, `inference`, `text`); this orchestrator only composes
 * them and assigns a stable course code.
 */
export function createCourseTransformer(baseCodeCounts: Record<string, number>) {
  function buildCourseCode(course: RawCourseEntry) {
    if (
      /southern cross university/i.test(course.provider_name) &&
      /master of business administration/i.test(course.course_name) &&
      /online/i.test(course.course_name)
    ) {
      return "mba-online";
    }

    const baseCode = slugify(course.course_name);

    if ((baseCodeCounts[baseCode] ?? 0) === 1) {
      return baseCode;
    }

    return `${slugify(course.provider_name)}-${baseCode}`;
  }

  return function transformCourse(course: RawCourseEntry): CourseCatalogEntry {
    const title = sanitizeText(course.course_name);
    const provider = sanitizeText(course.provider_name);
    const description = sanitizeText(course.course_description);
    const subjectArea = sanitizeText(course.subject_area);
    const intakeDates = toValueList(course.intake_start_dates);
    const intakeLabel = normalizeIntakeLabel(intakeDates);
    const { courseType, studyLevel } = inferCourseType(title);
    const minimumEducation = inferEducationMinimum(course, studyLevel);
    const minimumExperienceYears = inferExperienceMinimum(course);
    const { feeSummary, supportSummary, supportOptions, feeNotes } = buildFeeSummary(course);

    return {
      code: buildCourseCode(course),
      title,
      provider,
      providerCode: slugify(provider),
      categories: inferCategories(subjectArea),
      delivery: inferDelivery(course),
      duration: normalizeDurationLabel(course.course_duration),
      price: feeSummary,
      studyLevel,
      courseType,
      intakeLabel,
      summary: getFirstSentence(description, 190) || undefined,
      description: description || undefined,
      subjectArea: subjectArea || undefined,
      entryRequirements: sanitizeText(course.entry_requirements) || undefined,
      recognitionOfPriorLearning:
        sanitizeText(course.recognition_of_prior_learning) || undefined,
      coreSubjects: toValueList(course.core_subjects_modules),
      intakeDates,
      tuitionFees: sanitizeText(course.tuition_fees) || undefined,
      feeHelpEligibility: sanitizeText(course.fee_help_eligibility) || undefined,
      feeSummary,
      supportSummary,
      supportOptions,
      feeNotes,
      outcomes: sanitizeText(course.outcomes) || undefined,
      eligibility: {
        educationOptions: [...DEFAULT_EDUCATION_OPTIONS],
        experienceOptions: [...DEFAULT_EXPERIENCE_OPTIONS],
        rules:
          minimumExperienceYears > 0
            ? [
                {
                  type: "min_education_or_experience" as const,
                  minEducation: minimumEducation,
                  minExperienceYears: minimumExperienceYears,
                },
              ]
            : [
                {
                  type: "min_education" as const,
                  minEducation: minimumEducation,
                },
              ],
        successCopy: `You meet the entry criteria for ${title}.`,
        ineligibleCopy: buildIneligibleCopy(title, minimumEducation, minimumExperienceYears),
      },
    };
  };
}
