import { describe, expect, it } from "vitest";
import { getTranscriptEligibilityAccessError } from "./transcriptEligibilityAccess";

const ordinaryRequest = new Request(
  "https://example.test/api/evaluate-transcript-eligibility",
  { method: "POST" },
);
const creditRequest = new Request(
  "https://example.test/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
  { method: "POST" },
);

describe("transcript eligibility access", () => {
  it("requires an authenticated applicant for ordinary transcript evidence", () => {
    expect(
      getTranscriptEligibilityAccessError(
        "unauthenticated",
        ordinaryRequest,
        true,
      ),
    ).toMatchObject({ code: "ELIGIBILITY_UNAUTHORIZED", status: 401 });
  });

  it("keeps the established UC credit-assessment error contract", () => {
    expect(
      getTranscriptEligibilityAccessError(
        "unauthenticated",
        creditRequest,
        true,
      ),
    ).toMatchObject({
      code: "UC_CREDIT_ASSESSMENT_UNAUTHORIZED",
      status: 401,
    });
  });

  it("allows both flows for an authenticated applicant", () => {
    expect(
      getTranscriptEligibilityAccessError(
        "authenticated",
        ordinaryRequest,
        true,
      ),
    ).toBeNull();
    expect(
      getTranscriptEligibilityAccessError(
        "authenticated",
        creditRequest,
        true,
      ),
    ).toBeNull();
  });

  it("fails closed on deployed environments without auth configuration", () => {
    expect(
      getTranscriptEligibilityAccessError("open", ordinaryRequest, true),
    ).toMatchObject({ code: "ELIGIBILITY_NOT_CONFIGURED", status: 503 });
    expect(
      getTranscriptEligibilityAccessError("open", creditRequest, true),
    ).toMatchObject({
      code: "UC_CREDIT_ASSESSMENT_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("retains open mode only for non-deployed local development", () => {
    expect(
      getTranscriptEligibilityAccessError("open", ordinaryRequest, false),
    ).toBeNull();
  });
});
