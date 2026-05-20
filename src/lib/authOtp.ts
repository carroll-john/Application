import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

type AuthClient = Pick<SupabaseClient<Database>["auth"], "signInWithOtp" | "verifyOtp">;

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-in service. Check your connection and try again.";

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeOtpCode(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function isValidEmailAddress(email: string) {
  return /^\S+@\S+\.\S+$/.test(normalizeAuthEmail(email));
}

function getErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
}

function isFetchFailure(message: string) {
  return /failed to fetch|fetch failed|networkerror/i.test(message);
}

function formatAuthRequestError(error: unknown) {
  const message = getErrorMessage(error);

  if (!message) {
    return null;
  }

  return isFetchFailure(message) ? AUTH_SERVICE_UNAVAILABLE_MESSAGE : message;
}

function formatAuthVerificationError(error: unknown) {
  const message = getErrorMessage(error);

  if (!message) {
    return null;
  }

  if (isFetchFailure(message)) {
    return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  }

  return "That code is invalid or expired. Request a new code and try again.";
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

  try {
    const { error } = await auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });

    return { error: formatAuthRequestError(error) };
  } catch (error) {
    return { error: formatAuthRequestError(error) };
  }
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

  try {
    const { error } = await auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: "email",
    });

    return { error: formatAuthVerificationError(error) };
  } catch (error) {
    return { error: formatAuthVerificationError(error) };
  }
}
