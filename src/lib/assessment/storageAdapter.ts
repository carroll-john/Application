import type { Session } from "@supabase/supabase-js";
import type { TranscriptEligibilityAssessment } from "../eligibility/types";
import type {
  AssessmentSessionSnapshot,
  AssessmentSessionStatus,
  CreditEstimateResult,
  PilotActivation,
} from "./types";
import type { CvRecognitionDraft } from "../ucRplAssessment";

export class AssessmentStorageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AssessmentStorageError";
  }
}

export interface AssessmentStorageAdapter {
  activateInvitation: (invitationToken: string) => Promise<PilotActivation>;
  evaluateTranscript: (
    assessmentSessionId: string,
    transcript: File,
  ) => Promise<{
    documentId: string;
    results: CreditEstimateResult[];
    transcriptAssessment: TranscriptEligibilityAssessment;
  }>;
  loadSession: (assessmentSessionId: string) => Promise<AssessmentSessionSnapshot>;
  promoteToApplication: (
    assessmentSessionId: string,
    applicationId: string,
  ) => Promise<void>;
  saveSession: (
    assessmentSessionId: string,
    update: {
      confirmedCv?: CvRecognitionDraft;
      shortlistCourseCodes?: string[];
      status?: AssessmentSessionStatus;
    },
  ) => Promise<AssessmentSessionSnapshot>;
  uploadDocument: (
    assessmentSessionId: string,
    kind: "cv",
    file: File,
  ) => Promise<{ documentId: string; scanStatus: string }>;
}

interface RawAssessmentResult {
  catalogue_version: string;
  confidence: "high" | "medium" | "low";
  course_code: string;
  manual_review_reasons: string[];
  matched_transcript_evidence: CreditEstimateResult["matchedTranscriptEvidence"];
  model_version: string;
  potential_credit_points: number | null;
  published_cap: number | null;
  rules_version: string;
}

interface RawAssessmentSession {
  application_id: string | null;
  assessment_results?: RawAssessmentResult[];
  catalogue_id: string;
  catalogue_version: string;
  cohort: "control" | "treatment";
  confirmed_cv: CvRecognitionDraft | null;
  created_at: string;
  expires_at: string;
  id: string;
  model_version: string;
  partner_id: string;
  rules_version: string;
  shortlist_course_codes: string[];
  status: AssessmentSessionStatus;
  transcript_assessment: TranscriptEligibilityAssessment | null;
  updated_at: string;
}

async function responsePayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function requireOk<T>(response: Response): Promise<T> {
  const payload = await responsePayload(response);
  if (!response.ok) {
    const record =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    throw new AssessmentStorageError(
      typeof record.error === "string"
        ? record.error
        : "The assessment request failed.",
      response.status,
      typeof record.code === "string" ? record.code : undefined,
    );
  }
  return payload as T;
}

function toSession(raw: RawAssessmentSession): AssessmentSessionSnapshot {
  return {
    applicationId: raw.application_id,
    catalogueId: raw.catalogue_id,
    cohort: raw.cohort,
    confirmedCv: raw.confirmed_cv,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    id: raw.id,
    partnerId: raw.partner_id,
    results: (raw.assessment_results ?? []).map((result) => ({
      confidence: result.confidence,
      courseCode: result.course_code,
      manualReviewReasons: result.manual_review_reasons,
      matchedTranscriptEvidence: result.matched_transcript_evidence,
      potentialCreditPoints: result.potential_credit_points,
      publishedCap: result.published_cap,
      versions: {
        catalogueVersion: result.catalogue_version,
        modelVersion: result.model_version,
        rulesVersion: result.rules_version,
      },
    })),
    shortlistCourseCodes: raw.shortlist_course_codes,
    status: raw.status,
    transcriptAssessment: raw.transcript_assessment,
    updatedAt: raw.updated_at,
    versions: {
      catalogueVersion: raw.catalogue_version,
      modelVersion: raw.model_version,
      rulesVersion: raw.rules_version,
    },
  };
}

export function createAssessmentStorageAdapter(
  session: Session | null,
): AssessmentStorageAdapter {
  const authenticatedHeaders = () => {
    if (!session?.access_token) {
      throw new AssessmentStorageError(
        "Sign in to continue this assessment.",
        401,
        "ASSESSMENT_UNAUTHENTICATED",
      );
    }
    return { authorization: `Bearer ${session.access_token}` };
  };

  return {
    activateInvitation: async (invitationToken) =>
      requireOk<PilotActivation>(
        await fetch("/api/assessment/activate", {
          body: JSON.stringify({ invitationToken }),
          headers: {
            "content-type": "application/json",
            ...(session?.access_token
              ? { authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          method: "POST",
        }),
      ),
    evaluateTranscript: async (assessmentSessionId, transcript) => {
      const body = new FormData();
      body.append("file", transcript);
      body.append("sessionId", assessmentSessionId);
      return requireOk(
        await fetch("/api/assessment/evaluate", {
          body,
          headers: authenticatedHeaders(),
          method: "POST",
        }),
      );
    },
    loadSession: async (assessmentSessionId) =>
      toSession(
        await requireOk<RawAssessmentSession>(
          await fetch(
            `/api/assessment/session?id=${encodeURIComponent(assessmentSessionId)}`,
            { headers: authenticatedHeaders() },
          ),
        ),
      ),
    promoteToApplication: async (assessmentSessionId, applicationId) => {
      await requireOk(
        await fetch("/api/assessment/start-application", {
          body: JSON.stringify({ applicationId, assessmentSessionId }),
          headers: {
            ...authenticatedHeaders(),
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );
    },
    saveSession: async (assessmentSessionId, update) =>
      toSession(
        await requireOk<RawAssessmentSession>(
          await fetch("/api/assessment/session", {
            body: JSON.stringify({ assessmentSessionId, ...update }),
            headers: {
              ...authenticatedHeaders(),
              "content-type": "application/json",
            },
            method: "PATCH",
          }),
        ),
      ),
    uploadDocument: async (assessmentSessionId, kind, file) => {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      body.append("sessionId", assessmentSessionId);
      return requireOk(
        await fetch("/api/assessment/document", {
          body,
          headers: authenticatedHeaders(),
          method: "POST",
        }),
      );
    },
  };
}
