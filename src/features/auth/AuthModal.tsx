import { ModalShell } from "../../components/ModalShell";
import { AuthPanel } from "./AuthPanel";

interface AuthModalProps {
  context?: "apply" | "eligibility" | "header" | "route";
  onAuthenticated: () => void;
  onClose: () => void;
  signUpRedirectPath?: string;
}

export function AuthModal({
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
        context={context}
        onAuthenticated={onAuthenticated}
        signUpRedirectPath={signUpRedirectPath}
      />
    </ModalShell>
  );
}
