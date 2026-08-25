import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

interface MfaChallengeFormProps {
  code: string;
  error: string | null;
  isSubmitting: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUseAnotherAccount: () => void;
}

export function MfaChallengeForm({
  code,
  error,
  isSubmitting,
  onCodeChange,
  onSubmit,
  onUseAnotherAccount,
}: MfaChallengeFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="auth-totp-code"
        >
          Authenticator code
        </label>
        <Input
          autoComplete="one-time-code"
          className="h-12 tracking-[0.45em]"
          disabled={isSubmitting}
          id="auth-totp-code"
          inputMode="numeric"
          maxLength={7}
          pattern="[0-9 ]*"
          placeholder="000000"
          required
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-[var(--error-text)]">{error}</p>
      ) : null}

      <Button
        className="h-12 w-full justify-center text-base"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Checking code..." : "Verify and continue"}
      </Button>

      <button
        className="w-full rounded-full text-sm font-medium text-[var(--cta-secondary)] hover:underline"
        disabled={isSubmitting}
        type="button"
        onClick={onUseAnotherAccount}
      >
        Use another account
      </button>
    </form>
  );
}
