import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  ProfileDetailsFields,
  ProfileLoadingState,
  ProfilePage,
} from "../features/profile";
import {
  ensureApplicantProfile,
  saveApplicantProfile,
  type StoredApplicantProfile,
} from "../lib/applicantProfileStore";

export default function ApplicantProfile() {
  const navigate = useNavigate();
  const { refreshApplicantProfile } = useApplication();
  const { session, signOut, userDisplayName, userEmail } = useAuth();
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
    userDisplayName || userEmail || "your applicant account";

  const applyProfile = useCallback(
    (profile: StoredApplicantProfile | null) => {
      const fallbackEmail = userEmail ?? "";

      setProfileRecordId(profile?.id);
      setEmail(profile?.email ?? fallbackEmail);
      setFirstName(profile?.firstName ?? "");
      setLastName(profile?.lastName ?? "");
    },
    [userEmail],
  );

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
        session,
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
      <ProfileDetailsFields
        email={email}
        errors={errors}
        firstName={firstName}
        isSubmitting={isSubmitting}
        lastName={lastName}
        statusMessage={statusMessage}
        onEmailChange={setEmail}
        onFirstNameChange={setFirstName}
        onGoToDashboard={() => navigate("/dashboard")}
        onLastNameChange={setLastName}
        onSave={() => void handleSave()}
      />
    </ProfilePage>
  );
}
