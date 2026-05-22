import { Lock } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { AUTH_MIN_PASSWORD_LENGTH } from "../../../lib/authPassword";

interface AuthPasswordPairProps {
  passwordId: string;
  confirmPasswordId: string;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  passwordLabel?: string;
  confirmPasswordLabel?: string;
  passwordPlaceholder?: string;
  confirmPasswordPlaceholder?: string;
  layout?: "stacked" | "profile";
}

export function AuthPasswordPair({
  passwordId,
  confirmPasswordId,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  passwordLabel = "Password",
  confirmPasswordLabel = "Confirm password",
  passwordPlaceholder = `At least ${AUTH_MIN_PASSWORD_LENGTH} characters`,
  confirmPasswordPlaceholder = "Re-enter your password",
  layout = "stacked",
}: AuthPasswordPairProps) {
  const fieldClassName =
    layout === "profile" ? "space-y-2 sm:col-span-2" : "space-y-2";

  return (
    <>
      <div className={fieldClassName}>
        <label className="text-sm font-medium text-slate-800" htmlFor={passwordId}>
          {passwordLabel}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoComplete="new-password"
            className="h-12 pl-11 text-base"
            id={passwordId}
            minLength={AUTH_MIN_PASSWORD_LENGTH}
            placeholder={passwordPlaceholder}
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </div>
      </div>

      <div className={fieldClassName}>
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor={confirmPasswordId}
        >
          {confirmPasswordLabel}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoComplete="new-password"
            className="h-12 pl-11 text-base"
            id={confirmPasswordId}
            minLength={AUTH_MIN_PASSWORD_LENGTH}
            placeholder={confirmPasswordPlaceholder}
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
          />
        </div>
      </div>
    </>
  );
}
