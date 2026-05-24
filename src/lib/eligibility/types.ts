export type EligibilityOutcome =
  | "eligible"
  | "conditionally_eligible"
  | "ineligible"
  | "insufficient_data";

export type EligibilityRequirementStatus = "pass" | "fail" | "unknown";

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

