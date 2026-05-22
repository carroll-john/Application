import { Button } from "../../../components/ui/button";
import { validateSignUpForm } from "../../../lib/authPassword";
import { AuthEmailField } from "../components/AuthEmailField";
import { AuthPasswordPair } from "../components/AuthPasswordPair";

interface SignUpFormProps {
  email: string;
  password: string;
  confirmPassword: string;
  error: string | null;
  isSubmitting: boolean;
  isConfigured: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onValidationError: (message: string) => void;
}

export function SignUpForm({
  email,
  password,
  confirmPassword,
  error,
  isSubmitting,
  isConfigured,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onValidationError,
}: SignUpFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const validationError = validateSignUpForm(email, password, confirmPassword);

    if (validationError) {
      event.preventDefault();
      onValidationError(validationError);
      return;
    }

    onSubmit(event);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthEmailField
        id="auth-sign-up-email"
        value={email}
        onChange={onEmailChange}
      />

      <AuthPasswordPair
        confirmPassword={confirmPassword}
        confirmPasswordId="auth-confirm-password"
        password={password}
        passwordId="auth-sign-up-password"
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
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
