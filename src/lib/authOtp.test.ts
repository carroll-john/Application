import { describe, expect, it, vi } from "vitest";
import {
  formatAuthConnectivityError,
  normalizeOtpCode,
  requestEmailOtp,
  verifyEmailOtpCode,
} from "./authOtp";

function createAuthMock() {
  return {
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("authOtp", () => {
  it("normalizes one-time codes to six numeric characters", () => {
    expect(normalizeOtpCode("12 34-56 extra")).toBe("123456");
  });

  it("requests an email OTP that can create a new user", async () => {
    const auth = createAuthMock();

    await expect(requestEmailOtp(auth, " User@Example.com ")).resolves.toEqual({
      error: null,
    });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("passes emailRedirectTo when a magic-link callback URL is provided", async () => {
    const auth = createAuthMock();

    await expect(
      requestEmailOtp(auth, "user@example.com", {
        emailRedirectTo:
          "http://localhost:5173/auth/callback?redirect=%2Fcourses%2FMBA",
      }),
    ).resolves.toEqual({ error: null });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          "http://localhost:5173/auth/callback?redirect=%2Fcourses%2FMBA",
      },
    });
  });

  it("verifies an email OTP with the expected Supabase payload", async () => {
    const auth = createAuthMock();

    await expect(
      verifyEmailOtpCode(auth, "User@Example.com", "123 456"),
    ).resolves.toEqual({ error: null });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("rejects invalid email and code values before calling Supabase", async () => {
    const auth = createAuthMock();

    await expect(requestEmailOtp(auth, "nope")).resolves.toEqual({
      error: "Enter a valid email address.",
    });
    await expect(
      verifyEmailOtpCode(auth, "user@example.com", "123"),
    ).resolves.toEqual({
      error: "Enter the 6-digit code from your email.",
    });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("returns a helpful message when the OTP request cannot reach Supabase", async () => {
    const auth = createAuthMock();
    auth.signInWithOtp.mockResolvedValue({
      error: new Error("Failed to fetch"),
    });

    await expect(requestEmailOtp(auth, "user@example.com")).resolves.toEqual({
      error:
        "We couldn't reach the sign-in service. Check your connection and try again.",
    });
  });

  it("returns a local Mailpit hint when local Supabase is unreachable", async () => {
    const auth = createAuthMock();
    auth.signInWithOtp.mockResolvedValue({
      error: new Error("Failed to fetch"),
    });

    await expect(
      requestEmailOtp(auth, "user@example.com", {
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).resolves.toEqual({
      error: formatAuthConnectivityError("http://127.0.0.1:54321"),
    });
  });

  it("returns a hosted-project hint when cloud Supabase is unreachable", async () => {
    const auth = createAuthMock();
    auth.verifyOtp.mockRejectedValue(new Error("fetch failed"));

    await expect(
      verifyEmailOtpCode(auth, "user@example.com", "123456", {
        supabaseUrl: "https://weyxnhykyyetquqprfnu.supabase.co",
      }),
    ).resolves.toEqual({
      error: formatAuthConnectivityError(
        "https://weyxnhykyyetquqprfnu.supabase.co",
      ),
    });
  });

  it("returns a helpful message when OTP verification cannot reach Supabase", async () => {
    const auth = createAuthMock();
    auth.verifyOtp.mockRejectedValue(new Error("fetch failed"));

    await expect(
      verifyEmailOtpCode(auth, "user@example.com", "123456"),
    ).resolves.toEqual({
      error:
        "We couldn't reach the sign-in service. Check your connection and try again.",
    });
  });
});
