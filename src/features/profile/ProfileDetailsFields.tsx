import { Mail } from "lucide-react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

interface ProfileDetailsFieldsProps {
  email: string;
  errors: {
    firstName?: string;
    form?: string;
    lastName?: string;
  };
  firstName: string;
  isSubmitting: boolean;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onGoToDashboard: () => void;
  onLastNameChange: (value: string) => void;
  onSave: () => void;
  statusMessage: string | null;
}

export function ProfileDetailsFields({
  email,
  errors,
  firstName,
  isSubmitting,
  lastName,
  onFirstNameChange,
  onGoToDashboard,
  onLastNameChange,
  onSave,
  statusMessage,
}: ProfileDetailsFieldsProps) {
  return (
    <SurfaceCard className="max-w-3xl p-6 sm:p-8">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Reusable applicant details
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-email"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="email"
                className="h-12 pl-11 text-base"
                id="profile-email"
                readOnly
                type="email"
                value={email}
              />
            </div>
            <p className="text-sm text-slate-500">
              This is your sign-in email. Use forgot password on the sign-in
              page if you need to reset access.
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-first-name"
            >
              First name
            </label>
            <Input
              autoComplete="given-name"
              className="h-12 text-base"
              id="profile-first-name"
              value={firstName}
              onChange={(event) => onFirstNameChange(event.target.value)}
            />
            {errors.firstName ? (
              <p className="text-sm font-medium text-[var(--error-text)]">
                {errors.firstName}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="profile-last-name"
            >
              Last name
            </label>
            <Input
              autoComplete="family-name"
              className="h-12 text-base"
              id="profile-last-name"
              value={lastName}
              onChange={(event) => onLastNameChange(event.target.value)}
            />
            {errors.lastName ? (
              <p className="text-sm font-medium text-[var(--error-text)]">
                {errors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        {errors.form ? (
          <p className="text-sm font-medium text-[var(--error-text)]">
            {errors.form}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="text-sm font-medium text-[var(--success-text)]">
            {statusMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className="sm:min-w-[180px]"
            type="button"
            variant="outline"
            onClick={onGoToDashboard}
          >
            Go to dashboard
          </Button>
          <Button
            className="sm:min-w-[220px]"
            disabled={isSubmitting}
            type="button"
            onClick={onSave}
          >
            {isSubmitting ? "Updating..." : "Update profile"}
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}
