import { describe, expect, it, vi } from "vitest";
import {
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
});
