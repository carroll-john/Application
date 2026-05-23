import { describe, expect, it } from "vitest";
import { inferDocumentMimeType, isSupportedDocumentFileName } from "./documentMime";

describe("inferDocumentMimeType", () => {
  it("keeps a supported browser-provided MIME type", () => {
    expect(
      inferDocumentMimeType({
        name: "cv.pdf",
        type: "application/pdf",
      }),
    ).toBe("application/pdf");
  });

  it("infers PDF from the filename when the browser type is empty", () => {
    expect(
      inferDocumentMimeType({
        name: "resume.pdf",
        type: "",
      }),
    ).toBe("application/pdf");
  });

  it("infers DOCX from the filename when the browser type is octet-stream", () => {
    expect(
      inferDocumentMimeType({
        name: "resume.docx",
        type: "application/octet-stream",
      }),
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("infers legacy DOC and plain text from the filename", () => {
    expect(
      inferDocumentMimeType({
        name: "resume.doc",
        type: "",
      }),
    ).toBe("application/msword");

    expect(
      inferDocumentMimeType({
        name: "notes.txt",
        type: "",
      }),
    ).toBe("text/plain");
  });
});

describe("isSupportedDocumentFileName", () => {
  it("accepts supported extensions", () => {
    expect(isSupportedDocumentFileName("cv.pdf")).toBe(true);
    expect(isSupportedDocumentFileName("cv.DOCX")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    expect(isSupportedDocumentFileName("cv.png")).toBe(false);
  });
});
