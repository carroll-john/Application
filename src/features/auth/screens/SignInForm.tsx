import { Lock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { AuthEmailField } from "../components/AuthEmailField";

interface SignInFormProps {
  email: string;
  password: string;
  error: string | null;
  isSubmitting: boolean;
  isConfigured: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
}

export function SignInForm({
  email,
  password,
  error,
  isSubmitting,
  isConfigured,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: SignInFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <AuthEmailField id="auth-email" value={email} onChange={onEmailChange} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="auth-password">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoComplete="current-password"
            className="h-12 pl-11 text-base"
            id="auth-password"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm font-medium text-[var(--error-text)]">{error}</p>
      ) : null}

      <Button
        className="h-12 w-full justify-center text-base"
        disabled={isSubmitting || !isConfigured}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>

      <button
        className="w-full text-sm font-medium text-[var(--cta-secondary)] hover:underline"
        type="button"
        onClick={onForgotPassword}
      >
        Forgot password?
      </button>
    </form>
  );
}
