export type EligibilityOutcome =
  | "eligible"
  | "conditionally_eligible"
  | "ineligible"
  | "insufficient_data";

export type EligibilityRequirementStatus = "pass" | "fail" | "unknown";

/**
 * Stable, machine-readable reason for a requirement check's status. Unlike the free-text
 * `explanation` (which is tuned for display and may change), these codes are durable and safe to
 * branch UI on or aggregate in analytics. Optional so the legacy `deterministicRules` path and any
 * future producer can omit them without breaking the contract.
 */
export const ALL_REQUIREMENT_REASON_CODES = [
  // qualification_completed
  "QUALIFICATION_COMPLETE",
  "QUALIFICATION_INCOMPLETE",
  "QUALIFICATION_COMPLETION_UNKNOWN",
  "QUALIFICATION_IDENTITY_UNKNOWN",
  "QUALIFICATION_NAME_MISMATCH",
  "QUALIFICATION_PROVIDER_MISMATCH",
  // qualification_level
  "QUALIFICATION_LEVEL_MET",
  "QUALIFICATION_LEVEL_BELOW",
  "QUALIFICATION_LEVEL_UNKNOWN",
  // academic_threshold
  "WAM_MET",
  "WAM_BELOW",
  "GPA_MET",
  "GPA_BELOW",
  "ACADEMIC_EVIDENCE_MISSING",
  // english_proficiency
  "ENGLISH_OK_COUNTRY",
  "ENGLISH_OK_AHPRA",
  "ENGLISH_TEST_UNVERIFIED",
  "ENGLISH_UNVERIFIED",
  // work_experience
  "WORK_EXPERIENCE_UNVERIFIED",
  // field_of_study
  "FIELD_MATCH",
  "FIELD_MISMATCH",
  "FIELD_PROGRAM_MISSING",
  // alternative-group fold
  "GROUP_SATISFIED",
  "GROUP_UNSATISFIED",
  "GROUP_UNCONFIRMED",
  // automated evaluation could not run at all (service/LLM unavailable)
  "SERVICE_UNAVAILABLE",
] as const;

export type RequirementReasonCode = (typeof ALL_REQUIREMENT_REASON_CODES)[number];

export interface EligibilityExtractedField {
  confidence: number;
  missingOrAmbiguous?: boolean;
  normalizedValue?: string;
  originalValue?: string;
}

export interface EligibilityApplicantDetails {
  countryOfInstitution?: EligibilityExtractedField;
  fullName?: EligibilityExtractedField;
  institutionName?: EligibilityExtractedField;
  studentId?: EligibilityExtractedField;
}

export interface EligibilityStudyDetails {
  completionDate?: EligibilityExtractedField;
  completionStatus?: EligibilityExtractedField;
  expectedCompletionDate?: EligibilityExtractedField;
  highestEducationLevel?: EligibilityExtractedField;
  languageOfInstruction?: EligibilityExtractedField;
  programName?: EligibilityExtractedField;
  startDate?: EligibilityExtractedField;
  studyEndDate?: EligibilityExtractedField;
}

export interface EligibilityAcademicPerformance {
  creditPointsCompleted?: EligibilityExtractedField;
  failedSubjects?: EligibilityExtractedField;
  gradeAverageOrWam?: EligibilityExtractedField;
  gpa?: EligibilityExtractedField;
  gpaScale?: EligibilityExtractedField;
  gradingNotes?: EligibilityExtractedField;
  unitResults?: EligibilityAcademicUnitResult[];
}

export interface EligibilityAcademicUnitResult {
  counted?: boolean;
  creditPoints?: number;
  grade?: string;
  mark?: number;
  notes?: string;
  title?: string;
  unitCode?: string;
}

export interface EligibilityEnglishEvidence {
  englishCountryEvidence?: EligibilityExtractedField;
  englishInstructionEvidence?: EligibilityExtractedField;
  englishRequirementSatisfaction?: EligibilityExtractedField;
  uncertainty?: EligibilityExtractedField;
}

export interface TranscriptExtractedData {
  academicPerformance?: EligibilityAcademicPerformance;
  applicantDetails?: EligibilityApplicantDetails;
  englishLanguageEvidence?: EligibilityEnglishEvidence;
  studyDetails?: EligibilityStudyDetails;
}

/**
 * Small structured payload attached to a check so display copy can interpolate the observed and
 * required values (e.g. "5.25/7" vs "4/7") without parsing the free-text `explanation`.
 */
export interface EligibilityCheckDetails {
  metric?: string;
  observed?: string;
  required?: string;
}

export interface EligibilityRequirementCheck {
  details?: EligibilityCheckDetails;
  explanation: string;
  id: string;
  reasonCode?: RequirementReasonCode;
  requirement: string;
  status: EligibilityRequirementStatus;
  /** Entry pathway that produced this check. Omitted for global requirements. */
  pathwayId?: string;
}

export interface EligibilityPathwayResult {
  checks: EligibilityRequirementCheck[];
  failCount: number;
  id: string;
  passCount: number;
  status: "satisfied" | "pending" | "not_satisfied";
  unknownCount: number;
}

/**
 * A requirement the transcript pipeline deliberately did not judge because its proof lives in a
 * different document (CV for work experience, test report / AHPRA for English). Surfaced so the UI
 * can prompt for the right next document instead of degrading the transcript verdict.
 */
export interface EligibilityPendingEvidence {
  evidenceSource: "transcript" | "cv" | "english_evidence";
  kind: string;
  reasonCode?: RequirementReasonCode;
  requirementId: string;
}

export interface TranscriptEligibilityAssessment {
  checkedAt: string;
  confidence: number;
  extractedData: TranscriptExtractedData;
  /**
   * Free-text extraction observations from the LLM. Never rendered to applicants — kept for
   * admissions/debugging/analytics. Applicant-facing `missingInformation` is derived
   * deterministically from `requirementsChecked` reason codes instead.
   */
  extractionNotes?: string[];
  manualReviewRequired: boolean;
  missingInformation: string[];
  modelId?: string;
  outcome: EligibilityOutcome;
  pendingEvidence?: EligibilityPendingEvidence[];
  pathwayResults?: EligibilityPathwayResult[];
  programCode?: string;
  programTitle?: string;
  promptVersion?: string;
  recommendedNextStep: string;
  requirementsChecked: EligibilityRequirementCheck[];
  selectedPathwayId?: string;
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

import type { RequirementInstance } from "./requirements";

export interface TranscriptEligibilityRequestContext {
  completed?: boolean;
  country?: string;
  courseCode?: string;
  courseTitle?: string;
  /** Whether the applicant has already uploaded a CV (work-experience evidence lives there). */
  cvUploaded?: boolean;
  /** Number of employment entries the applicant has added elsewhere in the application. */
  employmentCount?: number;
  entryRequirementsText?: string;
  /** Whether the applicant holds an AHPRA registration (accepted as English-proficiency evidence). */
  hasAhpraRegistration?: boolean;
  institution?: string;
  languageTestsCount?: number;
  level?: string;
  minGpaScale?: number;
  minGpaValue?: number;
  minWam?: number;
  qualificationLevelRequirement?: string;
  /**
   * Canonical requirements for this course, generated offline by `scripts/parse-course-requirements.ts`
   * and attached at request time by the client. When present, the proxy uses the new matcher pipeline.
   * When absent or empty, the proxy falls back to the legacy deterministic rules.
   */
  requirements?: RequirementInstance[];
}
