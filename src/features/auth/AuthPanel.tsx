import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../context/AuthContext";
import { resolveAuthRedirectPath } from "../../lib/authCallback";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  isValidEmailAddress,
  isValidPassword,
  normalizeAuthEmail,
} from "../../lib/authPassword";
import { capturePostHogEvent } from "../../lib/posthog";
import { configuredSupabaseUrl } from "../../lib/supabase";
import {
  isLocalSupabaseUrl,
  LOCAL_DEV_MAILPIT_URL,
} from "../../lib/supabaseConfig";

type AuthTab = "sign-in" | "sign-up";

interface AuthPanelProps {
  context?: "apply" | "eligibility" | "header" | "route";
  onAuthenticated?: () => void;
}

export function AuthPanel({
  context = "route",
  onAuthenticated,
}: AuthPanelProps) {
  const location = useLocation();
  const redirectPath = resolveAuthRedirectPath({
    pathname: location.pathname,
    search: location.search,
  });
  const {
    isAuthenticated,
    isConfigured,
    isPasswordRecovery,
    requestPasswordReset,
    signInWithPassword,
    signUpWithPassword,
    updatePasswordAfterRecovery,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasNotifiedAuthenticatedRef = useRef(false);
  const normalizedEmail = normalizeAuthEmail(email);
  const showLocalMailpitHint =
    import.meta.env.DEV && isLocalSupabaseUrl(configuredSupabaseUrl);

  useEffect(() => {
    if (!isAuthenticated || isPasswordRecovery || hasNotifiedAuthenticatedRef.current) {
      return;
    }

    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }, [isAuthenticated, isPasswordRecovery, onAuthenticated]);

  function resetFormState() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setConfirmationEmail(null);
    setResetEmailSent(null);
    setShowForgotPassword(false);
  }

  function switchTab(nextTab: AuthTab) {
    setActiveTab(nextTab);
    resetFormState();
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setIsSubmitting(true);
    capturePostHogEvent("auth_sign_in_attempted", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    const { error: signInError } = await signInWithPassword(
      normalizedEmail,
      password,
    );
    setIsSubmitting(false);

    if (signInError) {
      capturePostHogEvent("auth_sign_in_failed", {
        auth_context: context,
      });
      setError(signInError);
      return;
    }

    capturePostHogEvent("auth_sign_in_succeeded", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!isValidPassword(password)) {
      setError(`Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    capturePostHogEvent("auth_sign_up_attempted", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    const { error: signUpError, outcome } = await signUpWithPassword(
      normalizedEmail,
      password,
      { redirectPath },
    );
    setIsSubmitting(false);

    if (signUpError) {
      capturePostHogEvent("auth_sign_up_failed", {
        auth_context: context,
        sign_up_outcome: outcome ?? "error",
      });
      setError(signUpError);
      if (outcome === "existing_account") {
        setActiveTab("sign-in");
      }
      return;
    }

    capturePostHogEvent("auth_sign_up_confirmation_sent", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    setConfirmationEmail(normalizedEmail);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await requestPasswordReset(normalizedEmail);
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    setResetEmailSent(normalizedEmail);
    setShowForgotPassword(false);
  }

  async function handleSetNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidPassword(password)) {
      setError(`Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePasswordAfterRecovery(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    capturePostHogEvent("auth_password_reset_completed", {
      auth_context: context,
    });
    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
        <ShieldCheck className="h-4 w-4" />
        Secure applicant access
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-950">
          {isPasswordRecovery
            ? "Choose a new password"
            : resetEmailSent
              ? "Check your email"
              : confirmationEmail
                ? "Confirm your email"
                : showForgotPassword
                  ? "Reset your password"
                  : "Continue with email"}
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          {isPasswordRecovery
            ? "Your reset link worked. Choose a new password to finish signing in."
            : resetEmailSent
              ? `If ${resetEmailSent} is registered, we sent a password reset link. Open it to choose a new password.`
              : confirmationEmail
                ? `We sent a confirmation link to ${confirmationEmail}. Open it to activate your account, then return here to sign in.`
                : showForgotPassword
                  ? "Enter your email and we will send a link to choose a new password."
                  : activeTab === "sign-in"
                    ? "Sign in with your applicant account email and password."
                    : "Create an applicant account with your email and a password."}
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

      {!isConfigured ? (
        <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
          Authentication is not configured yet. Set the Supabase URL and anon
          key environment variables to enable applicant sign-in.
        </div>
      ) : null}

      {confirmationEmail ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
            After confirming your email, switch to Sign in and use the password
            you just created.
          </div>
          <Button
            className="h-12 w-full justify-center text-base"
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmationEmail(null);
              switchTab("sign-in");
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : resetEmailSent ? (
        <div className="space-y-4">
          <Button
            className="h-12 w-full justify-center text-base"
            type="button"
            variant="outline"
            onClick={() => {
              setResetEmailSent(null);
              switchTab("sign-in");
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : isPasswordRecovery ? (
        <form className="space-y-4" onSubmit={handleSetNewPassword}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="auth-new-password"
            >
              New password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="new-password"
                className="h-12 pl-11 text-base"
                id="auth-new-password"
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                placeholder={`At least ${AUTH_MIN_PASSWORD_LENGTH} characters`}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="auth-confirm-new-password"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="new-password"
                className="h-12 pl-11 text-base"
                id="auth-confirm-new-password"
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                placeholder="Re-enter your password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-[var(--error-text)]">{error}</p>
          ) : null}

          <Button
            className="h-12 w-full justify-center text-base"
            disabled={isSubmitting || !isConfigured}
            type="submit"
          >
            {isSubmitting ? "Saving password..." : "Save new password"}
          </Button>
        </form>
      ) : showForgotPassword ? (
        <form className="space-y-4" onSubmit={handleForgotPassword}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="auth-reset-email"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="email"
                className="h-12 pl-11 text-base"
                id="auth-reset-email"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-[var(--error-text)]">{error}</p>
          ) : null}

          <Button
            className="h-12 w-full justify-center text-base"
            disabled={isSubmitting || !isConfigured}
            type="submit"
          >
            {isSubmitting ? "Sending link..." : "Send reset link"}
          </Button>

          <button
            className="w-full text-sm font-medium text-[var(--cta-secondary)] hover:underline"
            type="button"
            onClick={() => {
              setShowForgotPassword(false);
              setError(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "sign-in"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              type="button"
              onClick={() => switchTab("sign-in")}
            >
              Sign in
            </button>
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "sign-up"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              type="button"
              onClick={() => switchTab("sign-up")}
            >
              Create account
            </button>
          </div>

          {activeTab === "sign-in" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-slate-800"
                  htmlFor="auth-email"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="email"
                    className="h-12 pl-11 text-base"
                    id="auth-email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-slate-800"
                  htmlFor="auth-password"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="current-password"
                    className="h-12 pl-11 text-base"
                    id="auth-password"
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              {error ? (
                <p className="text-sm font-medium text-[var(--error-text)]">
                  {error}
                </p>
              ) : null}

              <Button
                className="h-12 w-full justify-center text-base"
                disabled={isSubmitting || !isConfigured}
                type="submit"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>

              <button
                className="w-full text-sm font-medium text-[var(--cta-secondary)] hover:underline"
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                }}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-slate-800"
                  htmlFor="auth-sign-up-email"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="email"
                    className="h-12 pl-11 text-base"
                    id="auth-sign-up-email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-slate-800"
                  htmlFor="auth-sign-up-password"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="new-password"
                    className="h-12 pl-11 text-base"
                    id="auth-sign-up-password"
                    minLength={AUTH_MIN_PASSWORD_LENGTH}
                    placeholder={`At least ${AUTH_MIN_PASSWORD_LENGTH} characters`}
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-slate-800"
                  htmlFor="auth-confirm-password"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="new-password"
                    className="h-12 pl-11 text-base"
                    id="auth-confirm-password"
                    minLength={AUTH_MIN_PASSWORD_LENGTH}
                    placeholder="Re-enter your password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              {error ? (
                <p className="text-sm font-medium text-[var(--error-text)]">
                  {error}
                </p>
              ) : null}

              <Button
                className="h-12 w-full justify-center text-base"
                disabled={isSubmitting || !isConfigured}
                type="submit"
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
