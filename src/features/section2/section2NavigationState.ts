import type { TertiaryQualification } from "../../lib/applicationData";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import type { TranscriptEligibilityAssessment } from "../../lib/eligibility/types";

export interface PendingTranscriptEligibilityJob {
  cachedAssessment?: TranscriptEligibilityAssessment;
  qualificationId: string;
  savedQualification?: TertiaryQualification;
  transcriptFile?: File;
}

export interface Section2NavigationState {
  pendingTranscriptEligibility?: PendingTranscriptEligibilityJob;
  section2StatusMessage?: Section2RecordStatusMessage;
}

export function readSection2NavigationState(
  state: unknown,
): Section2NavigationState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const next: Section2NavigationState = {};

  if (
    "section2StatusMessage" in state &&
    state.section2StatusMessage &&
    typeof state.section2StatusMessage === "object" &&
    "message" in state.section2StatusMessage &&
    "type" in state.section2StatusMessage &&
    typeof state.section2StatusMessage.message === "string" &&
    typeof state.section2StatusMessage.type === "string"
  ) {
    next.section2StatusMessage = state.section2StatusMessage as Section2RecordStatusMessage;
  }

  if (
    "pendingTranscriptEligibility" in state &&
    state.pendingTranscriptEligibility &&
    typeof state.pendingTranscriptEligibility === "object" &&
    "qualificationId" in state.pendingTranscriptEligibility &&
    typeof state.pendingTranscriptEligibility.qualificationId === "string"
  ) {
    const job = state.pendingTranscriptEligibility as PendingTranscriptEligibilityJob;
    next.pendingTranscriptEligibility = {
      cachedAssessment: job.cachedAssessment,
      qualificationId: job.qualificationId,
      savedQualification: job.savedQualification,
      transcriptFile:
        job.transcriptFile instanceof File ? job.transcriptFile : undefined,
    };
  }

  return Object.keys(next).length > 0 ? next : null;
}
