import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  getTotpStatus,
  startTotpEnrollment,
  type MfaClient,
  type TotpEnrollment,
} from "../../lib/authMfa";

interface ProfileMfaSectionProps {
  mfa: MfaClient;
}

type ViewState = "loading" | "off" | "enrolling" | "on" | "unavailable";

export function ProfileMfaSection({ mfa }: ProfileMfaSectionProps) {
  const [view, setView] = useState<ViewState>("loading");
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { status, error: statusError } = await getTotpStatus(mfa);

      if (cancelled) {
        return;
      }

      if (statusError || !status) {
        setError(statusError);
        setView("unavailable");
        return;
      }

      setVerifiedFactorId(status.verifiedFactorId);
      setView(status.enabled ? "on" : "off");
    })();

    return () => {
      cancelled = true;
    };
  }, [mfa]);

  async function handleStartEnrollment() {
    setError(null);
    setStatusMessage(null);
    setIsBusy(true);
    const { enrollment: next, error: enrollError } =
      await startTotpEnrollment(mfa);
    setIsBusy(false);

    if (enrollError || !next) {
      setError(enrollError);
      return;
    }

    setEnrollment(next);
    setCode("");
    setView("enrolling");
  }

  async function handleConfirmEnrollment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!enrollment) {
      return;
    }

    setError(null);
    setIsBusy(true);
    const { error: confirmError } = await confirmTotpEnrollment(
      mfa,
      enrollment.factorId,
      code,
    );
    setIsBusy(false);

    if (confirmError) {
      setError(confirmError);
      return;
    }

    setVerifiedFactorId(enrollment.factorId);
    setEnrollment(null);
    setCode("");
    setStatusMessage("Two-factor authentication is on.");
    setView("on");
  }

  async function handleCancelEnrollment() {
    setError(null);
    setIsBusy(true);

    if (enrollment) {
      await cancelTotpEnrollment(mfa, enrollment.factorId);
    }

    setIsBusy(false);
    setEnrollment(null);
    setCode("");
    setView("off");
  }

  async function handleDisable() {
    if (!verifiedFactorId) {
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsBusy(true);
    const { error: disableError } = await disableTotp(mfa, verifiedFactorId);
    setIsBusy(false);

    if (disableError) {
      setError(disableError);
      return;
    }

    setVerifiedFactorId(null);
    setStatusMessage("Two-factor authentication is off.");
    setView("off");
  }

  return (
    <SurfaceCard className="max-w-3xl p-6 sm:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Two-factor authentication
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Add a second step at sign-in using an authenticator app (TOTP) such
            as Google Authenticator, 1Password, or Authy.
          </p>
        </div>

        {view === "loading" ? (
          <p className="text-sm text-slate-500">
            Checking your security settings…
          </p>
        ) : null}

        {view === "unavailable" ? (
          <p className="text-sm font-medium text-[var(--error-text)]">
            {error ?? "Two-factor authentication is unavailable right now."}
          </p>
        ) : null}

        {view === "off" ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Two-factor authentication is currently off.
            </p>
            <Button
              className="sm:min-w-[220px]"
              disabled={isBusy}
              type="button"
              onClick={() => void handleStartEnrollment()}
            >
              {isBusy ? "Starting…" : "Set up authenticator app"}
            </Button>
            {error ? (
              <p className="text-sm font-medium text-[var(--error-text)]">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {view === "enrolling" && enrollment ? (
          <form
            className="space-y-5"
            onSubmit={(event) => void handleConfirmEnrollment(event)}
          >
            <ol className="space-y-2 text-sm text-slate-600">
              <li>1. Scan this QR code with your authenticator app.</li>
              <li>2. Enter the 6-digit code it shows to finish.</li>
            </ol>
            <div className="flex flex-col items-start gap-3">
              <img
                alt="Authenticator app QR code"
                className="h-44 w-44 rounded-2xl border border-slate-200 bg-white p-2"
                src={enrollment.qrCode}
              />
              <p className="text-sm text-slate-600">
                Can&apos;t scan it? Enter this key manually:
                <span className="ml-2 break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
                  {enrollment.secret}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-800"
                htmlFor="profile-totp-code"
              >
                Enter the 6-digit code
              </label>
              <Input
                autoComplete="one-time-code"
                className="max-w-[200px] tracking-[0.5em]"
                id="profile-totp-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-[var(--error-text)]">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                className="sm:min-w-[180px]"
                disabled={isBusy}
                type="submit"
              >
                {isBusy ? "Verifying…" : "Verify and turn on"}
              </Button>
              <Button
                disabled={isBusy}
                type="button"
                variant="neutralOutline"
                onClick={() => void handleCancelEnrollment()}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {view === "on" ? (
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--success-text)]">
              <ShieldCheck className="h-4 w-4" />
              Two-factor authentication is on.
            </p>
            {error ? (
              <p className="text-sm font-medium text-[var(--error-text)]">
                {error}
              </p>
            ) : null}
            <Button
              disabled={isBusy}
              type="button"
              variant="neutralOutline"
              onClick={() => void handleDisable()}
            >
              {isBusy ? "Removing…" : "Turn off"}
            </Button>
          </div>
        ) : null}

        {statusMessage && view !== "enrolling" ? (
          <p className="text-sm font-medium text-[var(--success-text)]">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
