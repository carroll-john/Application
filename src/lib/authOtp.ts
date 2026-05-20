import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

type AuthClient = Pick<SupabaseClient<Database>["auth"], "signInWithOtp" | "verifyOtp">;

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeOtpCode(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function isValidEmailAddress(email: string) {
  return /^\S+@\S+\.\S+$/.test(normalizeAuthEmail(email));
}

export async function requestEmailOtp(
  auth: AuthClient,
  email: string,
): Promise<{ error: string | null }> {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!normalizedEmail) {
    return { error: "Enter your email address." };
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  const { error } = await auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true },
  });

  return { error: error?.message ?? null };
}

export async function verifyEmailOtpCode(
  auth: AuthClient,
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const normalizedEmail = normalizeAuthEmail(email);
  const normalizedToken = normalizeOtpCode(token);

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (normalizedToken.length !== 6) {
    return { error: "Enter the 6-digit code from your email." };
  }

  const { error } = await auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });

  return {
    error: error?.message
      ? "That code is invalid or expired. Request a new code and try again."
      : null,
  };
}
