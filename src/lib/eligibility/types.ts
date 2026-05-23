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

export interface TranscriptEligibilityRequestContext {
  courseCode?: string;
  courseTitle?: string;
  institution?: string;
  level?: string;
  completed?: boolean;
  languageTestsCount?: number;
}

