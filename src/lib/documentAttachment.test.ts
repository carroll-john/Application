import { describe, expect, it } from "vitest";
import { isSubmissionReadyDocument } from "./documentAttachment";
import type { UploadedDocument } from "./documentStorage";

describe("isSubmissionReadyDocument", () => {
  it("requires remote documents to include storage metadata", () => {
    expect(
      isSubmissionReadyDocument({
        id: "doc-1",
        name: "resume.pdf",
        size: 100,
        type: "application/pdf",
        lastModified: 0,
        uploadedAt: "2026-01-01T00:00:00.000Z",
        source: "remote",
      }),
    ).toBe(false);

    expect(
      isSubmissionReadyDocument({
        id: "doc-1",
        name: "resume.pdf",
        size: 100,
        type: "application/pdf",
        lastModified: 0,
        uploadedAt: "2026-01-01T00:00:00.000Z",
        source: "remote",
        storageBucket: "application-documents",
        storagePath: "user/app/cv/doc-1-resume.pdf",
      }),
    ).toBe(true);
  });

  it("accepts local documents with an id", () => {
    const localDocument: UploadedDocument = {
      id: "local-doc",
      name: "resume.pdf",
      size: 100,
      type: "application/pdf",
      lastModified: 0,
      uploadedAt: "2026-01-01T00:00:00.000Z",
      source: "local",
    };

    expect(isSubmissionReadyDocument(localDocument)).toBe(true);
  });
});
