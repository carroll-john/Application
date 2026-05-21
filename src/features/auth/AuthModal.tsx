import { ModalShell } from "../../components/ModalShell";
import { AuthPanel } from "./AuthPanel";

interface AuthModalProps {
  context?: "apply" | "eligibility" | "header" | "route";
  onAuthenticated: () => void;
  onClose: () => void;
}

export function AuthModal({
  context,
  onAuthenticated,
  onClose,
}: AuthModalProps) {
  return (
    <ModalShell
      maxWidthClassName="max-w-md"
      onClose={onClose}
      title="Sign in to continue"
    >
      <AuthPanel context={context} onAuthenticated={onAuthenticated} />
    </ModalShell>
  );
}
