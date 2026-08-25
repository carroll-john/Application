import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

// DIS-123: thin, testable wrappers around the Supabase TOTP MFA API. The React
// section in `features/profile/ProfileMfaSection.tsx` is intentionally kept to
// orchestration; all the error mapping lives here so it can be unit-tested
// without a DOM. `MfaClient` is the slice of `supabase.auth.mfa` we use, so a
// plain mock satisfies it in tests and the real client satisfies it at runtime.
export type MfaClient = Pick<
  SupabaseClient<Database>["auth"]["mfa"],
  | "listFactors"
  | "enroll"
  | "challengeAndVerify"
  | "getAuthenticatorAssuranceLevel"
  | "unenroll"
>;

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export type TotpStatus = {
  enabled: boolean;
  verifiedFactorId: string | null;
};

export type MfaSessionStatus = {
  requiresChallenge: boolean;
};

const MFA_GENERIC_ERROR =
  "Two-factor authentication is unavailable right now. Try again.";
const MFA_NOT_ENABLED_MESSAGE =
  "Two-factor authentication isn't switched on for this project yet. It has to be enabled in Supabase before you can set it up here.";
const MFA_INVALID_CODE_MESSAGE =
  "That code didn't match. Check your authenticator app and try again.";

function getMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return String(error);
}

function getEnrollErrorMessage(error: unknown): string {
  const message = getMessage(error);

  if (
    message &&
    /(totp|factor type|mfa).*(not enabled|disabled|not supported|not allowed)|enrollment.*disabled/i.test(
      message,
    )
  ) {
    return MFA_NOT_ENABLED_MESSAGE;
  }

  return message ?? MFA_GENERIC_ERROR;
}

function getVerifyErrorMessage(error: unknown): string {
  const message = getMessage(error);

  if (
    message &&
    /invalid.*(totp|code)|verification (failed|invalid)|incorrect.*code|code.*(invalid|expired)/i.test(
      message,
    )
  ) {
    return MFA_INVALID_CODE_MESSAGE;
  }

  return message ?? MFA_GENERIC_ERROR;
}

function normalizeTotpCode(code: string): string | null {
  const normalizedCode = code.replace(/\s+/g, "");
  return /^\d{6}$/.test(normalizedCode) ? normalizedCode : null;
}

/**
 * Determines whether the current Supabase session must complete an enrolled
 * factor before the application may expose it to persistence or protected UI.
 */
export async function getMfaSessionStatus(
  mfa: MfaClient,
): Promise<{ status: MfaSessionStatus | null; error: string | null }> {
  try {
    const { data, error } = await mfa.getAuthenticatorAssuranceLevel();

    if (error || !data) {
      return {
        status: null,
        error: getMessage(error) ?? MFA_GENERIC_ERROR,
      };
    }

    return {
      status: {
        requiresChallenge:
          data.nextLevel === "aal2" && data.currentLevel !== "aal2",
      },
      error: null,
    };
  } catch (error) {
    return { status: null, error: getMessage(error) ?? MFA_GENERIC_ERROR };
  }
}

/**
 * Verifies the first available TOTP factor. The product currently enrolls only
 * authenticator-app factors; listFactors returns verified factors in `totp`.
 */
export async function verifyTotpChallenge(
  mfa: MfaClient,
  code: string,
): Promise<{ error: string | null }> {
  const normalizedCode = normalizeTotpCode(code);

  if (!normalizedCode) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  try {
    const { data: factors, error: factorsError } = await mfa.listFactors();

    if (factorsError) {
      return {
        error: getMessage(factorsError) ?? MFA_GENERIC_ERROR,
      };
    }

    const factorId = factors?.totp?.[0]?.id;

    if (!factorId) {
      return {
        error:
          "No authenticator app is available for this account. Sign out and try again.",
      };
    }

    const { error } = await mfa.challengeAndVerify({
      factorId,
      code: normalizedCode,
    });

    return { error: error ? getVerifyErrorMessage(error) : null };
  } catch (error) {
    return { error: getVerifyErrorMessage(error) };
  }
}

export async function getTotpStatus(
  mfa: MfaClient,
): Promise<{ status: TotpStatus | null; error: string | null }> {
  try {
    const { data, error } = await mfa.listFactors();

    if (error) {
      return { status: null, error: getMessage(error) ?? MFA_GENERIC_ERROR };
    }

    const totpFactors = data?.totp ?? [];
    const verified =
      totpFactors.find((factor) => factor.status === "verified") ?? null;

    return {
      status: {
        enabled: Boolean(verified),
        verifiedFactorId: verified?.id ?? null,
      },
      error: null,
    };
  } catch (error) {
    return { status: null, error: getMessage(error) ?? MFA_GENERIC_ERROR };
  }
}

export async function startTotpEnrollment(
  mfa: MfaClient,
): Promise<{ enrollment: TotpEnrollment | null; error: string | null }> {
  try {
    const { data, error } = await mfa.enroll({ factorType: "totp" });

    if (error) {
      return { enrollment: null, error: getEnrollErrorMessage(error) };
    }

    if (!data?.totp) {
      return { enrollment: null, error: MFA_GENERIC_ERROR };
    }

    return {
      enrollment: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
      error: null,
    };
  } catch (error) {
    return { enrollment: null, error: getEnrollErrorMessage(error) };
  }
}

export async function confirmTotpEnrollment(
  mfa: MfaClient,
  factorId: string,
  code: string,
): Promise<{ error: string | null }> {
  const normalizedCode = normalizeTotpCode(code);

  if (!normalizedCode) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  try {
    const { error } = await mfa.challengeAndVerify({
      factorId,
      code: normalizedCode,
    });

    return { error: error ? getVerifyErrorMessage(error) : null };
  } catch (error) {
    return { error: getVerifyErrorMessage(error) };
  }
}

export async function disableTotp(
  mfa: MfaClient,
  factorId: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await mfa.unenroll({ factorId });

    return { error: error ? getMessage(error) ?? MFA_GENERIC_ERROR : null };
  } catch (error) {
    return { error: getMessage(error) ?? MFA_GENERIC_ERROR };
  }
}

/**
 * Best-effort removal of an unverified factor when the user abandons the
 * enrollment flow, so retrying doesn't accumulate orphan factors. Errors are
 * swallowed — there is nothing useful the user can do about a failed cleanup.
 */
export async function cancelTotpEnrollment(
  mfa: MfaClient,
  factorId: string,
): Promise<void> {
  try {
    await mfa.unenroll({ factorId });
  } catch {
    // Intentionally ignored.
  }
}
