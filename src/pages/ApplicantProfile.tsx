import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  ProfileDetailsFields,
  ProfileLoadingState,
  ProfileMfaSection,
  ProfilePage,
  ProfilePasswordSection,
} from "../features/profile";
import {
  ensureApplicantProfile,
  saveApplicantProfile,
  type StoredApplicantProfile,
} from "../lib/applicantProfileStore";
import { supabase } from "../lib/supabase";

export default function ApplicantProfile() {
  const navigate = useNavigate();
  const { refreshApplicantProfile } = useApplication();
  const { changePassword, session, signOut, userDisplayName, userEmail } =
    useAuth();
  const [profileRecordId, setProfileRecordId] = useState<string | undefined>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<{
    firstName?: string;
    form?: string;
    lastName?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const signedInLabel =
    userDisplayName || userEmail || "your applicant account";
  const accountEmail = userEmail ?? "";

  const applyProfile = useCallback((profile: StoredApplicantProfile | null) => {
    setProfileRecordId(profile?.id);
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      try {
        const profile = await ensureApplicantProfile(
          session,
          userEmail ?? undefined,
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
  }, [applyProfile, session, userEmail]);

  async function handleSave() {
    const nextErrors: typeof errors = {};

    if (!accountEmail) {
      nextErrors.form = "Your sign-in email is unavailable. Try signing in again.";
    }

    if (!firstName.trim()) {
      nextErrors.firstName = "Enter your first name.";
    }

    if (!lastName.trim()) {
      nextErrors.lastName = "Enter your last name.";
    }

    if (nextErrors.firstName || nextErrors.lastName || nextErrors.form) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const savedProfile = await saveApplicantProfile(
        session,
        {
          email: accountEmail,
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
    return <ProfileLoadingState />;
  }

  return (
    <ProfilePage
      signedInLabel={signedInLabel}
      onSignOut={async () => {
        await signOut();
        navigate("/", { replace: true });
      }}
    >
      <div className="space-y-6">
        <ProfileDetailsFields
          email={accountEmail}
          errors={errors}
          firstName={firstName}
          isSubmitting={isSubmitting}
          lastName={lastName}
          statusMessage={statusMessage}
          onFirstNameChange={setFirstName}
          onGoToDashboard={() => navigate("/dashboard")}
          onLastNameChange={setLastName}
          onSave={() => void handleSave()}
        />
        <ProfilePasswordSection onChangePassword={changePassword} />
        {supabase ? <ProfileMfaSection mfa={supabase.auth.mfa} /> : null}
      </div>
    </ProfilePage>
  );
}
