import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";

interface UseApplicationProfileOptions {
  userEmail: string | null;
  storageAdapter: ApplicationStorageAdapter;
}

export function useApplicationProfile({
  userEmail,
  storageAdapter,
}: UseApplicationProfileOptions) {
  const [applicantProfile, setApplicantProfileState] =
    useState<StoredApplicantProfile | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setApplicantProfile = useCallback(
    (profile: StoredApplicantProfile | null) => {
      if (!isMountedRef.current) {
        return;
      }

      setApplicantProfileState(profile);
    },
    [],
  );

  const ensureApplicantProfile = useCallback(async () => {
    const profile = await storageAdapter.ensureApplicantProfile(
      userEmail ?? undefined,
    );
    setApplicantProfile(profile);
    return profile;
  }, [setApplicantProfile, storageAdapter, userEmail]);

  const refreshApplicantProfile = useCallback(async () => {
    const profile = await storageAdapter.loadApplicantProfile(
      userEmail ?? undefined,
    );
    setApplicantProfile(profile);
  }, [setApplicantProfile, storageAdapter, userEmail]);

  return {
    applicantProfile,
    applicantProfileId: applicantProfile?.id ?? null,
    ensureApplicantProfile,
    refreshApplicantProfile,
    setApplicantProfile,
  };
}
