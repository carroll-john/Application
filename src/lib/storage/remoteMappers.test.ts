import { describe, expect, it } from "vitest";

import type { UploadedDocument } from "../documentStorage";
import {
  findEligibilityFeedbackDocument,
  getRemoteDocumentId,
  getRemoteUuid,
  mapEmploymentRow,
  mapLanguageTestRow,
  mapProfessionalAccreditationRow,
  mapRemoteDocument,
  mapSecondaryQualificationRow,
  mapTertiaryQualificationRow,
  resolveSelectedCourse,
  toEmploymentInsert,
  toLanguageTestInsert,
  toTertiaryInsert,
} from "./remoteMappers";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function remoteDoc(id: string): UploadedDocument {
  return {
    id,
    name: `${id}.pdf`,
    size: 10,
    type: "application/pdf",
    lastModified: 0,
    uploadedAt: "2026-01-01T00:00:00Z",
    source: "remote",
    storageBucket: "documents",
    storagePath: `path/${id}`,
  };
}

describe("getRemoteUuid", () => {
  it("returns the id when it is a valid v4 uuid", () => {
    expect(getRemoteUuid(VALID_UUID)).toBe(VALID_UUID);
  });

  it("returns undefined for local ids and undefined input", () => {
    expect(getRemoteUuid("local-123")).toBeUndefined();
    expect(getRemoteUuid(undefined)).toBeUndefined();
  });
});

describe("getRemoteDocumentId", () => {
  it("returns the id only for remote documents", () => {
    expect(getRemoteDocumentId(remoteDoc("doc-1"))).toBe("doc-1");
  });

  it("returns null for local or missing documents", () => {
    expect(getRemoteDocumentId({ ...remoteDoc("doc-2"), source: "local" })).toBeNull();
    expect(getRemoteDocumentId(undefined)).toBeNull();
  });
});

describe("resolveSelectedCourse", () => {
  it("prefers the row's explicit course fields", () => {
    expect(
      resolveSelectedCourse({
        course_code: "abc",
        course_title: "Master of Abc",
        intake_label: "March 2026",
      }),
    ).toMatchObject({
      code: "abc",
      title: "Master of Abc",
      intake: "March 2026",
    });
  });

  it("falls back to the default course when the row has no course data", () => {
    const resolved = resolveSelectedCourse({
      course_code: null,
      course_title: null,
      intake_label: null,
    });
    expect(resolved.code).toBeTruthy();
    expect(resolved.title).toBeTruthy();
    expect(resolved.provider).toBeTruthy();
    expect(resolved.intake).toBeTruthy();
  });
});

describe("row -> domain mappers", () => {
  it("maps a document row, defaulting lastModified to now", () => {
    const mapped = mapRemoteDocument({
      id: "doc-1",
      file_name: "cv.pdf",
      size_bytes: 42,
      mime_type: "application/pdf",
      created_at: "2026-01-02T00:00:00Z",
      storage_bucket: "documents",
      storage_path: "p/doc-1",
    });
    expect(mapped).toMatchObject({
      id: "doc-1",
      name: "cv.pdf",
      size: 42,
      type: "application/pdf",
      source: "remote",
      uploadedAt: "2026-01-02T00:00:00Z",
    });
    expect(typeof mapped.lastModified).toBe("number");
  });

  it("coerces null employment end dates to empty strings", () => {
    expect(
      mapEmploymentRow({
        company: "Acme",
        duties: "Things",
        employment_type: "Full-time",
        employer_letter_document_id: null,
        employer_letter_document_name: null,
        end_month: null,
        end_year: null,
        id: "emp-1",
        is_current_role: true,
        position: "Engineer",
        start_month: "January",
        start_year: "2020",
      }),
    ).toEqual({
      company: "Acme",
      currentRole: true,
      duties: "Things",
      endMonth: "",
      endYear: "",
      employerLetterDocument: undefined,
      employerLetterDocumentName: undefined,
      id: "emp-1",
      position: "Engineer",
      startMonth: "January",
      startYear: "2020",
      type: "Full-time",
    });
  });

  it("maps an employer letter onto its employment role", () => {
    const documentMap = new Map([["letter-1", remoteDoc("letter-1")]]);
    expect(mapEmploymentRow({
      company: "Acme",
      duties: "Led a team",
      employment_type: "Full-time",
      employer_letter_document_id: "letter-1",
      employer_letter_document_name: "confirmation.pdf",
      end_month: "December",
      end_year: "2023",
      id: "emp-1",
      is_current_role: false,
      position: "Manager",
      start_month: "January",
      start_year: "2021",
    }, documentMap)).toMatchObject({
      employerLetterDocument: remoteDoc("letter-1"),
      employerLetterDocumentName: "confirmation.pdf",
    });
  });

  it("resolves linked documents through the document map", () => {
    const documentMap = new Map([["doc-9", remoteDoc("doc-9")]]);
    const tertiary = mapTertiaryQualificationRow(
      {
        certificate_document_id: null,
        certificate_document_name: null,
        completed: true,
        country: "Australia",
        course_name: "BSc",
        end_month: "December",
        end_year: "2019",
        id: "tert-1",
        institution: "Uni",
        level: "Bachelor degree",
        start_month: "January",
        start_year: "2016",
        transcript_confirms_completion: true,
        transcript_document_id: "doc-9",
        transcript_document_name: "transcript.pdf",
        transcript_eligibility: {
          checkedAt: "2026-07-01T00:00:00Z",
          confidence: 0.9,
          outcome: "eligible",
          manualReviewRequired: false,
          missingInformation: [],
          recommendedNextStep: "No further transcript evidence is needed.",
          requirementsChecked: [
            {
              explanation: "Qualification appears completed based on supplied evidence.",
              id: "completion",
              reasonCode: "QUALIFICATION_COMPLETE",
              requirement: "Completed qualification",
              status: "pass",
            },
          ],
          rulesVersion: "rules-v2",
        },
      },
      documentMap,
    );
    expect(tertiary.transcriptDocument?.id).toBe("doc-9");
    expect(tertiary.certificateDocument).toBeUndefined();
    expect(tertiary.transcriptCompletionConfirmed).toBe(true);
    expect(tertiary.transcriptEligibility).toMatchObject({
      outcome: "eligible",
      rulesVersion: "rules-v2",
      requirementsChecked: [
        { id: "completion", reasonCode: "QUALIFICATION_COMPLETE", status: "pass" },
      ],
    });

    const language = mapLanguageTestRow(
      {
        completion_year: "2020",
        document_id: "missing",
        document_name: "ielts.pdf",
        id: "lang-1",
        listening_score: 6,
        overall_score: 6.5,
        reading_score: 6,
        speaking_score: 6,
        test_name: "IELTS",
        test_type: "English",
        writing_score: 6,
      },
      documentMap,
    );
    expect(language.document).toBeUndefined();
    expect(language.documentName).toBe("ielts.pdf");
    expect(language.overallScore).toBe("6.5");

    const accreditation = mapProfessionalAccreditationRow(
      {
        document_id: "doc-9",
        document_name: null,
        id: "acc-1",
        name: "CPA",
        status: "Completed",
      },
      documentMap,
    );
    expect(accreditation.document?.id).toBe("doc-9");

    const secondary = mapSecondaryQualificationRow({
      completion_year: "2014",
      country: "Australia",
      id: "sec-1",
      qualification_name: "HSC",
      qualification_type: "High school",
      school: "High",
      state: "NSW",
    });
    expect(secondary.qualification).toBe("HSC");
  });
});

describe("domain -> insert builders", () => {
  it("stamps the application id and drops non-uuid ids", () => {
    const insert = toEmploymentInsert("app-1", {
      company: "Acme",
      currentRole: false,
      duties: "Work",
      endMonth: "March",
      endYear: "2022",
      id: "local-emp",
      position: "Lead",
      startMonth: "January",
      startYear: "2020",
      type: "Full-time",
    });
    expect(insert.application_id).toBe("app-1");
    expect(insert.id).toBeUndefined();
    expect(insert.end_month).toBe("March");
  });

  it("keeps a valid uuid id and maps remote document references", () => {
    const insert = toTertiaryInsert("app-2", {
      certificateDocument: remoteDoc("cert-doc"),
      certificateDocumentName: "cert.pdf",
      completed: true,
      country: "Australia",
      courseName: "BSc",
      endMonth: "December",
      endYear: "2019",
      id: VALID_UUID,
      institution: "Uni",
      level: "Bachelor degree",
      startMonth: "January",
      startYear: "2016",
      transcriptDocument: undefined,
      transcriptDocumentName: undefined,
    });
    expect(insert.id).toBe(VALID_UUID);
    expect(insert.certificate_document_id).toBe("cert-doc");
    expect(insert.transcript_document_id).toBeNull();
    expect(insert.transcript_confirms_completion).toBe(false);
  });

  it("persists the transcript completion signal for the submit RPC", () => {
    const base = {
      certificateDocument: undefined,
      certificateDocumentName: undefined,
      completed: true,
      country: "Indonesia",
      courseName: "BEng",
      endMonth: "December",
      endYear: "2017",
      id: VALID_UUID,
      institution: "Universitas Indonesia",
      level: "Bachelor degree",
      startMonth: "January",
      startYear: "2014",
      transcriptDocument: undefined,
      transcriptDocumentName: undefined,
    };

    // Carried across reloads via the persisted snapshot.
    expect(
      toTertiaryInsert("app-4", { ...base, transcriptCompletionConfirmed: true })
        .transcript_confirms_completion,
    ).toBe(true);

    // Derived from a fresh in-memory transcript assessment.
    expect(
      toTertiaryInsert("app-4", {
        ...base,
        transcriptEligibility: {
          checkedAt: new Date().toISOString(),
          confidence: 0.9,
          extractedData: {
            studyDetails: {
              completionStatus: { confidence: 0.9, normalizedValue: "Completed" },
            },
          },
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "",
          requirementsChecked: [],
        },
      }).transcript_confirms_completion,
    ).toBe(true);

    expect(
      toTertiaryInsert("app-4", base).transcript_confirms_completion,
    ).toBe(false);
  });

  it("persists the full transcript assessment as jsonb", () => {
    const base = {
      certificateDocument: undefined,
      certificateDocumentName: undefined,
      completed: true,
      country: "Australia",
      courseName: "BIT",
      endMonth: "December",
      endYear: "2024",
      id: VALID_UUID,
      institution: "Uni",
      level: "Bachelor degree",
      startMonth: "February",
      startYear: "2022",
      transcriptDocument: undefined,
      transcriptDocumentName: undefined,
    };
    const assessment = {
      checkedAt: "2026-07-01T00:00:00Z",
      confidence: 0.85,
      extractedData: {},
      manualReviewRequired: false,
      missingInformation: [],
      outcome: "eligible" as const,
      recommendedNextStep: "No further transcript evidence is needed.",
      requirementsChecked: [],
      rulesVersion: "rules-v2",
    };

    expect(
      toTertiaryInsert("app-5", { ...base, transcriptEligibility: assessment })
        .transcript_eligibility,
    ).toMatchObject({ outcome: "eligible", rulesVersion: "rules-v2" });
    expect(toTertiaryInsert("app-5", base).transcript_eligibility).toBeNull();
  });

  it("maps language-test scores in the insert payload", () => {
    const insert = toLanguageTestInsert("app-3", {
      document: undefined,
      documentName: undefined,
      id: "local",
      listeningScore: "6",
      name: "TOEFL",
      overallScore: "7.5",
      readingScore: "6.5",
      speakingScore: "",
      type: "English",
      writingScore: "6",
      year: "2021",
    });
    expect(insert.application_id).toBe("app-3");
    expect(insert.document_id).toBeNull();
    expect(insert.document_name).toBeNull();
    expect(insert.overall_score).toBe(7.5);
    expect(insert.speaking_score).toBeNull();
  });
});

describe("findEligibilityFeedbackDocument", () => {
  it("returns the newest eligibility feedback document", () => {
    const document = findEligibilityFeedbackDocument([
      {
        created_at: "2026-07-05T09:00:00Z",
        file_name: "old.json",
        id: "doc-old",
        kind: "eligibility_feedback",
        mime_type: "application/json",
        size_bytes: 10,
        storage_bucket: "documents",
        storage_path: "path/old",
      },
      {
        created_at: "2026-07-05T10:00:00Z",
        file_name: "eligibility-feedback.json",
        id: "doc-new",
        kind: "eligibility_feedback",
        mime_type: "application/json",
        size_bytes: 20,
        storage_bucket: "documents",
        storage_path: "path/new",
      },
      {
        created_at: "2026-07-05T11:00:00Z",
        file_name: "cv.pdf",
        id: "doc-cv",
        kind: "cv",
        mime_type: "application/pdf",
        size_bytes: 30,
        storage_bucket: "documents",
        storage_path: "path/cv",
      },
    ]);

    expect(document?.id).toBe("doc-new");
    expect(document?.name).toBe("eligibility-feedback.json");
  });
});
