import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resolveAuthRedirectPath } from "../../lib/authCallback";
import {
  isValidEmailAddress,
  normalizeAuthEmail,
  validateSignUpForm,
} from "../../lib/authPassword";
import { capturePostHogEvent } from "../../lib/posthog";
import { AuthPanelHeader } from "./screens/AuthPanelHeader";
import { ConfirmEmailSent } from "./screens/ConfirmEmailSent";
import { ForgotPasswordForm } from "./screens/ForgotPasswordForm";
import { ResetEmailSent } from "./screens/ResetEmailSent";
import { SetNewPasswordForm } from "./screens/SetNewPasswordForm";
import { SignInForm } from "./screens/SignInForm";
import { SignUpForm } from "./screens/SignUpForm";
import type { AuthPanelContext, AuthScreen, AuthTab } from "./types";

interface AuthPanelProps {
  context?: AuthPanelContext;
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
  const [screen, setScreen] = useState<AuthScreen>("sign-in");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasNotifiedAuthenticatedRef = useRef(false);
  const normalizedEmail = normalizeAuthEmail(email);
  const currentScreen: AuthScreen = isPasswordRecovery ? "new-password" : screen;

  useEffect(() => {
    if (!isAuthenticated || isPasswordRecovery || hasNotifiedAuthenticatedRef.current) {
      return;
    }

    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }, [isAuthenticated, isPasswordRecovery, onAuthenticated]);

  function clearFieldErrors() {
    setError(null);
  }

  function resetTransientState() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSentEmail(null);
    setScreen(activeTab);
  }

  function switchTab(nextTab: AuthTab) {
    setActiveTab(nextTab);
    setScreen(nextTab);
    resetTransientState();
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

    if (isAuthenticated && !isPasswordRecovery) {
      hasNotifiedAuthenticatedRef.current = true;
      onAuthenticated?.();
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

    const validationError = validateSignUpForm(
      normalizedEmail,
      password,
      confirmPassword,
    );

    if (validationError) {
      setError(validationError);
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
        switchTab("sign-in");
      }
      return;
    }

    capturePostHogEvent("auth_sign_up_confirmation_sent", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    setSentEmail(normalizedEmail);
    setScreen("confirm-email-sent");
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
    const { error: resetError } = await requestPasswordReset(normalizedEmail, {
      redirectPath,
    });
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    setSentEmail(normalizedEmail);
    setScreen("reset-email-sent");
  }

  async function handleSetNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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

  function renderScreen() {
    switch (currentScreen) {
      case "confirm-email-sent":
        return (
          <ConfirmEmailSent
            onBackToSignIn={() => {
              setSentEmail(null);
              switchTab("sign-in");
            }}
          />
        );
      case "reset-email-sent":
        return (
          <ResetEmailSent
            onBackToSignIn={() => {
              setSentEmail(null);
              switchTab("sign-in");
            }}
          />
        );
      case "new-password":
        return (
          <SetNewPasswordForm
            confirmPassword={confirmPassword}
            error={error}
            isConfigured={isConfigured}
            isSubmitting={isSubmitting}
            password={password}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              clearFieldErrors();
            }}
            onPasswordChange={(value) => {
              setPassword(value);
              clearFieldErrors();
            }}
            onSubmit={handleSetNewPassword}
            onValidationError={setError}
          />
        );
      case "forgot-password":
        return (
          <ForgotPasswordForm
            email={email}
            error={error}
            isConfigured={isConfigured}
            isSubmitting={isSubmitting}
            onBackToSignIn={() => {
              setScreen("sign-in");
              clearFieldErrors();
            }}
            onEmailChange={(value) => {
              setEmail(value);
              clearFieldErrors();
            }}
            onSubmit={handleForgotPassword}
          />
        );
      case "sign-up":
        return (
          <SignUpForm
            confirmPassword={confirmPassword}
            email={email}
            error={error}
            isConfigured={isConfigured}
            isSubmitting={isSubmitting}
            password={password}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              clearFieldErrors();
            }}
            onEmailChange={(value) => {
              setEmail(value);
              clearFieldErrors();
            }}
            onPasswordChange={(value) => {
              setPassword(value);
              clearFieldErrors();
            }}
            onSubmit={handleSignUp}
            onValidationError={setError}
          />
        );
      case "sign-in":
      default:
        return (
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
              <SignInForm
                email={email}
                error={error}
                isConfigured={isConfigured}
                isSubmitting={isSubmitting}
                password={password}
                onEmailChange={(value) => {
                  setEmail(value);
                  clearFieldErrors();
                }}
                onForgotPassword={() => {
                  setScreen("forgot-password");
                  clearFieldErrors();
                }}
                onPasswordChange={(value) => {
                  setPassword(value);
                  clearFieldErrors();
                }}
                onSubmit={handleSignIn}
              />
            ) : (
              <SignUpForm
                confirmPassword={confirmPassword}
                email={email}
                error={error}
                isConfigured={isConfigured}
                isSubmitting={isSubmitting}
                password={password}
                onConfirmPasswordChange={(value) => {
                  setConfirmPassword(value);
                  clearFieldErrors();
                }}
                onEmailChange={(value) => {
                  setEmail(value);
                  clearFieldErrors();
                }}
                onPasswordChange={(value) => {
                  setPassword(value);
                  clearFieldErrors();
                }}
                onSubmit={handleSignUp}
                onValidationError={setError}
              />
            )}
          </>
        );
    }
  }

  return (
    <div className="space-y-6">
      <AuthPanelHeader screen={currentScreen} sentEmail={sentEmail} />

      {!isConfigured ? (
        <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
          Authentication is not configured yet. Set the Supabase URL and anon
          key environment variables to enable applicant sign-in.
        </div>
      ) : null}

      {renderScreen()}
    </div>
  );
}
