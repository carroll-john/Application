import { describe, expect, it } from "vitest";
import {
  isPostHogSensitiveRoute,
  sanitizeAnalyticsSearch,
  sanitizeAnalyticsUrl,
} from "./sanitizeAnalyticsUrl";

describe("sanitizeAnalyticsUrl", () => {
  it("strips URL hash fragments that may contain auth tokens", () => {
    const sanitized = sanitizeAnalyticsUrl(
      "https://app.example/auth/callback?redirect=%2F#access_token=secret&refresh_token=also-secret",
    );

    expect(sanitized).not.toContain("#");
    expect(sanitized).not.toContain("access_token");
    expect(sanitized).not.toContain("refresh_token");
    expect(sanitized).toContain("/auth/callback");
  });

  it("removes sensitive auth query parameters", () => {
    const sanitized = sanitizeAnalyticsUrl(
      "https://app.example/sign-in?redirect=%2F&access_token=abc&token=123",
    );

    expect(sanitized).toBe("https://app.example/sign-in?redirect=%2F");
  });

  it("strips the synthetic-test activation token (kp_synthetic)", () => {
    const sanitized = sanitizeAnalyticsUrl(
      "https://app.example/?kp_synthetic=long-random-secret&utm_source=x",
    );

    expect(sanitized).not.toContain("kp_synthetic");
    expect(sanitized).not.toContain("long-random-secret");
    expect(sanitized).toContain("utm_source=x");
  });
});

describe("sanitizeAnalyticsSearch", () => {
  it("removes sensitive query keys while preserving safe params", () => {
    expect(
      sanitizeAnalyticsSearch("?redirect=%2Foverview&access_token=secret"),
    ).toBe("?redirect=%2Foverview");
  });
});

describe("isPostHogSensitiveRoute", () => {
  it("blocks auth callback routes", () => {
    expect(isPostHogSensitiveRoute("/auth/callback")).toBe(true);
  });

  it("blocks sign-in when auth query params are present", () => {
    expect(isPostHogSensitiveRoute("/sign-in", "?access_token=secret")).toBe(true);
    expect(isPostHogSensitiveRoute("/sign-in", "?redirect=%2F")).toBe(false);
  });
});
