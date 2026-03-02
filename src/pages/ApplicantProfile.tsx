import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import {
  ensureApplicantProfile,
  saveApplicantProfile,
  type StoredApplicantProfile,
} from "../lib/applicantProfileStore";

export default function ApplicantProfile() {
  const navigate = useNavigate();
  const { refreshApplicantProfile } = useApplication();
  const {
    companyUserDisplayName,
    companyUserEmail,
    signOut,
  } = useAuth();
  const [profileRecordId, setProfileRecordId] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    firstName?: string;
    form?: string;
    lastName?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const signedInLabel =
    companyUserDisplayName || companyUserEmail || "your Keypath account";

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      try {
        const profile = await ensureApplicantProfile(
          null,
          companyUserEmail ?? undefined,
        );

        if (isCancelled) {
          return;
        }

        applyProfile(profile);
      } catch {
        if (isCancelled) {
          return;
        }

        setErrors({
          form: "We couldn't load your profile right now. Try again.",
        });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [companyUserEmail]);

  function applyProfile(profile: StoredApplicantProfile | null) {
    const fallbackEmail = companyUserEmail ?? "";

    setProfileRecordId(profile?.id);
    setEmail(profile?.email ?? fallbackEmail);
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }

  async function handleSave() {
    const trimmedEmail = email.trim().toLowerCase();
    const nextErrors: typeof errors = {};

    if (!trimmedEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!firstName.trim()) {
      nextErrors.firstName = "Enter your first name.";
    }

    if (!lastName.trim()) {
      nextErrors.lastName = "Enter your last name.";
    }

    if (nextErrors.email || nextErrors.firstName || nextErrors.lastName) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const savedProfile = await saveApplicantProfile(
        null,
        {
          email: trimmedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
        profileRecordId,
      );

      applyProfile(savedProfile);
      await refreshApplicantProfile();
      setStatusMessage(
        "Profile updated. New applications will use these details by default.",
      );
    } catch {
      setErrors({
        form: "We couldn't update your profile right now. Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f4]">
        <AppBrandHeader maxWidthClassName="max-w-5xl" />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <SurfaceCard className="w-full max-w-xl p-8 text-center text-slate-600">
            Loading your profile...
          </SurfaceCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
              Profile
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Update the reusable details you want to start new applications
              with. Existing applications keep the details they were created
              with.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Signed in as {signedInLabel}
            </p>
          </div>
          <Button
            className="sm:min-w-[160px]"
            type="button"
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            Log out
          </Button>
        </div>

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
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                {errors.email ? (
                  <p className="text-sm font-medium text-[var(--error-text)]">
                    {errors.email}
                  </p>
                ) : null}
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
                  onChange={(event) => setFirstName(event.target.value)}
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
                  onChange={(event) => setLastName(event.target.value)}
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
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </Button>
              <Button
                className="sm:min-w-[220px]"
                disabled={isSubmitting}
                type="button"
                onClick={() => void handleSave()}
              >
                {isSubmitting ? "Updating..." : "Update profile"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
