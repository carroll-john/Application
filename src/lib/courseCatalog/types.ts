import type { RequirementInstance } from "../eligibility/requirements";
import type { CourseEligibilityConfig } from "../courseEligibility";

export interface RawValueItem {
  value?: string | null;
}

export interface RawCourseEntry {
  core_subjects_modules?: RawValueItem[] | null;
  course_description?: string | null;
  course_duration?: string | null;
  course_name: string;
  entry_requirements?: string | null;
  fee_help_eligibility?: string | null;
  intake_start_dates?: RawValueItem[] | null;
  outcomes?: string | null;
  provider_name: string;
  recognition_of_prior_learning?: string | null;
  subject_area?: string | null;
  tuition_fees?: string | null;
}

export interface RawCourseCatalogData {
  courses: RawCourseEntry[];
}

export interface CourseCatalogEntry {
  code: string;
  title: string;
  provider: string;
  providerCode?: string;
  categories: string[];
  delivery: string;
  duration?: string;
  price?: string;
  studyLevel?: string;
  courseType?: string;
  intakeLabel: string;
  summary?: string;
  description?: string;
  subjectArea?: string;
  entryRequirements?: string;
  recognitionOfPriorLearning?: string;
  coreSubjects: string[];
  intakeDates: string[];
  tuitionFees?: string;
  feeHelpEligibility?: string;
  feeSummary?: string;
  supportSummary?: string;
  supportOptions: string[];
  feeNotes: string[];
  outcomes?: string;
  eligibility: CourseEligibilityConfig;
  /**
   * Canonical eligibility requirements parsed from the course's `entry_requirements` text by the
   * offline `scripts/parse-course-requirements.ts` pipeline. Optional during the migration: when
   * absent, the runtime falls back to the legacy `eligibility` rules and the deterministic regex
   * thresholds from `parseEntryRequirementThresholds`.
   */
  requirements?: RequirementInstance[];
}
