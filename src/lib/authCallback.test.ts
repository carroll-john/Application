import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildPasswordResetRedirectUrl,
  clearPasswordRecoveryQueryFromUrl,
  hasPasswordRecoveryTokenInUrl,
  isPasswordRecoveryCallback,
  resolveAuthRedirectPath,
  sanitizeRedirectPath,
  withoutPasswordRecoveryQuery,
} from "./authCallback";

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

describe("resolveAuthRedirectPath", () => {
  it("prefers an explicit redirect query param", () => {
    expect(
      resolveAuthRedirectPath({
        pathname: "/sign-in",
        search: "?redirect=%2Fcourses%2FMBA",
      }),
    ).toBe("/courses/MBA");
  });

  it("uses the current route for auth modals on course pages", () => {
    expect(
      resolveAuthRedirectPath({
        pathname: "/courses/MBA",
        search: "?apply=1&eligible=1",
      }),
    ).toBe("/courses/MBA?apply=1&eligible=1");
  });

  it("falls back to home from auth-only routes", () => {
    expect(
      resolveAuthRedirectPath({
        pathname: "/sign-in",
        search: "",
      }),
    ).toBe("/");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds a callback URL with a sanitized redirect param", () => {
    expect(
      buildAuthCallbackUrl(
        "https://application-prototype.vercel.app",
        "/courses/MBA?apply=1",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/auth/callback?redirect=%2Fcourses%2FMBA%3Fapply%3D1",
    );
  });
});

describe("buildPasswordResetRedirectUrl", () => {
  it("builds a sign-in URL with the recovery flag", () => {
    expect(
      buildPasswordResetRedirectUrl(
        "https://application-prototype.vercel.app",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?recovery=1",
    );
  });
});

describe("hasPasswordRecoveryTokenInUrl", () => {
  it("detects recovery tokens in the URL hash", () => {
    expect(
      hasPasswordRecoveryTokenInUrl(
        "https://application-prototype.vercel.app/sign-in#access_token=abc&type=recovery",
      ),
    ).toBe(true);
  });

  it("detects recovery tokens in the query string", () => {
    expect(
      hasPasswordRecoveryTokenInUrl(
        "https://application-prototype.vercel.app/sign-in?type=recovery&access_token=abc",
      ),
    ).toBe(true);
  });

  it("ignores the recovery landing flag without a recovery token", () => {
    expect(
      hasPasswordRecoveryTokenInUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1",
      ),
    ).toBe(false);
  });

  it("returns false for normal sign-in URLs", () => {
    expect(
      hasPasswordRecoveryTokenInUrl(
        "https://application-prototype.vercel.app/sign-in?redirect=%2Fprofile",
      ),
    ).toBe(false);
  });
});

describe("isPasswordRecoveryCallback", () => {
  it("matches recovery token detection", () => {
    expect(
      isPasswordRecoveryCallback(
        "https://application-prototype.vercel.app/sign-in#access_token=abc&type=recovery",
      ),
    ).toBe(true);
  });
});

describe("clearPasswordRecoveryQueryFromUrl", () => {
  it("removes the recovery landing flag from the URL", () => {
    expect(
      withoutPasswordRecoveryQuery(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?redirect=%2Fdashboard",
    );
  });
});
