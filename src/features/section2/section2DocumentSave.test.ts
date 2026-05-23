import { describe, expect, it, vi } from "vitest";

const { saveDocumentAttachment } = vi.hoisted(() => ({
  saveDocumentAttachment: vi.fn(),
}));

vi.mock("../../lib/documentAttachment", () => ({
  saveDocumentAttachment,
}));

import { saveSection2DocumentRecord } from "./section2DocumentSave";

describe("saveSection2DocumentRecord", () => {
  it("reuses a provided application id for subsequent uploads", async () => {
    saveDocumentAttachment.mockResolvedValue({
      id: "doc-1",
      name: "transcript.pdf",
    });
    const ensureApplicationRow = vi.fn();

    await saveSection2DocumentRecord({
      applicationId: "app-123",
      currentDocument: undefined,
      ensureApplicationRow,
      kind: "tertiary_transcript",
      selectedFile: new File(["x"], "transcript.pdf"),
    });

    expect(ensureApplicationRow).not.toHaveBeenCalled();
    expect(saveDocumentAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "app-123" }),
    );
  });

  it("calls ensureApplicationRow when no application id is provided", async () => {
    saveDocumentAttachment.mockResolvedValue(undefined);
    const ensureApplicationRow = vi.fn().mockResolvedValue("app-456");

    await saveSection2DocumentRecord({
      ensureApplicationRow,
      kind: "cv",
      selectedFile: null,
    });

    expect(ensureApplicationRow).toHaveBeenCalledTimes(1);
  });
});
