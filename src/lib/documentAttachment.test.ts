import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSubmissionReadyDocument,
  saveDocumentAttachment,
} from "./documentAttachment";
import type { UploadedDocument } from "./documentStorage";

const { replaceStoredDocument, deleteStoredDocument } = vi.hoisted(() => ({
  replaceStoredDocument: vi.fn(),
  deleteStoredDocument: vi.fn(),
}));

vi.mock("./documentStorage", () => ({
  replaceStoredDocument,
  deleteStoredDocument,
}));

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

describe("saveDocumentAttachment", () => {
  afterEach(() => {
    replaceStoredDocument.mockReset();
    deleteStoredDocument.mockReset();
  });

  const baseDocument: UploadedDocument = {
    id: "doc-1",
    name: "file.pdf",
    size: 100,
    type: "application/pdf",
    lastModified: 0,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    source: "local",
  };

  it("replaces the stored document when a new file is selected", async () => {
    const nextDocument = { ...baseDocument, id: "doc-2" };
    const selectedFile = new File(["content"], "file.pdf", {
      type: "application/pdf",
    });
    replaceStoredDocument.mockResolvedValue(nextDocument);

    const result = await saveDocumentAttachment({
      applicationId: "app-1",
      currentDocument: baseDocument,
      kind: "accreditation_document",
      originalDocument: baseDocument,
      selectedFile,
    });

    expect(replaceStoredDocument).toHaveBeenCalledWith(
      selectedFile,
      baseDocument,
      { applicationId: "app-1", kind: "accreditation_document" },
    );
    expect(deleteStoredDocument).not.toHaveBeenCalled();
    expect(result).toBe(nextDocument);
  });

  it("deletes the original document when the attachment is cleared", async () => {
    deleteStoredDocument.mockResolvedValue(undefined);

    const result = await saveDocumentAttachment({
      applicationId: "app-1",
      currentDocument: undefined,
      kind: "cv",
      originalDocument: baseDocument,
      selectedFile: null,
    });

    expect(deleteStoredDocument).toHaveBeenCalledWith(baseDocument);
    expect(replaceStoredDocument).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("returns the current document when nothing changed", async () => {
    const result = await saveDocumentAttachment({
      applicationId: "app-1",
      currentDocument: baseDocument,
      kind: "tertiary_transcript",
      originalDocument: baseDocument,
      selectedFile: null,
    });

    expect(replaceStoredDocument).not.toHaveBeenCalled();
    expect(deleteStoredDocument).not.toHaveBeenCalled();
    expect(result).toBe(baseDocument);
  });
});
