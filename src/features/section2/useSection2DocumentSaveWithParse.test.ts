import { describe, expect, it, vi } from "vitest";
import { createCvDocumentParsePolicy } from "./cvDocumentParsePolicy";

describe("createCvDocumentParsePolicy", () => {
  const policy = createCvDocumentParsePolicy({
    replaceEmploymentExperiences: vi.fn(),
  });

  it("parses when a new file is selected", () => {
    const file = new File(["cv"], "cv.pdf", { type: "application/pdf" });

    expect(
      policy.shouldParse({
        currentDocument: undefined,
        employmentExperiences: [],
        originalDocument: undefined,
        selectedFile: file,
      }),
    ).toBe(true);
  });

  it("still parses when employment history already exists", () => {
    const file = new File(["cv"], "cv.pdf", { type: "application/pdf" });

    expect(
      policy.shouldParse({
        currentDocument: undefined,
        employmentExperiences: [
          {
            id: "exp-1",
            company: "Acme",
            currentRole: false,
            duties: "",
            endMonth: "",
            endYear: "",
            position: "Engineer",
            startMonth: "January",
            startYear: "2020",
            type: "Full-time",
          },
        ],
        originalDocument: undefined,
        selectedFile: file,
      }),
    ).toBe(true);
  });

  it("skips parsing when the same file was already parsed on upload", () => {
    const file = new File(["cv"], "cv.pdf", { type: "application/pdf" });

    expect(
      policy.shouldParse({
        currentDocument: undefined,
        employmentExperiences: [],
        hasParsedCvFile: () => true,
        originalDocument: undefined,
        selectedFile: file,
      }),
    ).toBe(false);
  });

  it("detects document changes from selection or removal", () => {
    const file = new File(["cv"], "cv.pdf", { type: "application/pdf" });

    expect(
      policy.hasDocumentChanges({
        currentDocument: undefined,
        employmentExperiences: [],
        originalDocument: undefined,
        selectedFile: file,
      }),
    ).toBe(true);

    expect(
      policy.hasDocumentChanges({
        currentDocument: undefined,
        employmentExperiences: [],
        originalDocument: { id: "doc-1" } as never,
        selectedFile: null,
      }),
    ).toBe(true);
  });

  it("builds a warning flash message when parse fails", () => {
    const message = policy.buildFlashMessage({
      context: {
        currentDocument: undefined,
        employmentExperiences: [],
        originalDocument: undefined,
        selectedFile: new File(["cv"], "cv.pdf"),
      },
      parseError: new Error("parse failed"),
    });

    expect(message?.type).toBe("warning");
    expect(message?.message).toContain("auto-fill");
  });
});
