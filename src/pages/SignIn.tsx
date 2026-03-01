import { Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";

const EMAIL_RESEND_COOLDOWN_MS = 60_000;
const EMAIL_RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;
const SIGN_IN_LAST_SENT_STORAGE_KEY =
  "application-prototype:sign-in:last-email-link-sent-at";
const SIGN_IN_RATE_LIMIT_UNTIL_STORAGE_KEY =
  "application-prototype:sign-in:rate-limit-until";

function formatDomains(domains: string[]) {
  return domains.map((domain) => `@${domain}`).join(", ");
}

export default function SignIn() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    canUseDevBypass,
    companyDomains,
    disableDevBypass,
    enableDevBypass,
    isAuthorizedCompanyUser,
    isAllowedEmail,
    isBypassedInDev,
    isConfigured,
    isLoading,
    sendMagicLink,
    session,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    const lastSentAt = Number(
      window.localStorage.getItem(SIGN_IN_LAST_SENT_STORAGE_KEY) ?? 0,
    );
    const rateLimitUntil = Number(
      window.localStorage.getItem(SIGN_IN_RATE_LIMIT_UNTIL_STORAGE_KEY) ?? 0,
    );

    const standardCooldownRemaining = Math.max(
      0,
      EMAIL_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt),
    );
    const rateLimitCooldownRemaining = Math.max(
      0,
      rateLimitUntil - Date.now(),
    );

    return Math.max(standardCooldownRemaining, rateLimitCooldownRemaining);
  });

  const redirectPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/";
  }, [location.search]);

  const shouldAutoEnableDevBypass =
    canUseDevBypass && searchParams.get("dev-bypass") === "1";

  useEffect(() => {
    if (shouldAutoEnableDevBypass) {
      enableDevBypass();
    }
  }, [enableDevBypass, shouldAutoEnableDevBypass]);

  useEffect(() => {
    if (cooldownRemainingMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownRemainingMs((previous) => Math.max(0, previous - 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemainingMs]);

  if ((session && isAuthorizedCompanyUser) || isBypassedInDev) {
    return <Navigate replace to={redirectPath} />;
  }

  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000);

  function startResendCooldown(durationMs = EMAIL_RESEND_COOLDOWN_MS) {
    if (typeof window !== "undefined") {
      const now = Date.now();
      window.localStorage.setItem(SIGN_IN_LAST_SENT_STORAGE_KEY, String(now));

      if (durationMs > EMAIL_RESEND_COOLDOWN_MS) {
        window.localStorage.setItem(
          SIGN_IN_RATE_LIMIT_UNTIL_STORAGE_KEY,
          String(now + durationMs),
        );
      } else {
        window.localStorage.removeItem(SIGN_IN_RATE_LIMIT_UNTIL_STORAGE_KEY);
      }
    }

    setCooldownRemainingMs(durationMs);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Enter your work email address.");
      return;
    }

    if (!isAllowedEmail(trimmedEmail)) {
      setError(
        `Use a company email address (${formatDomains(companyDomains)}).`,
      );
      return;
    }

    if (cooldownRemainingMs > 0) {
      setError(
        `A sign-in link was just sent. Wait ${cooldownSeconds} seconds, or use the email already in your inbox.`,
      );
      return;
    }

    setIsSubmitting(true);
      const { error: signInError } = await sendMagicLink(trimmedEmail, redirectPath);
    setIsSubmitting(false);

    if (signInError) {
      if (signInError.toLowerCase().includes("rate limit")) {
        startResendCooldown(EMAIL_RATE_LIMIT_COOLDOWN_MS);
        setError(
          "You’ve requested sign-in links too frequently. Use the latest email already in your inbox, or wait a few minutes before trying again.",
        );
        return;
      }

      setError(signInError);
      return;
    }

    startResendCooldown();
    setSuccess(
      `Magic link sent to ${trimmedEmail}. Open it on this device to continue.`,
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader maxWidthClassName="max-w-6xl" />
      <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
              <ShieldCheck className="h-4 w-4" />
              Company-only access
            </div>
            <div className="space-y-3">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Sign in to the application workspace
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                This environment is limited to employees using approved company
                email domains. We&apos;ll send you a secure magic link to continue.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Allowed domains
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {companyDomains.length > 0
                  ? formatDomains(companyDomains)
                  : "Not configured"}
              </p>
            </div>
          </div>

          <SurfaceCard className="p-8 sm:p-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-slate-950">Work email</h2>
                <p className="text-sm leading-6 text-slate-600">
                  Enter your company email address and we&apos;ll send you a magic
                  link. If this is your first time here, we&apos;ll create your
                  account automatically after verification.
                </p>
              </div>

              {!isConfigured ? (
                <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
                  Supabase auth is not configured yet. Add `VITE_SUPABASE_URL`,
                  `VITE_SUPABASE_ANON_KEY`, and `VITE_ALLOWED_EMAIL_DOMAINS` to
                  enable sign-in outside local development.
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-800"
                    htmlFor="email"
                  >
                    Company email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      autoComplete="email"
                      className="h-12 pl-11 text-base"
                      id="email"
                      placeholder={
                        companyDomains[0]
                          ? `name@${companyDomains[0]}`
                          : "name@company.com"
                      }
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                {error ? (
                  <p className="text-sm font-medium text-[var(--error-text)]">
                    {error}
                  </p>
                ) : null}
                {success ? (
                  <p className="text-sm font-medium text-[var(--success-text)]">
                    {success}
                  </p>
                ) : null}
                {cooldownRemainingMs > 0 ? (
                  <p className="text-sm text-slate-500">
                    You can request another link in {cooldownSeconds} seconds.
                  </p>
                ) : null}

                <Button
                  className="h-12 w-full justify-center text-base"
                  disabled={
                    isSubmitting ||
                    isLoading ||
                    !isConfigured ||
                    cooldownRemainingMs > 0
                  }
                  type="submit"
                  variant="soft"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner />
                      Sending link...
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
              </form>

              {canUseDevBypass ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Local verification bypass
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This localhost-only bypass is for temporary UI verification
                    beyond the Keypath gate. It does not affect preview or
                    production auth.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="sm:min-w-48"
                      variant="outline"
                      onClick={() => {
                        disableDevBypass();
                        setError(null);
                        setSuccess(null);
                      }}
                    >
                      Use real sign-in
                    </Button>
                    <Button
                      className="sm:min-w-56"
                      variant="default"
                      onClick={() => {
                        enableDevBypass();
                      }}
                    >
                      Enter Local Preview
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
