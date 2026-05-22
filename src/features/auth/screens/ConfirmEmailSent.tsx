import { Button } from "../../../components/ui/button";

interface ConfirmEmailSentProps {
  onBackToSignIn: () => void;
}

export function ConfirmEmailSent({ onBackToSignIn }: ConfirmEmailSentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        After confirming your email, switch to Sign in and use the password you
        just created.
      </div>
      <Button
        className="h-12 w-full justify-center text-base"
        type="button"
        variant="outline"
        onClick={onBackToSignIn}
      >
        Back to sign in
      </Button>
    </div>
  );
}
