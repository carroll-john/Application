import { describe, expect, it } from "vitest";
import { createReviewReturnState } from "./useReviewReturn";

describe("createReviewReturnState", () => {
  it("returns normal wizard labels when not editing from review", () => {
    const state = createReviewReturnState(false);

    expect(state.fromReview).toBe(false);
    expect(state.previousLabel).toBe("Previous");
    expect(state.reviewSuffix).toBe("");
    expect(state.returnPath("/section2/qualifications")).toBe(
      "/section2/qualifications",
    );
  });

  it("returns review edit labels and routes back to review", () => {
    const state = createReviewReturnState(true);

    expect(state.fromReview).toBe(true);
    expect(state.previousLabel).toBe("Cancel");
    expect(state.reviewSuffix).toBe("?from=review");
    expect(state.returnPath("/section2/qualifications")).toBe("/review");
  });
});
