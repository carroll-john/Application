import { describe, expect, it } from "vitest";
import {
  DOCUMENT_UPLOAD_MAX_FILE_BYTES,
  DocumentUploadLimitError,
  assertDocumentUploadFileSize,
  getDocumentUploadErrorMessage,
  toDocumentUploadLimitError,
} from "./documentUploadLimits";

describe("assertDocumentUploadFileSize", () => {
  it("allows files at or below the configured max size", () => {
    expect(() =>
      assertDocumentUploadFileSize(DOCUMENT_UPLOAD_MAX_FILE_BYTES),
    ).not.toThrow();
  });

  it("throws a typed error when the size exceeds the max", () => {
    expect(() =>
      assertDocumentUploadFileSize(DOCUMENT_UPLOAD_MAX_FILE_BYTES + 1),
    ).toThrowError(DocumentUploadLimitError);
  });
});

describe("toDocumentUploadLimitError", () => {
  it("maps database file count limit errors", () => {
    const parsed = toDocumentUploadLimitError({
      details: "max_files=12",
      message: "UPLOAD_APP_FILE_COUNT_LIMIT",
    });

    expect(parsed?.code).toBe("UPLOAD_APP_FILE_COUNT_LIMIT");
    expect(parsed?.limit).toBe(12);
  });

  it("maps database total-bytes limit errors", () => {
    const parsed = toDocumentUploadLimitError({
      details: "max_bytes=10485760",
      message: "UPLOAD_APP_TOTAL_BYTES_LIMIT",
    });

    expect(parsed?.code).toBe("UPLOAD_APP_TOTAL_BYTES_LIMIT");
    expect(parsed?.limit).toBe(10485760);
  });

  it("maps database rate-limit errors", () => {
    const parsed = toDocumentUploadLimitError({
      details: "max_uploads=9;window_minutes=3",
      message: "UPLOAD_RATE_LIMIT",
    });

    expect(parsed?.code).toBe("UPLOAD_RATE_LIMIT");
    expect(parsed?.limit).toBe(9);
    expect(parsed?.windowMinutes).toBe(3);
  });

  it("maps generic upstream payload-too-large responses", () => {
    const parsed = toDocumentUploadLimitError({
      code: "413",
      message: "Payload too large",
    });

    expect(parsed?.code).toBe("UPLOAD_FILE_TOO_LARGE");
  });
});

describe("getDocumentUploadErrorMessage", () => {
  it("returns a friendly message for known limit errors", () => {
    const message = getDocumentUploadErrorMessage({
      details: "max_uploads=4;window_minutes=2",
      message: "UPLOAD_RATE_LIMIT",
    });

    expect(message).toContain("4 uploads per 2 minutes");
  });

  it("returns null for unrelated errors", () => {
    expect(getDocumentUploadErrorMessage(new Error("boom"))).toBeNull();
  });

  it("maps plain Error messages for known application save failures", () => {
    expect(
      getDocumentUploadErrorMessage(
        new Error("Unable to create an application record."),
      ),
    ).toContain("application record");
    expect(
      getDocumentUploadErrorMessage(new Error("No authenticated session is available.")),
    ).toBe("Sign in again before uploading.");
  });

  it("maps nested storage error payloads", () => {
    expect(
      getDocumentUploadErrorMessage({
        error: { message: "UPLOAD_APPLICATION_NOT_FOUND" },
        statusCode: "500",
      }),
    ).toContain("application record");
  });

  it("returns a friendly message for missing storage objects", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "DOCUMENT_STORAGE_OBJECT_MISSING",
      }),
    ).toBe("Upload didn't finish storing your file. Please try again.");
  });

  it("returns a friendly message for storage owner mismatch", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "UPLOAD_STORAGE_OWNER_MISMATCH",
      }),
    ).toBe("Session mismatch — sign out and back in, then retry.");
  });

  it("returns a friendly message for unsupported MIME types", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "mime type application/octet-stream is not allowed",
      }),
    ).toBe("This file type isn't supported. Use PDF, DOC, DOCX, or TXT.");
  });

  it("returns a friendly message for unauthorized uploads", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "JWT expired",
        statusCode: 401,
      }),
    ).toBe("Sign in again before uploading.");
  });

  it("returns a friendly message when the application record is missing", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "UPLOAD_APPLICATION_NOT_FOUND",
      }),
    ).toContain("application record");
  });

  it("returns a friendly message for invalid storage paths", () => {
    expect(
      getDocumentUploadErrorMessage({
        message: "UPLOAD_INVALID_STORAGE_PATH",
      }),
    ).toContain("upload path");
  });

  it("returns a friendly message when document metadata cannot link to the application", () => {
    expect(
      getDocumentUploadErrorMessage({
        code: "23503",
        message: 'insert or update on table "application_documents" violates foreign key constraint',
      }),
    ).toContain("link this upload to your application");
  });

  it("returns a friendly message for stale cv document references", () => {
    expect(
      getDocumentUploadErrorMessage({
        code: "23503",
        message:
          'insert or update on table "applications" violates foreign key constraint "applications_cv_document_id_fkey"',
      }),
    ).toContain("previous file reference is out of date");
  });

  it("asks the user to re-authenticate when the applicant profile owner FK fails", () => {
    expect(
      getDocumentUploadErrorMessage({
        code: "23503",
        message:
          'insert or update on table "applicant_profiles" violates foreign key constraint "applicant_profiles_owner_user_id_fkey"',
      }),
    ).toContain("session has expired");
  });
});
