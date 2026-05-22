import { useState } from "react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { validatePasswordPair } from "../../lib/authPassword";
import { AuthPasswordPair } from "../auth/components/AuthPasswordPair";

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

    const validationError = validatePasswordPair(password, confirmPassword);

    if (validationError) {
      setError(validationError);
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
