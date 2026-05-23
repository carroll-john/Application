import { describe, expect, it } from "vitest";
import { documentParserRegistry, getDocumentParserConfig } from "./documentParserRegistry";

describe("documentParserRegistry", () => {
  it("registers the cv kind", () => {
    expect(getDocumentParserConfig("cv")).toBe(documentParserRegistry.cv);
    expect(documentParserRegistry.cv.apiPath).toBe("/api/parse-cv");
  });

  it("normalizes cv parser payloads into employment experiences", () => {
    const draft = documentParserRegistry.cv.normalizeResponse({
      experiences: [
        {
          company: "Acme",
          position: "Engineer",
          duties: "Built things",
          startMonth: "January",
          startYear: "2020",
        },
      ],
      model: "gpt-4.1-mini",
    });

    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0]).toMatchObject({
      company: "Acme",
      position: "Engineer",
    });
    expect(draft.model).toBe("gpt-4.1-mini");
  });
});
