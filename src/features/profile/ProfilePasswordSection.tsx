import { useState } from "react";
import { Lock } from "lucide-react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { validatePasswordPair } from "../../lib/authPassword";
import { AuthPasswordPair } from "../auth/components/AuthPasswordPair";

interface ProfilePasswordSectionProps {
  onChangePassword: (
    currentPassword: string,
    password: string,
  ) => Promise<{ error: string | null }>;
}

export function ProfilePasswordSection({
  onChangePassword,
}: ProfilePasswordSectionProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    const validationError = validatePasswordPair(password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await onChangePassword(
      currentPassword,
      password,
    );
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setStatusMessage("Password updated.");
  }

  return (
    <SurfaceCard className="max-w-3xl p-6 sm:p-8">
      <form
        className="space-y-6"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Password</h2>
          <p className="text-sm leading-6 text-slate-600">
            Confirm your current password, then choose a new password for your
            applicant account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-current-password"
            >
              Current password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="current-password"
                className="h-12 pl-11 text-base"
                id="profile-current-password"
                required
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          <AuthPasswordPair
            confirmPassword={confirmPassword}
            confirmPasswordId="profile-confirm-password"
            confirmPasswordLabel="Confirm new password"
            layout="profile"
            password={password}
            passwordId="profile-new-password"
            passwordLabel="New password"
            passwordPlaceholder=""
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              setError(null);
            }}
            onPasswordChange={(value) => {
              setPassword(value);
              setError(null);
            }}
          />
        </div>

        {error ? (
          <p className="text-sm font-medium text-[var(--error-text)]">
            {error}
          </p>
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
