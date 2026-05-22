import { describe, expect, it, vi } from "vitest";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  formatAuthConnectivityError,
  signInWithPassword,
  signUpWithPassword,
} from "./authPassword";

function createAuthMock() {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
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
    ).resolves.toEqual({ error: null });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
      options: {
        emailRedirectTo:
          "https://application-prototype.vercel.app/auth/callback?redirect=%2F",
      },
    });
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

  it("maps invalid credentials to a generic message", async () => {
    const auth = createAuthMock();
    auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    await expect(
      signInWithPassword(auth, "user@example.com", "wrong-password"),
    ).resolves.toEqual({
      error: "Email or password is incorrect.",
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
