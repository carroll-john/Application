import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isHostedSupabaseProjectUrl,
  isLocalSupabaseUrl,
  LOCAL_DEV_MAILPIT_URL,
} from "./supabaseConfig";
import type { Database } from "./supabase.types";

type AuthClient = Pick<
  SupabaseClient<Database>["auth"],
  "signInWithPassword" | "signUp" | "resetPasswordForEmail" | "updateUser"
>;

export type SignUpWithPasswordResult = {
  error: string | null;
  outcome?: "confirmation_sent" | "existing_account";
};

// DIS-119: an injected checker that resolves true when a password is known to
// be compromised. Injected (rather than imported) so this module stays a pure
// validation/error-mapping layer and the network call can be mocked in tests.
export type LeakedPasswordChecker = (password: string) => Promise<boolean>;

export const AUTH_LEAKED_PASSWORD_MESSAGE =
  "This password has appeared in a known data breach. Choose a different password.";

async function findLeakedPasswordError(
  password: string,
  checkLeakedPassword: LeakedPasswordChecker | undefined,
): Promise<string | null> {
  if (!checkLeakedPassword) {
    return null;
  }

  try {
    return (await checkLeakedPassword(password))
      ? AUTH_LEAKED_PASSWORD_MESSAGE
      : null;
  } catch {
    // Fail open: a broken breach check must never block setting a password.
    return null;
  }
}

function isRepeatedSignUpResponse(user: { identities?: unknown[] } | null) {
  return Boolean(user && (!user.identities || user.identities.length === 0));
}

export const AUTH_MIN_PASSWORD_LENGTH = 6;

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-in service. Check your connection and try again.";

export function formatAuthConnectivityError(
  supabaseUrl: string | null | undefined,
) {
  if (isLocalSupabaseUrl(supabaseUrl)) {
    return `We couldn't reach local Supabase. Run \`supabase start\`, then retry. Local confirmation emails go to Mailpit at ${LOCAL_DEV_MAILPIT_URL}, not your real inbox.`;
  }

  if (isHostedSupabaseProjectUrl(supabaseUrl)) {
    return "We couldn't reach the hosted Supabase project. It may be paused or deleted — restore the Application project in the Supabase dashboard, then confirm Vercel uses the restored URL and anon key.";
  }

  return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
}

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string) {
  return /^\S+@\S+\.\S+$/.test(normalizeAuthEmail(email));
}

export function isValidPassword(password: string) {
  return password.length >= AUTH_MIN_PASSWORD_LENGTH;
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string,
): string | null {
  if (!isValidPassword(password)) {
    return `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}

export function validateSignUpForm(
  email: string,
  password: string,
  confirmPassword: string,
): string | null {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!isValidEmailAddress(normalizedEmail)) {
    return "Enter a valid email address.";
  }

  return validatePasswordPair(password, confirmPassword);
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

function formatAuthPasswordError(
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

  if (/email not confirmed|confirm your email/i.test(message)) {
    return "Confirm your email before signing in. Check your inbox for the confirmation link.";
  }

  if (/invalid login credentials|invalid email or password/i.test(message)) {
    return "Email or password is incorrect. If you previously signed in with email codes, use Forgot password to set one.";
  }

  if (/user already registered|already been registered/i.test(message)) {
    return "An account with this email already exists. Sign in instead.";
  }

  if (/password.*(short|least|weak|characters)/i.test(message)) {
    return `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`;
  }

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    return "Confirmation emails are rate-limited on the hosted Supabase project. Configure custom SMTP under Authentication → SMTP in the Supabase dashboard, then retry.";
  }

  if (/rate limit|too many requests|429/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return message;
}

export async function signInWithPassword(
  auth: AuthClient,
  email: string,
  password: string,
  options?: { supabaseUrl?: string | null },
): Promise<{ error: string | null }> {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!normalizedEmail) {
    return { error: "Enter your email address." };
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (!password) {
    return { error: "Enter your password." };
  }

  try {
    const { error } = await auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  } catch (error) {
    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  }
}

export async function signUpWithPassword(
  auth: AuthClient,
  email: string,
  password: string,
  options?: {
    emailRedirectTo?: string;
    supabaseUrl?: string | null;
    checkLeakedPassword?: LeakedPasswordChecker;
  },
): Promise<SignUpWithPasswordResult> {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!normalizedEmail) {
    return { error: "Enter your email address." };
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (!password) {
    return { error: "Enter a password." };
  }

  if (!isValidPassword(password)) {
    return {
      error: `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const leakedPasswordError = await findLeakedPasswordError(
    password,
    options?.checkLeakedPassword,
  );

  if (leakedPasswordError) {
    return { error: leakedPasswordError };
  }

  try {
    const { data, error } = await auth.signUp({
      email: normalizedEmail,
      password,
      options: options?.emailRedirectTo
        ? { emailRedirectTo: options.emailRedirectTo }
        : undefined,
    });

    if (error) {
      return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
    }

    if (isRepeatedSignUpResponse(data.user)) {
      return {
        error:
          "An account with this email already exists. Switch to Sign in instead.",
        outcome: "existing_account",
      };
    }

    return { error: null, outcome: "confirmation_sent" };
  } catch (error) {
    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  }
}

export async function requestPasswordReset(
  auth: AuthClient,
  email: string,
  options?: { redirectTo?: string; supabaseUrl?: string | null },
): Promise<{ error: string | null }> {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!normalizedEmail) {
    return { error: "Enter your email address." };
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const { error } = await auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: options?.redirectTo,
    });

    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  } catch (error) {
    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  }
}

export async function updatePasswordAfterRecovery(
  auth: AuthClient,
  password: string,
  options?: {
    supabaseUrl?: string | null;
    checkLeakedPassword?: LeakedPasswordChecker;
  },
): Promise<{ error: string | null }> {
  if (!password) {
    return { error: "Enter a password." };
  }

  if (!isValidPassword(password)) {
    return {
      error: `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const leakedPasswordError = await findLeakedPasswordError(
    password,
    options?.checkLeakedPassword,
  );

  if (leakedPasswordError) {
    return { error: leakedPasswordError };
  }

  try {
    const { error } = await auth.updateUser({ password });

    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  } catch (error) {
    return { error: formatAuthPasswordError(error, options?.supabaseUrl) };
  }
}
