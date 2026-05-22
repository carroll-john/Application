import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isHostedSupabaseProjectUrl,
  isLocalSupabaseUrl,
  LOCAL_DEV_MAILPIT_URL,
} from "./supabaseConfig";
import type { Database } from "./supabase.types";

type AuthClient = Pick<SupabaseClient<Database>["auth"], "signInWithOtp" | "verifyOtp">;

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-in service. Check your connection and try again.";

export function formatAuthConnectivityError(
  supabaseUrl: string | null | undefined,
) {
  if (isLocalSupabaseUrl(supabaseUrl)) {
    return `We couldn't reach local Supabase. Run \`supabase start\`, then retry. Local OTP emails go to Mailpit at ${LOCAL_DEV_MAILPIT_URL}, not your real inbox.`;
  }

  if (isHostedSupabaseProjectUrl(supabaseUrl)) {
    return "We couldn't reach the hosted Supabase project. It may be paused or deleted — restore the Application project in the Supabase dashboard, then confirm Vercel uses the restored URL and anon key.";
  }

  return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
}

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

function parseRateLimitCooldownSeconds(message: string) {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

export const AUTH_OTP_MIN_RESEND_SECONDS = 60;

export function getAuthOtpRetryAfterSeconds(errorMessage: string | null | undefined) {
  if (!errorMessage) {
    return null;
  }

  return parseRateLimitCooldownSeconds(errorMessage);
}

export function formatAuthRateLimitError(message: string) {
  const cooldownSeconds = parseRateLimitCooldownSeconds(message);

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    return "Sign-in emails are rate-limited on the hosted Supabase project. Configure custom SMTP under Authentication → SMTP in the Supabase dashboard, then retry. Built-in Supabase email only allows a few auth messages per hour.";
  }

  if (cooldownSeconds && cooldownSeconds > 0) {
    return `Please wait ${cooldownSeconds} seconds before requesting another sign-in code.`;
  }

  if (/rate limit|too many requests|429/i.test(message)) {
    return `Please wait ${AUTH_OTP_MIN_RESEND_SECONDS} seconds before requesting another sign-in code.`;
  }

  return null;
}

function formatAuthRequestError(
  error: unknown,
  supabaseUrl?: string | null,
) {
  const message = getErrorMessage(error);

  if (!message) {
    return null;
  }

  if (isFetchFailure(message)) {
    return formatAuthConnectivityError(supabaseUrl);
  }

  return formatAuthRateLimitError(message) ?? message;
}

function formatAuthVerificationError(
  error: unknown,
  supabaseUrl?: string | null,
) {
  const message = getErrorMessage(error);

  if (!message) {
    return null;
  }

  if (isFetchFailure(message)) {
    return formatAuthConnectivityError(supabaseUrl);
  }

  if (/expired|invalid|otp/i.test(message)) {
    return "That code is invalid or expired. Request a new code and use the one from your most recent email.";
  }

  return "That code is invalid or expired. Request a new code and try again.";
}

async function verifyEmailOtpOnce(
  auth: AuthClient,
  email: string,
  token: string,
) {
  // signInWithOtp stores codes in recovery_token for returning users. GoTrue
  // accepts type "email" for 6-digit OTP entry against either confirmation or
  // recovery tokens. Retrying other types triggers a second /verify request,
  // which surfaced as immediate otp_expired failures in hosted auth logs.
  const { error } = await auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  return { error };
}

export async function requestEmailOtp(
  auth: AuthClient,
  email: string,
  options?: { supabaseUrl?: string | null },
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
      options: {
        shouldCreateUser: true,
      },
    });

    return { error: formatAuthRequestError(error, options?.supabaseUrl) };
  } catch (error) {
    return { error: formatAuthRequestError(error, options?.supabaseUrl) };
  }
}

export async function verifyEmailOtpCode(
  auth: AuthClient,
  email: string,
  token: string,
  options?: { supabaseUrl?: string | null },
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
    const { error: verificationError } = await verifyEmailOtpOnce(
      auth,
      normalizedEmail,
      normalizedToken,
    );

    if (verificationError instanceof Error && isFetchFailure(verificationError.message)) {
      return { error: formatAuthConnectivityError(options?.supabaseUrl) };
    }

    return {
      error: formatAuthVerificationError(verificationError, options?.supabaseUrl),
    };
  } catch (error) {
    return { error: formatAuthVerificationError(error, options?.supabaseUrl) };
  }
}
