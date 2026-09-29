import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationOperationScope } from "./applicationOperationScope";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";

interface UseApplicationProfileOptions {
  userEmail: string | null;
  operationScope: ApplicationOperationScope;
  storageAdapter: ApplicationStorageAdapter;
}

export function useApplicationProfile({
  userEmail,
  operationScope,
  storageAdapter,
}: UseApplicationProfileOptions) {
  const [applicantProfile, setApplicantProfileState] =
    useState<StoredApplicantProfile | null>(null);
  const [stateScope, setStateScope] = useState(operationScope);
  if (stateScope !== operationScope) {
    setStateScope(operationScope);
    setApplicantProfileState(null);
  }
  const requestIdRef = useRef(0);
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
    const isCurrentSession = operationScope.captureSession();
    const requestId = ++requestIdRef.current;
    const profile = await storageAdapter.ensureApplicantProfile(
      userEmail ?? undefined,
    );
    if (isCurrentSession() && requestId === requestIdRef.current) {
      setApplicantProfile(profile);
    }
    return profile;
  }, [operationScope, setApplicantProfile, storageAdapter, userEmail]);

  const refreshApplicantProfile = useCallback(async () => {
    const isCurrentSession = operationScope.captureSession();
    const requestId = ++requestIdRef.current;
    const profile = await storageAdapter.loadApplicantProfile(
      userEmail ?? undefined,
    );
    if (isCurrentSession() && requestId === requestIdRef.current) {
      setApplicantProfile(profile);
    }
  }, [operationScope, setApplicantProfile, storageAdapter, userEmail]);

  return {
    applicantProfile,
    applicantProfileId: applicantProfile?.id ?? null,
    ensureApplicantProfile,
    refreshApplicantProfile,
    setApplicantProfile,
  };
}
