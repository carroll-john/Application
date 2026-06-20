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
export type RequirementReasonCode =
  // qualification_completed
  | "QUALIFICATION_COMPLETE"
  | "QUALIFICATION_INCOMPLETE"
  | "QUALIFICATION_COMPLETION_UNKNOWN"
  // qualification_level
  | "QUALIFICATION_LEVEL_MET"
  | "QUALIFICATION_LEVEL_BELOW"
  | "QUALIFICATION_LEVEL_UNKNOWN"
  // academic_threshold
  | "WAM_MET"
  | "WAM_BELOW"
  | "GPA_MET"
  | "GPA_BELOW"
  | "ACADEMIC_EVIDENCE_MISSING"
  // english_proficiency
  | "ENGLISH_OK_COUNTRY"
  | "ENGLISH_OK_AHPRA"
  | "ENGLISH_TEST_UNVERIFIED"
  | "ENGLISH_UNVERIFIED"
  // work_experience
  | "WORK_EXPERIENCE_UNVERIFIED"
  // field_of_study
  | "FIELD_MATCH"
  | "FIELD_MISMATCH"
  | "FIELD_PROGRAM_MISSING"
  // alternative-group fold
  | "GROUP_SATISFIED"
  | "GROUP_UNSATISFIED"
  | "GROUP_UNCONFIRMED";

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
}

export interface EligibilityAcademicPerformance {
  creditPointsCompleted?: EligibilityExtractedField;
  failedSubjects?: EligibilityExtractedField;
  gradeAverageOrWam?: EligibilityExtractedField;
  gpa?: EligibilityExtractedField;
  gpaScale?: EligibilityExtractedField;
  gradingNotes?: EligibilityExtractedField;
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

export interface EligibilityRequirementCheck {
  explanation: string;
  id: string;
  reasonCode?: RequirementReasonCode;
  requirement: string;
  status: EligibilityRequirementStatus;
}

export interface TranscriptEligibilityAssessment {
  checkedAt: string;
  confidence: number;
  extractedData: TranscriptExtractedData;
  manualReviewRequired: boolean;
  missingInformation: string[];
  outcome: EligibilityOutcome;
  programCode?: string;
  programTitle?: string;
  recommendedNextStep: string;
  requirementsChecked: EligibilityRequirementCheck[];
  rulesVersion?: string;
  serviceVersion?: string;
}

import type { RequirementInstance } from "./requirements";

export interface TranscriptEligibilityRequestContext {
  completed?: boolean;
  country?: string;
  courseCode?: string;
  courseTitle?: string;
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

