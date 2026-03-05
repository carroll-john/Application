import { describe, expect, it } from "vitest";
import { isClarityPiiRoute, shouldExcludeClarityTraffic } from "./clarity";

describe("shouldExcludeClarityTraffic", () => {
  it("excludes webdriver sessions", () => {
    expect(
      shouldExcludeClarityTraffic({
        userAgent: "Mozilla/5.0",
        webdriver: true,
      }),
    ).toBe(true);
  });

  it("excludes known automation user agents", () => {
    expect(
      shouldExcludeClarityTraffic({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) HeadlessChrome/123.0.0.0 Safari/537.36",
      }),
    ).toBe(true);
  });

  it("excludes sessions with clarity opt-out query flag", () => {
    expect(
      shouldExcludeClarityTraffic({
        userAgent: "Mozilla/5.0",
        search: "?clarity=off",
      }),
    ).toBe(true);
  });

  it("keeps normal browser sessions enabled", () => {
    expect(
      shouldExcludeClarityTraffic({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        webdriver: false,
        search: "",
      }),
    ).toBe(false);
  });
});

describe("isClarityPiiRoute", () => {
  it("marks application routes as PII routes", () => {
    expect(isClarityPiiRoute("/section1/personal-contact")).toBe(true);
    expect(isClarityPiiRoute("/section2/add-cv")).toBe(true);
    expect(isClarityPiiRoute("/review")).toBe(true);
  });

  it("does not mark catalog routes as PII routes", () => {
    expect(isClarityPiiRoute("/")).toBe(false);
    expect(isClarityPiiRoute("/courses/mba")).toBe(false);
  });
});
