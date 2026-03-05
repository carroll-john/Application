import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./authCallback";

describe("sanitizeRedirectPath", () => {
  it("keeps internal application paths", () => {
    expect(sanitizeRedirectPath("/overview?from=sign-in")).toBe(
      "/overview?from=sign-in",
    );
    expect(sanitizeRedirectPath("/section1/basic-info#contact")).toBe(
      "/section1/basic-info#contact",
    );
  });

  it("falls back to root when redirect is missing", () => {
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath(null)).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
  });

  it("rejects unsafe redirect targets", () => {
    expect(sanitizeRedirectPath("https://example.com")).toBe("/");
    expect(sanitizeRedirectPath("//example.com")).toBe("/");
    expect(sanitizeRedirectPath("///example.com")).toBe("/");
    expect(sanitizeRedirectPath("overview")).toBe("/");
  });
});
