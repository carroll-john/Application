import { replaceStoredDocument } from "../documentStorage";
import type { UploadedDocument } from "../documentStorage";
import type { EligibilityRequirementStatus } from "./types";

export const ELIGIBILITY_FEEDBACK_DOCUMENT_KIND = "eligibility_feedback" as const;
export const ELIGIBILITY_FEEDBACK_FILE_NAME = "eligibility-feedback.json";
export const ELIGIBILITY_FEEDBACK_SCHEMA_VERSION = 1;

export interface EligibilityFeedbackFlaggedRequirement {
  explanation?: string;
  heading: string;
  note?: string;
  originalStatus: EligibilityRequirementStatus;
  reasonCode?: string;
  requirementId: string;
  requirementSourceText: string;
}

export interface EligibilityFeedbackDocumentPayload {
  assessment?: {
    modelId?: string;
    promptVersion?: string;
    rulesVersion?: string;
    schemaVersion?: string;
    serviceVersion?: string;
  };
  courseCode?: string;
  courseTitle?: string;
  flaggedRequirements: EligibilityFeedbackFlaggedRequirement[];
  savedAt: string;
  schemaVersion: typeof ELIGIBILITY_FEEDBACK_SCHEMA_VERSION;
}

export function buildEligibilityFeedbackDocumentPayload(options: {
  assessment?: EligibilityFeedbackDocumentPayload["assessment"];
  courseCode?: string;
  courseTitle?: string;
  flaggedRequirements: EligibilityFeedbackFlaggedRequirement[];
  savedAt?: string;
}): EligibilityFeedbackDocumentPayload {
  return {
    assessment: options.assessment,
    courseCode: options.courseCode,
    courseTitle: options.courseTitle,
    flaggedRequirements: options.flaggedRequirements,
    savedAt: options.savedAt ?? new Date().toISOString(),
    schemaVersion: ELIGIBILITY_FEEDBACK_SCHEMA_VERSION,
  };
}

export function createEligibilityFeedbackFile(
  payload: EligibilityFeedbackDocumentPayload,
): File {
  const body = JSON.stringify(payload, null, 2);
  return new File([body], ELIGIBILITY_FEEDBACK_FILE_NAME, {
    lastModified: Date.parse(payload.savedAt),
    type: "application/json",
  });
}

export async function saveEligibilityFeedbackDocument(options: {
  applicationId: string;
  currentDocument?: UploadedDocument;
  payload: EligibilityFeedbackDocumentPayload;
}): Promise<UploadedDocument> {
  const file = createEligibilityFeedbackFile(options.payload);
  const document = await replaceStoredDocument(file, options.currentDocument, {
    applicationId: options.applicationId,
    kind: ELIGIBILITY_FEEDBACK_DOCUMENT_KIND,
  });

  if (!document) {
    throw new Error("Unable to save eligibility feedback.");
  }

  return document;
}
