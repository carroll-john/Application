import type { CvRecognitionDraft } from "../ucRplAssessment";
import type { TranscriptEligibilityAssessment } from "../eligibility/types";

export type AssessmentCohort = "control" | "treatment";
export type AssessmentConfidence = "high" | "medium" | "low";
export type AssessmentSessionStatus =
  | "cv_review"
  | "shortlist"
  | "transcript"
  | "evaluated"
  | "application_started"
  | "abandoned";
export type AssessmentReviewStatus =
  | "unassigned"
  | "in_review"
  | "agreed"
  | "corrected"
  | "exported";

export interface AssessmentVersionSnapshot {
  catalogueVersion: string;
  modelVersion: string;
  rulesVersion: string;
}

export interface MatchedTranscriptEvidence {
  creditPoints: number;
  mappingId: string;
  title: string;
  unitCode: string | null;
}

export interface CreditEstimateResult {
  confidence: AssessmentConfidence;
  courseCode: string;
  manualReviewReasons: string[];
  matchedTranscriptEvidence: MatchedTranscriptEvidence[];
  potentialCreditPoints: number | null;
  publishedCap: number | null;
  versions: AssessmentVersionSnapshot;
}

export interface AssessmentSessionSnapshot {
  applicationId: string | null;
  catalogueId: string;
  cohort: AssessmentCohort;
  confirmedCv: CvRecognitionDraft | null;
  createdAt: string;
  expiresAt: string;
  id: string;
  partnerId: string;
  results: CreditEstimateResult[];
  shortlistCourseCodes: string[];
  status: AssessmentSessionStatus;
  transcriptAssessment: TranscriptEligibilityAssessment | null;
  updatedAt: string;
  versions: AssessmentVersionSnapshot;
}

export interface PilotActivation {
  cohort: AssessmentCohort;
  participantId: string;
  partnerId: string;
  resumed: boolean;
  sessionId: string | null;
}

export interface StaffReviewSummary {
  applicationId: string | null;
  assignedTo: string | null;
  confidence: AssessmentConfidence;
  courseCode: string;
  createdAt: string;
  id: string;
  partnerId: string;
  potentialCreditPoints: number | null;
  status: AssessmentReviewStatus;
  versions: AssessmentVersionSnapshot;
}
