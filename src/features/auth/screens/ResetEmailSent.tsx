import { Button } from "../../../components/ui/button";

interface ResetEmailSentProps {
  onBackToSignIn: () => void;
}

export function ResetEmailSent({ onBackToSignIn }: ResetEmailSentProps) {
  return (
    <div className="space-y-4">
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
