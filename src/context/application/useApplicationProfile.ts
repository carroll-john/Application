import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationStorageAdapter } from "../../lib/applicationStorageAdapter";
import type { StoredApplicantProfile } from "../../lib/applicantProfileStore";

interface UseApplicationProfileOptions {
  companyUserEmail: string | null;
  storageAdapter: ApplicationStorageAdapter;
}

export function useApplicationProfile({
  companyUserEmail,
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
      companyUserEmail ?? undefined,
    );
    setApplicantProfile(profile);
    return profile;
  }, [companyUserEmail, setApplicantProfile, storageAdapter]);

  const refreshApplicantProfile = useCallback(async () => {
    const profile = await storageAdapter.loadApplicantProfile(
      companyUserEmail ?? undefined,
    );
    setApplicantProfile(profile);
  }, [companyUserEmail, setApplicantProfile, storageAdapter]);

  return {
    applicantProfile,
    applicantProfileId: applicantProfile?.id ?? null,
    ensureApplicantProfile,
    refreshApplicantProfile,
    setApplicantProfile,
  };
}
