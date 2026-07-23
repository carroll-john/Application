import { describe, expect, it } from "vitest";
import { getCvParserAccessError } from "./cvParserAccess";

const ordinaryRequest = new Request("https://example.test/api/parse-cv", {
  method: "POST",
});
const ucPreApplicationRequest = new Request(
  "https://example.test/api/parse-cv?flow=uc-pre-application",
  { method: "POST" },
);

describe("CV parser access", () => {
  it("allows the anonymous UC pre-application assessment", () => {
    expect(
      getCvParserAccessError(
        "unauthenticated",
        ucPreApplicationRequest,
        true,
      ),
    ).toBeNull();
  });

  it("keeps ordinary anonymous parser requests behind authentication", () => {
    expect(
      getCvParserAccessError("unauthenticated", ordinaryRequest, true),
    ).toBe("CV_PARSER_UNAUTHORIZED");
  });

  it("allows ordinary parsing for an authenticated applicant", () => {
    expect(
      getCvParserAccessError("authenticated", ordinaryRequest, true),
    ).toBeNull();
  });

  it("still requires auth configuration for ordinary deployed parsing", () => {
    expect(getCvParserAccessError("open", ordinaryRequest, true)).toBe(
      "CV_PARSER_NOT_CONFIGURED",
    );
    expect(
      getCvParserAccessError("open", ucPreApplicationRequest, true),
    ).toBeNull();
  });
});
