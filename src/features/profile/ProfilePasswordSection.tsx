import { Lock } from "lucide-react";
import { useState } from "react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  isValidPassword,
} from "../../lib/authPassword";

interface ProfilePasswordSectionProps {
  onChangePassword: (password: string) => Promise<{ error: string | null }>;
}

export function ProfilePasswordSection({
  onChangePassword,
}: ProfilePasswordSectionProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!isValidPassword(password)) {
      setError(`Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await onChangePassword(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatusMessage("Password updated.");
  }

  return (
    <SurfaceCard className="max-w-3xl p-6 sm:p-8">
      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Password</h2>
          <p className="text-sm leading-6 text-slate-600">
            Choose a new password for your applicant account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-new-password"
            >
              New password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="new-password"
                className="h-12 pl-11 text-base"
                id="profile-new-password"
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-confirm-password"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="new-password"
                className="h-12 pl-11 text-base"
                id="profile-confirm-password"
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm font-medium text-[var(--error-text)]">{error}</p>
        ) : null}
        {statusMessage ? (
          <p className="text-sm font-medium text-[var(--success-text)]">
            {statusMessage}
          </p>
        ) : null}

        <Button
          className="sm:min-w-[220px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>
    </SurfaceCard>
  );
}
