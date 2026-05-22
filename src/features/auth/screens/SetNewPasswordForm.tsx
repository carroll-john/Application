import { Button } from "../../../components/ui/button";
import { validatePasswordPair } from "../../../lib/authPassword";
import { AuthPasswordPair } from "../components/AuthPasswordPair";

interface SetNewPasswordFormProps {
  password: string;
  confirmPassword: string;
  error: string | null;
  isSubmitting: boolean;
  isConfigured: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onValidationError: (message: string) => void;
}

export function SetNewPasswordForm({
  password,
  confirmPassword,
  error,
  isSubmitting,
  isConfigured,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onValidationError,
}: SetNewPasswordFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const validationError = validatePasswordPair(password, confirmPassword);

    if (validationError) {
      event.preventDefault();
      onValidationError(validationError);
      return;
    }

    onSubmit(event);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthPasswordPair
        confirmPassword={confirmPassword}
        confirmPasswordId="auth-confirm-new-password"
        confirmPasswordLabel="Confirm new password"
        password={password}
        passwordId="auth-new-password"
        passwordLabel="New password"
        onConfirmPasswordChange={onConfirmPasswordChange}
        onPasswordChange={onPasswordChange}
      />

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
  );
}
