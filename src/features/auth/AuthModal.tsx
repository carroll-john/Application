import { ModalShell } from "../../components/ModalShell";
import { AuthPanel } from "./AuthPanel";

interface AuthModalProps {
  allowSignUp?: boolean;
  context?: "apply" | "eligibility" | "header" | "route";
  onAuthenticated: () => void;
  onClose: () => void;
  signUpRedirectPath?: string;
}

export function AuthModal({
  allowSignUp,
  context,
  onAuthenticated,
  onClose,
  signUpRedirectPath,
}: AuthModalProps) {
  return (
    <ModalShell
      maxWidthClassName="max-w-md"
      onClose={onClose}
      title="Sign in to continue"
    >
      <AuthPanel
        allowSignUp={allowSignUp}
        context={context}
        onAuthenticated={onAuthenticated}
        signUpRedirectPath={signUpRedirectPath}
      />
    </ModalShell>
  );
}
