import { Mail, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../context/AuthContext";
import { resolveAuthRedirectPath } from "../../lib/authCallback";
import {
  AUTH_OTP_MIN_RESEND_SECONDS,
  getAuthOtpRetryAfterSeconds,
  isValidEmailAddress,
  normalizeAuthEmail,
  normalizeOtpCode,
} from "../../lib/authOtp";
import { capturePostHogEvent } from "../../lib/posthog";
import { configuredSupabaseUrl } from "../../lib/supabase";
import {
  isLocalSupabaseUrl,
  LOCAL_DEV_MAILPIT_URL,
} from "../../lib/supabaseConfig";

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
    resendEmailOtp,
    sendEmailOtp,
    verifyEmailOtp,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const hasNotifiedAuthenticatedRef = useRef(false);
  const normalizedEmail = normalizeAuthEmail(email);
  const normalizedCode = normalizeOtpCode(code);
  const showLocalMailpitHint =
    import.meta.env.DEV && isLocalSupabaseUrl(configuredSupabaseUrl);

  useEffect(() => {
    if (!isAuthenticated || hasNotifiedAuthenticatedRef.current) {
      return;
    }

    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }, [isAuthenticated, onAuthenticated]);

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [otpCooldownSeconds]);

  function startOtpCooldown(seconds = AUTH_OTP_MIN_RESEND_SECONDS) {
    setOtpCooldownSeconds(Math.max(seconds, 1));
  }

  function applyOtpRequestError(requestError: string) {
    const retryAfterSeconds = getAuthOtpRetryAfterSeconds(requestError);
    if (retryAfterSeconds) {
      startOtpCooldown(retryAfterSeconds);
    }
    setError(requestError);
  }

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (otpCooldownSeconds > 0) {
      setError(
        `Please wait ${otpCooldownSeconds} seconds before requesting another sign-in code.`,
      );
      return;
    }

    setIsSending(true);
    capturePostHogEvent("auth_otp_requested", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    const { error: sendError } = await sendEmailOtp(normalizedEmail, {
      redirectPath,
    });
    setIsSending(false);

    if (sendError) {
      capturePostHogEvent("auth_otp_failed", {
        auth_context: context,
        auth_step: "request",
      });
      applyOtpRequestError(sendError);
      return;
    }

    capturePostHogEvent("auth_otp_sent", {
      auth_context: context,
      email_domain: normalizedEmail.split("@")[1] ?? "unknown",
    });
    setSentEmail(normalizedEmail);
    setCode("");
    startOtpCooldown();
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!sentEmail) {
      setError("Enter your email address first.");
      return;
    }

    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setIsVerifying(true);
    const { error: verifyError } = await verifyEmailOtp(sentEmail, normalizedCode);
    setIsVerifying(false);

    if (verifyError) {
      capturePostHogEvent("auth_otp_failed", {
        auth_context: context,
        auth_step: "verify",
      });
      setError(verifyError);
      return;
    }

    capturePostHogEvent("auth_otp_verified", {
      auth_context: context,
      email_domain: sentEmail.split("@")[1] ?? "unknown",
    });
    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated?.();
  }

  async function handleResendCode() {
    if (!sentEmail || otpCooldownSeconds > 0) {
      return;
    }

    setError(null);
    setIsResending(true);
    const { error: resendError } = await resendEmailOtp(sentEmail, {
      redirectPath,
    });
    setIsResending(false);

    if (resendError) {
      applyOtpRequestError(resendError);
      return;
    }

    capturePostHogEvent("auth_otp_sent", {
      auth_context: context,
      auth_step: "resend",
      email_domain: sentEmail.split("@")[1] ?? "unknown",
    });
    setCode("");
    startOtpCooldown();
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
        <ShieldCheck className="h-4 w-4" />
        Secure applicant access
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-950">
          {sentEmail ? "Enter your code" : "Continue with email"}
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          {sentEmail
            ? `We sent a 6-digit sign-in code to ${sentEmail}. Use the code from your most recent email.`
            : "Use your email to sign in or create an applicant account. No password required."}
        </p>
        {showLocalMailpitHint ? (
          <p className="text-sm leading-6 text-slate-600">
            Local dev: auth emails are captured in{" "}
            <a
              className="font-medium text-[var(--cta-secondary)] hover:underline"
              href={LOCAL_DEV_MAILPIT_URL}
              rel="noreferrer"
              target="_blank"
            >
              Mailpit
            </a>
            , not your real inbox. Open Mailpit and use the 6-digit code from the
            message body.
          </p>
        ) : null}
      </div>

      {!isConfigured ? (
        <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
          Authentication is not configured yet. Set the Supabase URL and anon
          key environment variables to enable applicant sign-in.
        </div>
      ) : null}

      {sentEmail ? (
        <form className="space-y-4" onSubmit={handleVerifyCode}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="auth-code"
            >
              One-time code
            </label>
            <Input
              autoComplete="one-time-code"
              className="h-12 text-center text-lg font-semibold tracking-[0.45em]"
              id="auth-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              placeholder="000000"
              value={code}
              onChange={(event) => {
                setCode(normalizeOtpCode(event.target.value));
                setError(null);
              }}
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-[var(--error-text)]">
              {error}
            </p>
          ) : null}

          <Button
            className="h-12 w-full justify-center text-base"
            disabled={isVerifying || !isConfigured}
            type="submit"
          >
            {isVerifying ? "Checking code..." : "Continue"}
          </Button>

          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <button
              className="font-medium text-[var(--cta-secondary)] hover:underline"
              type="button"
              onClick={() => {
                setSentEmail(null);
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
            <button
              className="font-medium text-[var(--cta-secondary)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isResending || otpCooldownSeconds > 0}
              type="button"
              onClick={() => {
                void handleResendCode();
              }}
            >
              {isResending
                ? "Sending..."
                : otpCooldownSeconds > 0
                  ? `Resend in ${otpCooldownSeconds}s`
                  : "Resend code"}
            </button>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSendCode}>
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

          {error ? (
            <p className="text-sm font-medium text-[var(--error-text)]">
              {error}
            </p>
          ) : null}

          <Button
            className="h-12 w-full justify-center text-base"
            disabled={isSending || !isConfigured || otpCooldownSeconds > 0}
            type="submit"
          >
            {isSending
              ? "Sending code..."
              : otpCooldownSeconds > 0
                ? `Wait ${otpCooldownSeconds}s`
                : "Email me a code"}
          </Button>
        </form>
      )}
    </div>
  );
}
