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
});
