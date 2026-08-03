import { randomUUID } from "node:crypto";
import transcriptEligibilityHandler from "../evaluate-transcript-eligibility.js";
import {
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  toParsedUploadFile,
} from "../_documentParser/fileUpload.js";
import { normalizeTranscriptEligibilityAssessment } from "../../src/lib/eligibility/normalize.js";
import {
  evaluateUcTranscriptCredit,
  UC_ASSESSMENT_PARTNER_ID,
} from "../../src/lib/assessment/ucGovernance.js";
import type { Json } from "../../src/lib/supabase.types.js";
import { assessmentHandler } from "../_assessment/handler.js";
import { scanAssessmentDocument } from "../_assessment/scanner.js";
import {
  AssessmentApiError,
  assessmentJson,
  createAssessmentAdminClient,
  getAssessmentUser,
  recordAssessmentAudit,
  requireAssessmentTreatmentEnabled,
  requireRateLimit,
  sha256,
} from "../_assessment/server.js";

async function handleEvaluate(request: Request) {
  if (request.method !== "POST") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  requireAssessmentTreatmentEnabled();

  const { token, user } = await getAssessmentUser(request);
  const admin = createAssessmentAdminClient();
  await requireRateLimit({
    admin,
    key: `evaluate:${user.id}`,
    max: 5,
    windowSeconds: 60,
  });

  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const file = toParsedUploadFile(formData.get("file"));
  if (!sessionId || !file) {
    throw new AssessmentApiError(
      "ASSESSMENT_EVIDENCE_REQUIRED",
      "An assessment session and transcript are required.",
      400,
    );
  }
  if (!isSupportedFile(file) || file.size > MAX_FILE_SIZE_BYTES) {
    throw new AssessmentApiError(
      "ASSESSMENT_FILE_UNSUPPORTED",
      "Use a PDF, DOC, DOCX or TXT transcript smaller than 5 MB.",
      415,
    );
  }

  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("owner_user_id", user.id)
    .eq("partner_id", UC_ASSESSMENT_PARTNER_ID)
    .eq("cohort", "treatment")
    .maybeSingle();
  if (sessionError || !session) {
    throw new AssessmentApiError(
      "ASSESSMENT_SESSION_NOT_FOUND",
      "This treatment assessment session could not be found.",
      404,
    );
  }
  if (session.shortlist_course_codes.length === 0) {
    throw new AssessmentApiError(
      "ASSESSMENT_SHORTLIST_REQUIRED",
      "Choose at least one course before assessing a transcript.",
      400,
    );
  }

  const fileBuffer = await file.arrayBuffer();
  const mimeType = inferMimeType(file);
  if (!isFileBufferConsistentWithMimeType(fileBuffer, mimeType)) {
    throw new AssessmentApiError(
      "ASSESSMENT_FILE_UNSUPPORTED",
      "The transcript content does not match its file type.",
      415,
    );
  }

  const checksum = sha256(fileBuffer);
  const { data: existingDocument, error: existingDocumentError } = await admin
    .from("assessment_documents")
    .select("id, scan_status, storage_path")
    .eq("assessment_session_id", session.id)
    .eq("kind", "tertiary_transcript")
    .eq("sha256", checksum)
    .maybeSingle();
  if (existingDocumentError) {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_LOOKUP_FAILED",
      "The transcript retry state could not be checked.",
      503,
    );
  }

  if (existingDocument?.scan_status === "rejected") {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_REJECTED",
      "This transcript did not pass security scanning and cannot be processed.",
      422,
    );
  }

  let documentId = existingDocument?.id ?? randomUUID();
  const storagePath =
    existingDocument?.storage_path ??
    `${UC_ASSESSMENT_PARTNER_ID}/${user.id}/${session.id}/${documentId}`;
  const alreadyPassed = ["passed", "promoted"].includes(
    existingDocument?.scan_status ?? "",
  );

  if (!existingDocument) {
    const { error: uploadError } = await admin.storage
      .from("assessment-quarantine")
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploadError) {
      throw new AssessmentApiError(
        "ASSESSMENT_DOCUMENT_UPLOAD_FAILED",
        "The transcript could not be stored in quarantine.",
        503,
      );
    }

    const { error: metadataError } = await admin
      .from("assessment_documents")
      .insert({
        file_name: file.name || "transcript",
        id: documentId,
        kind: "tertiary_transcript",
        mime_type: mimeType,
        owner_user_id: user.id,
        partner_id: UC_ASSESSMENT_PARTNER_ID,
        scan_status: "scanning",
        sha256: checksum,
        size_bytes: file.size,
        storage_bucket: "assessment-quarantine",
        storage_path: storagePath,
        assessment_session_id: session.id,
      });
    if (metadataError) {
      await admin.storage.from("assessment-quarantine").remove([storagePath]);
      const { data: racedDocument } = await admin
        .from("assessment_documents")
        .select("id, scan_status")
        .eq("assessment_session_id", session.id)
        .eq("kind", "tertiary_transcript")
        .eq("sha256", checksum)
        .maybeSingle();
      if (!racedDocument || racedDocument.scan_status === "rejected") {
        throw new AssessmentApiError(
          "ASSESSMENT_DOCUMENT_METADATA_FAILED",
          "The quarantined transcript could not be recorded.",
          503,
        );
      }
      documentId = racedDocument.id;
    }
  } else if (!alreadyPassed) {
    await admin
      .from("assessment_documents")
      .update({ scan_status: "scanning" })
      .eq("id", documentId);
  }

  if (!alreadyPassed) {
    let scan;
    try {
      scan = await scanAssessmentDocument(fileBuffer, mimeType);
    } catch (error) {
      await admin
        .from("assessment_documents")
        .update({ scan_status: "quarantined" })
        .eq("id", documentId);
      throw error;
    }

    if (!scan.clean) {
      await admin
        .from("assessment_documents")
        .update({
          rejection_reason: "malware_scan_rejected",
          scan_provider: scan.provider,
          scan_reference: scan.reference,
          scan_status: "rejected",
          scanned_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      throw new AssessmentApiError(
        "ASSESSMENT_DOCUMENT_REJECTED",
        "The transcript did not pass security scanning and cannot be processed.",
        422,
      );
    }

    await admin
      .from("assessment_documents")
      .update({
        rejection_reason: null,
        scan_provider: scan.provider,
        scan_reference: scan.reference,
        scan_status: "passed",
        scanned_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  }

  const eligibilityForm = new FormData();
  eligibilityForm.append("file", new Blob([fileBuffer], { type: mimeType }), file.name);
  eligibilityForm.append(
    "context",
    JSON.stringify({
      courseCode: session.shortlist_course_codes.join(","),
      courseTitle: session.shortlist_course_codes.join("; "),
      cvUploaded: Boolean(session.confirmed_cv),
    }),
  );
  const eligibilityResponse = await transcriptEligibilityHandler.fetch(
    new Request(
      new URL(
        "/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
        request.url,
      ),
      {
        body: eligibilityForm,
        headers: { authorization: `Bearer ${token}` },
        method: "POST",
      },
    ),
  );
  const eligibilityPayload = (await eligibilityResponse.json().catch(() => null)) as unknown;
  if (!eligibilityResponse.ok) {
    throw new AssessmentApiError(
      "ASSESSMENT_EXTRACTION_FAILED",
      "The transcript could not be assessed. It remains available for a retry.",
      eligibilityResponse.status,
    );
  }
  const transcriptAssessment = normalizeTranscriptEligibilityAssessment(
    eligibilityPayload,
  );
  const approvedRulesVersion =
    process.env.UC_ASSESSMENT_APPROVED_RULES_VERSION?.trim() ?? "";
  const results = session.shortlist_course_codes.map((courseCode) =>
    evaluateUcTranscriptCredit({
      approvedRulesVersion,
      assessment: transcriptAssessment,
      courseCode,
    }),
  );

  const { error: resultsError } = await admin.from("assessment_results").upsert(
    results.map((result) => ({
      assessment_session_id: session.id,
      catalogue_version: result.versions.catalogueVersion,
      confidence: result.confidence,
      course_code: result.courseCode,
      manual_review_reasons: result.manualReviewReasons as Json,
      matched_transcript_evidence: result.matchedTranscriptEvidence as unknown as Json,
      model_version: result.versions.modelVersion,
      partner_id: UC_ASSESSMENT_PARTNER_ID,
      potential_credit_points: result.potentialCreditPoints,
      published_cap: result.publishedCap,
      rules_version: result.versions.rulesVersion,
    })),
    { onConflict: "assessment_session_id,course_code" },
  );
  if (resultsError) {
    throw new AssessmentApiError(
      "ASSESSMENT_RESULT_SAVE_FAILED",
      "The trusted assessment result could not be saved.",
      503,
    );
  }

  const { error: updateError } = await admin
    .from("assessment_sessions")
    .update({
      completed_at: new Date().toISOString(),
      status: "evaluated",
      transcript_assessment: transcriptAssessment as unknown as Json,
    })
    .eq("id", session.id)
    .eq("owner_user_id", user.id);
  if (updateError) {
    throw new AssessmentApiError(
      "ASSESSMENT_SESSION_SAVE_FAILED",
      "The assessment session could not be completed.",
      503,
    );
  }

  await admin.from("assessment_reviews").upsert(
    {
      assessment_session_id: session.id,
      partner_id: UC_ASSESSMENT_PARTNER_ID,
      status: "unassigned",
    },
    { onConflict: "assessment_session_id", ignoreDuplicates: true },
  );
  await recordAssessmentAudit({
    action: "assessment_evaluated",
    actorUserId: user.id,
    admin,
    assessmentSessionId: session.id,
    metadata: {
      manualReviewCount: results.filter(
        (result) => result.potentialCreditPoints === null || result.confidence === "low",
      ).length,
      resultCount: results.length,
    },
    request,
    targetId: session.id,
    targetType: "assessment_session",
  });

  return assessmentJson({ documentId, results, transcriptAssessment });
}

export default assessmentHandler("/api/assessment/evaluate", handleEvaluate);
