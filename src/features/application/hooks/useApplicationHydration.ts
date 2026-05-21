import {
  initialApplicationData,
  type ApplicationData,
} from "../../../lib/applicationData";
import {
  loadLocalActiveApplicationId,
  saveLocalActiveApplicationId,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";

interface HydrateApplicationStateOptions {
  ensureApplicantProfile: () => Promise<StoredApplicantProfile | null>;
  isMounted: () => boolean;
  setActiveApplicationId: (applicationId: string | null) => void;
  setApplications: (applications: ApplicationSummary[]) => void;
  setData: (application: ApplicationData) => void;
  storageAdapter: ApplicationStorageAdapter;
}

export async function hydrateApplicationState({
  ensureApplicantProfile,
  isMounted,
  setActiveApplicationId,
  setApplications,
  setData,
  storageAdapter,
}: HydrateApplicationStateOptions) {
  await ensureApplicantProfile();

  if (!isMounted()) {
    return;
  }

  const loadedApplications = await storageAdapter.listApplications();

  if (!isMounted()) {
    return;
  }

  setApplications(loadedApplications);

  const preferredId =
    loadLocalActiveApplicationId() ??
    loadedApplications.find((application) => application.status === "draft")
      ?.id ??
    loadedApplications[0]?.id ??
    null;

  if (!preferredId) {
    setActiveApplicationId(null);
    setData(initialApplicationData);
    return;
  }

  let resolvedPreferredId = preferredId;
  let application = await storageAdapter.loadApplicationById(resolvedPreferredId);

  if (!application) {
    const fallbackId =
      loadedApplications.find(
        (loadedApplication) => loadedApplication.id !== resolvedPreferredId,
      )?.id ?? null;

    if (!fallbackId) {
      setActiveApplicationId(null);
      setData(initialApplicationData);
      return;
    }

    resolvedPreferredId = fallbackId;
    application = await storageAdapter.loadApplicationById(resolvedPreferredId);
  }

  if (!application) {
    setActiveApplicationId(null);
    setData(initialApplicationData);
    return;
  }

  if (!isMounted()) {
    return;
  }

  setActiveApplicationId(resolvedPreferredId);
  saveLocalActiveApplicationId(resolvedPreferredId);
  setData(application);
  storageAdapter.syncLoadedApplication(application);
}
