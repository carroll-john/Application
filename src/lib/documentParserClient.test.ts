import { describe, expect, it } from "vitest";
import { DocumentParserRequestError, requestParseDocument } from "./documentParserClient";

describe("requestParseDocument", () => {
  it("throws a typed error for unregistered document kinds", async () => {
    await expect(
      requestParseDocument(
        new File(["x"], "doc.pdf"),
        "tertiary_transcript" as "cv",
      ),
    ).rejects.toMatchObject({
      name: "DocumentParserRequestError",
      code: "DOCUMENT_PARSER_UNKNOWN_KIND",
    });
  });

  it("uses DocumentParserRequestError for parser failures", () => {
    const error = new DocumentParserRequestError("failed", 502, "CV_PARSER_UPSTREAM_FAILED");
    expect(error).toBeInstanceOf(DocumentParserRequestError);
    expect(error.status).toBe(502);
  });
});
