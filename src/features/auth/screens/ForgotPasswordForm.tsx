import { Button } from "../../../components/ui/button";
import { AuthEmailField } from "../components/AuthEmailField";

interface ForgotPasswordFormProps {
  email: string;
  error: string | null;
  isSubmitting: boolean;
  isConfigured: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBackToSignIn: () => void;
}

export function ForgotPasswordForm({
  email,
  error,
  isSubmitting,
  isConfigured,
  onEmailChange,
  onSubmit,
  onBackToSignIn,
}: ForgotPasswordFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <AuthEmailField
        id="auth-reset-email"
        value={email}
        onChange={onEmailChange}
      />

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
        onClick={onBackToSignIn}
      >
        Back to sign in
      </button>
    </form>
  );
}
