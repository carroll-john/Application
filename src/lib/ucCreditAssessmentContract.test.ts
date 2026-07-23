import { describe, expect, it } from "vitest";
import {
  addUcCreditAssessmentFlow,
  isUcCreditAssessmentRequest,
} from "./ucCreditAssessmentContract";

describe("UC credit assessment request contract", () => {
  it("adds the authenticated assessment flow marker", () => {
    expect(addUcCreditAssessmentFlow("/api/evaluate-transcript-eligibility")).toBe(
      "/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
    );
  });

  it("recognises only the UC credit assessment flow", () => {
    expect(
      isUcCreditAssessmentRequest(
        new Request(
          "https://example.test/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
        ),
      ),
    ).toBe(true);
    expect(
      isUcCreditAssessmentRequest(
        new Request("https://example.test/api/evaluate-transcript-eligibility"),
      ),
    ).toBe(false);
  });
});
