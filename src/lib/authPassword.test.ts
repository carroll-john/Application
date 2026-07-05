import { describe, expect, it, vi } from "vitest";
import {
  AUTH_LEAKED_PASSWORD_MESSAGE,
  AUTH_MIN_PASSWORD_LENGTH,
  formatAuthConnectivityError,
  requestPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  updatePasswordAfterRecovery,
  validatePasswordPair,
  validateSignUpForm,
} from "./authPassword";

function createAuthMock() {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-id", identities: [{ provider: "email" }] } },
      error: null,
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("authPassword", () => {
  it("signs in with normalized email and password", async () => {
    const auth = createAuthMock();

    await expect(
      signInWithPassword(auth, " User@Example.com ", "secret123"),
    ).resolves.toEqual({ error: null });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
    });
  });

  it("signs up with email redirect when provided", async () => {
    const auth = createAuthMock();

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123", {
        emailRedirectTo:
          "https://application-prototype.vercel.app/auth/callback?redirect=%2F",
      }),
    ).resolves.toEqual({
      error: null,
      outcome: "confirmation_sent",
      userId: "test-user-id",
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
      options: {
        emailRedirectTo:
          "https://application-prototype.vercel.app/auth/callback?redirect=%2F",
      },
    });
  });

  it("detects repeated sign-up responses that do not send email", async () => {
    const auth = createAuthMock();
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    });

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123"),
    ).resolves.toEqual({
      error:
        "An account with this email already exists. Switch to Sign in instead.",
      outcome: "existing_account",
    });
  });

  it("treats sign-up responses with missing identities as existing accounts", async () => {
    const auth = createAuthMock();
    auth.signUp.mockResolvedValue({
      data: { user: { id: "existing-user-id" } },
      error: null,
    });

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123"),
    ).resolves.toEqual({
      error:
        "An account with this email already exists. Switch to Sign in instead.",
      outcome: "existing_account",
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
      options: undefined,
    });
  });

  it("normalizes email casing before sign-up so duplicates cannot bypass checks", async () => {
    const auth = createAuthMock();

    await signUpWithPassword(auth, " User@Example.com ", "secret123");
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
    );
  });

  it("validates matching password pairs", () => {
    expect(validatePasswordPair("secret123", "secret123")).toBeNull();
    expect(validatePasswordPair("123", "123")).toMatch(/at least/i);
    expect(validatePasswordPair("secret123", "different")).toMatch(/do not match/i);
  });

  it("validates sign-up form input before calling Supabase", () => {
    expect(validateSignUpForm("user@example.com", "secret123", "secret123")).toBeNull();
    expect(validateSignUpForm("bad-email", "secret123", "secret123")).toMatch(
      /valid email/i,
    );
  });

  it("rejects invalid email and short passwords before calling Supabase", async () => {
    const auth = createAuthMock();

    await expect(signInWithPassword(auth, "nope", "secret123")).resolves.toEqual(
      { error: "Enter a valid email address." },
    );
    await expect(
      signUpWithPassword(auth, "user@example.com", "123"),
    ).resolves.toEqual({
      error: `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`,
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("maps invalid credentials to a helpful message", async () => {
    const auth = createAuthMock();
    auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    await expect(
      signInWithPassword(auth, "user@example.com", "wrong-password"),
    ).resolves.toEqual({
      error:
        "Email or password is incorrect. If you previously signed in with email codes, use Forgot password to set one.",
    });
  });

  it("maps unconfirmed email errors to a confirmation prompt", async () => {
    const auth = createAuthMock();
    auth.signInWithPassword.mockResolvedValue({
      error: { message: "Email not confirmed" },
    });

    await expect(
      signInWithPassword(auth, "user@example.com", "secret123"),
    ).resolves.toEqual({
      error:
        "Confirm your email before signing in. Check your inbox for the confirmation link.",
    });
  });

  it("maps duplicate sign-up errors to a sign-in prompt", async () => {
    const auth = createAuthMock();
    auth.signUp.mockResolvedValue({
      error: { message: "User already registered" },
    });

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123"),
    ).resolves.toEqual({
      error: "An account with this email already exists. Sign in instead.",
    });
  });

  it("blocks sign-up with a leaked password before calling Supabase", async () => {
    const auth = createAuthMock();
    const checkLeakedPassword = vi.fn().mockResolvedValue(true);

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123", {
        checkLeakedPassword,
      }),
    ).resolves.toEqual({ error: AUTH_LEAKED_PASSWORD_MESSAGE });
    expect(checkLeakedPassword).toHaveBeenCalledWith("secret123");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("allows sign-up when the leaked-password check passes", async () => {
    const auth = createAuthMock();
    const checkLeakedPassword = vi.fn().mockResolvedValue(false);

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123", {
        checkLeakedPassword,
      }),
    ).resolves.toEqual({
      error: null,
      outcome: "confirmation_sent",
      userId: "test-user-id",
    });
    expect(auth.signUp).toHaveBeenCalled();
  });

  it("fails open and signs up when the leaked-password check throws", async () => {
    const auth = createAuthMock();
    const checkLeakedPassword = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123", {
        checkLeakedPassword,
      }),
    ).resolves.toEqual({
      error: null,
      outcome: "confirmation_sent",
      userId: "test-user-id",
    });
    expect(auth.signUp).toHaveBeenCalled();
  });

  it("blocks a leaked password during password recovery", async () => {
    const auth = createAuthMock();
    const checkLeakedPassword = vi.fn().mockResolvedValue(true);

    await expect(
      updatePasswordAfterRecovery(auth, "secret123", { checkLeakedPassword }),
    ).resolves.toEqual({ error: AUTH_LEAKED_PASSWORD_MESSAGE });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("requests a password reset with redirect URL", async () => {
    const auth = createAuthMock();

    await expect(
      requestPasswordReset(auth, "user@example.com", {
        redirectTo:
          "https://application-prototype.vercel.app/auth/callback?redirect=%2Fprofile",
      }),
    ).resolves.toEqual({ error: null });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo:
        "https://application-prototype.vercel.app/auth/callback?redirect=%2Fprofile",
    });
  });

  it("updates the password after recovery", async () => {
    const auth = createAuthMock();

    await expect(
      updatePasswordAfterRecovery(auth, "secret123"),
    ).resolves.toEqual({ error: null });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "secret123" });
  });

  it("returns a helpful message when auth cannot reach Supabase", async () => {
    const auth = createAuthMock();
    auth.signInWithPassword.mockResolvedValue({
      error: new Error("Failed to fetch"),
    });

    await expect(
      signInWithPassword(auth, "user@example.com", "secret123"),
    ).resolves.toEqual({
      error:
        "We couldn't reach the sign-in service. Check your connection and try again.",
    });
  });

  it("returns a local Mailpit hint when local Supabase is unreachable", async () => {
    const auth = createAuthMock();
    auth.signUp.mockResolvedValue({
      error: new Error("Failed to fetch"),
    });

    await expect(
      signUpWithPassword(auth, "user@example.com", "secret123", {
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).resolves.toEqual({
      error: formatAuthConnectivityError("http://127.0.0.1:54321"),
    });
  });
});
