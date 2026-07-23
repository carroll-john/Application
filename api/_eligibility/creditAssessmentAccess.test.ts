import { describe, expect, it } from "vitest";
import { getUcCreditAssessmentAccessError } from "./creditAssessmentAccess";

const ordinaryRequest = new Request(
  "https://example.test/api/evaluate-transcript-eligibility",
  { method: "POST" },
);
const creditRequest = new Request(
  "https://example.test/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
  { method: "POST" },
);

describe("UC credit assessment access", () => {
  it("requires an authenticated applicant for the UC credit flow", () => {
    expect(
      getUcCreditAssessmentAccessError("unauthenticated", creditRequest, true),
    ).toMatchObject({
      code: "UC_CREDIT_ASSESSMENT_UNAUTHORIZED",
      status: 401,
    });
  });

  it("allows the UC credit flow for an authenticated applicant", () => {
    expect(
      getUcCreditAssessmentAccessError("authenticated", creditRequest, true),
    ).toBeNull();
  });

  it("fails closed on deployed environments without auth configuration", () => {
    expect(getUcCreditAssessmentAccessError("open", creditRequest, true)).toMatchObject(
      {
        code: "UC_CREDIT_ASSESSMENT_NOT_CONFIGURED",
        status: 503,
      },
    );
  });

  it("does not change the existing transcript evidence route contract", () => {
    expect(
      getUcCreditAssessmentAccessError("unauthenticated", ordinaryRequest, true),
    ).toBeNull();
  });
});
