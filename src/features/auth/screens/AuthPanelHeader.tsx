import { ShieldCheck } from "lucide-react";
import { configuredSupabaseUrl } from "../../../lib/supabase";
import {
  isLocalSupabaseUrl,
  LOCAL_DEV_MAILPIT_URL,
} from "../../../lib/supabaseConfig";
import type { AuthScreen } from "../types";

interface AuthPanelHeaderProps {
  screen: AuthScreen;
  sentEmail: string | null;
}

function getHeading(screen: AuthScreen) {
  switch (screen) {
    case "mfa-challenge":
      return "Enter your authenticator code";
    case "new-password":
      return "Choose a new password";
    case "reset-email-sent":
      return "Check your email";
    case "confirm-email-sent":
      return "Confirm your email";
    case "forgot-password":
      return "Reset your password";
    default:
      return "Continue with email";
  }
}

function getDescription(screen: AuthScreen, sentEmail: string | null) {
  switch (screen) {
    case "mfa-challenge":
      return "Two-factor authentication is on for this account. Enter the 6-digit code from your authenticator app to continue.";
    case "new-password":
      return "Your reset link worked. Choose a new password to finish signing in.";
    case "reset-email-sent":
      return sentEmail
        ? `If ${sentEmail} is registered, we sent a password reset link. Open it to choose a new password.`
        : "If your email is registered, we sent a password reset link.";
    case "confirm-email-sent":
      return sentEmail
        ? `We sent a confirmation link to ${sentEmail}. Open it to activate your account, then return here to sign in.`
        : "We sent a confirmation link to your email.";
    case "forgot-password":
      return "Enter your email and we will send a link to choose a new password.";
    case "sign-in":
      return "Sign in with your applicant account email and password.";
    case "sign-up":
      return "Create an applicant account with your email and a password.";
  }
}

export function AuthPanelHeader({ screen, sentEmail }: AuthPanelHeaderProps) {
  const showLocalMailpitHint =
    import.meta.env.DEV && isLocalSupabaseUrl(configuredSupabaseUrl);

  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
        <ShieldCheck className="h-4 w-4" />
        Secure applicant access
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-950">
          {getHeading(screen)}
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          {getDescription(screen, sentEmail)}
        </p>
        {showLocalMailpitHint ? (
          <p className="text-sm leading-6 text-slate-600">
            Local dev: confirmation emails are captured in{" "}
            <a
              className="font-medium text-[var(--cta-secondary)] hover:underline"
              href={LOCAL_DEV_MAILPIT_URL}
              rel="noreferrer"
              target="_blank"
            >
              Mailpit
            </a>
            , not your real inbox.
          </p>
        ) : null}
      </div>
    </>
  );
}
