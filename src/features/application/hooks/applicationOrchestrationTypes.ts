import type { CvRecognitionDraft } from "../../../lib/ucRplAssessment";
import type { TranscriptEligibilityAssessment } from "../../../lib/eligibility/types";

export interface PersistApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
  keepActive?: boolean;
  shellOnly?: boolean;
}

export interface BeginCourseApplicationOptions {
  authenticatedEmail?: string | null;
  cvFile?: File;
  prefillFromApplicationId?: string | null;
  startFresh?: boolean;
  ucCvPrefill?: CvRecognitionDraft;
  ucTranscriptFile?: File;
  ucTranscriptPrefill?: TranscriptEligibilityAssessment;
}
