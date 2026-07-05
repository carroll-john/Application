import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildPasswordRecoveryCallbackUrl,
  buildPasswordResetRedirectUrl,
  buildRecoveryCallbackRedirectFromUrl,
  clearAuthErrorFromUrl,
  formatAuthUrlErrorMessage,
  hasPasswordRecoveryTokenInUrl,
  isPasswordRecoveryCallback,
  isPasswordRecoveryLanding,
  parseAuthErrorFromUrl,
  parseRecoveryTokenHashFromUrl,
  resolveAuthRedirectPath,
  sanitizeRedirectPath,
  shouldTreatSessionAsPasswordRecovery,
  withoutAuthErrorParams,
  withoutPasswordRecoveryQuery,
  withoutRecoveryTokenHashParams,
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

describe("buildPasswordRecoveryCallbackUrl", () => {
  it("builds an auth callback URL for password recovery emails", () => {
    expect(
      buildPasswordRecoveryCallbackUrl(
        "https://application-prototype.vercel.app",
        "/dashboard",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard",
    );
  });
});

describe("parseRecoveryTokenHashFromUrl", () => {
  it("detects recovery token_hash query params", () => {
    expect(
      parseRecoveryTokenHashFromUrl(
        "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toEqual({ tokenHash: "abc123" });
  });

  it("returns null without token_hash or recovery type", () => {
    expect(
      parseRecoveryTokenHashFromUrl(
        "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard",
      ),
    ).toBeNull();
  });
});

describe("buildRecoveryCallbackRedirectFromUrl", () => {
  it("redirects token_hash recovery links from sign-in to auth/callback", () => {
    expect(
      buildRecoveryCallbackRedirectFromUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toBe(
      "/auth/callback?redirect=%2Fdashboard&token_hash=abc123&type=recovery",
    );
  });

  it("returns null when already on auth/callback", () => {
    expect(
      buildRecoveryCallbackRedirectFromUrl(
        "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toBeNull();
  });

  it("returns null without a recovery token_hash", () => {
    expect(
      buildRecoveryCallbackRedirectFromUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBeNull();
  });
});

describe("withoutRecoveryTokenHashParams", () => {
  it("strips token_hash and type from the callback URL", () => {
    expect(
      withoutRecoveryTokenHashParams(
        "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/auth/callback?redirect=%2Fdashboard",
    );
  });
});

describe("buildPasswordResetRedirectUrl", () => {
  it("builds a sign-in URL with the recovery flag and redirect", () => {
    expect(
      buildPasswordResetRedirectUrl(
        "https://application-prototype.vercel.app",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2F",
    );
  });

  it("preserves the intended in-app redirect path", () => {
    expect(
      buildPasswordResetRedirectUrl(
        "https://application-prototype.vercel.app",
        "/courses/MBA?apply=1",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fcourses%2FMBA%3Fapply%3D1",
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

  it("ignores unverified token_hash query params", () => {
    expect(
      hasPasswordRecoveryTokenInUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toBe(false);
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

describe("isPasswordRecoveryLanding", () => {
  it("detects the recovery landing query flag", () => {
    expect(
      isPasswordRecoveryLanding(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBe(true);
  });

  it("returns false without the recovery landing flag", () => {
    expect(
      isPasswordRecoveryLanding(
        "https://application-prototype.vercel.app/sign-in?redirect=%2Fdashboard",
      ),
    ).toBe(false);
  });
});

describe("shouldTreatSessionAsPasswordRecovery", () => {
  const session = { user: { id: "user-1" } };

  it("treats recovery tokens in the URL as active recovery", () => {
    expect(
      shouldTreatSessionAsPasswordRecovery(
        null,
        "https://application-prototype.vercel.app/sign-in#access_token=abc&type=recovery",
      ),
    ).toBe(true);
  });

  it("ignores unverified token_hash links without a session", () => {
    expect(
      shouldTreatSessionAsPasswordRecovery(
        null,
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard&token_hash=abc123&type=recovery",
      ),
    ).toBe(false);
  });

  it("treats recovery landing plus session as active recovery", () => {
    expect(
      shouldTreatSessionAsPasswordRecovery(
        session,
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBe(true);
  });

  it("ignores recovery landing without a session", () => {
    expect(
      shouldTreatSessionAsPasswordRecovery(
        null,
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBe(false);
  });

  it("ignores normal authenticated sign-in URLs", () => {
    expect(
      shouldTreatSessionAsPasswordRecovery(
        session,
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

describe("parseAuthErrorFromUrl", () => {
  it("detects auth errors in the URL hash", () => {
    expect(
      parseAuthErrorFromUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
      ),
    ).toEqual({
      error: "access_denied",
      errorCode: "otp_expired",
      errorDescription: "Email link is invalid or has expired",
    });
  });

  it("detects auth errors in the query string", () => {
    expect(
      parseAuthErrorFromUrl(
        "https://application-prototype.vercel.app/sign-in?error=access_denied&error_code=otp_expired",
      ),
    ).toEqual({
      error: "access_denied",
      errorCode: "otp_expired",
      errorDescription: null,
    });
  });

  it("returns null when no auth error params are present", () => {
    expect(
      parseAuthErrorFromUrl(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard",
      ),
    ).toBeNull();
  });
});

describe("formatAuthUrlErrorMessage", () => {
  it("maps otp_expired to a reset-specific message", () => {
    expect(
      formatAuthUrlErrorMessage({
        error: "access_denied",
        errorCode: "otp_expired",
        errorDescription: "Email link is invalid or has expired",
      }),
    ).toContain("This reset link has expired or was already used.");
  });

  it("falls back to the error description when code is unknown", () => {
    expect(
      formatAuthUrlErrorMessage({
        error: "access_denied",
        errorCode: "unexpected",
        errorDescription: "Something went wrong",
      }),
    ).toBe("Something went wrong");
  });
});

describe("withoutAuthErrorParams", () => {
  it("strips auth error params from the hash and recovery landing flag", () => {
    expect(
      withoutAuthErrorParams(
        "https://application-prototype.vercel.app/sign-in?recovery=1&redirect=%2Fdashboard#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?redirect=%2Fdashboard",
    );
  });

  it("preserves unrelated query params", () => {
    expect(
      withoutAuthErrorParams(
        "https://application-prototype.vercel.app/sign-in?redirect=%2Fprofile&error=access_denied",
      ),
    ).toBe(
      "https://application-prototype.vercel.app/sign-in?redirect=%2Fprofile",
    );
  });
});

describe("clearAuthErrorFromUrl", () => {
  it("is exported for AuthPanel URL cleanup", () => {
    expect(typeof clearAuthErrorFromUrl).toBe("function");
  });
});
