import type { ApplicationData, SelectedCourse } from "../../../lib/applicationData";
import { createApplicationDraft } from "../../../lib/applicationRecords";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { ApplicationSummary } from "../../../lib/applicationRecords";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import { cloneSourceApplicationDocuments } from "./applicationDocumentClone";
import type { BeginCourseApplicationOptions } from "./useApplicationStorageOrchestration";

interface BeginCourseApplicationDeps {
  applications: ApplicationSummary[];
  data: ApplicationData;
  ensureApplicantProfile: () => Promise<StoredApplicantProfile | null>;
  openApplication: (applicationId: string) => Promise<void>;
  persistApplication: (
    nextData: ApplicationData,
    options?: {
      applicantProfileId?: string | null;
      forceCreate?: boolean;
      keepActive?: boolean;
    },
  ) => Promise<ApplicationData>;
  storageAdapter: ApplicationStorageAdapter;
  trackDraftCreated: (
    course: SelectedCourse,
    applicantProfileId: string | null,
    applicationId: string | null,
  ) => void;
  trackDraftResumed: (course: SelectedCourse, applicationId: string) => void;
}

export async function beginCourseApplication(
  course: SelectedCourse,
  options: BeginCourseApplicationOptions | undefined,
  deps: BeginCourseApplicationDeps,
) {
  const resolvedApplicantProfile = await deps.ensureApplicantProfile();
  const isStartingFromPreviousApplication = Boolean(
    !options?.startFresh && options?.prefillFromApplicationId,
  );
  const existingApplication = await deps.storageAdapter.findOpenDraftForCourse(
    course.code,
    deps.applications,
  );

  if (existingApplication?.id) {
    await deps.openApplication(existingApplication.id);
    const reopenedApplication =
      (await deps.storageAdapter.loadApplicationById(existingApplication.id)) ??
      deps.data;
    deps.trackDraftResumed(course, existingApplication.id);
    return reopenedApplication;
  }

  const reusableSourceApplication =
    !options?.startFresh && options?.prefillFromApplicationId
      ? deps.data.applicationMeta.recordId === options.prefillFromApplicationId
        ? deps.data
        : await deps.storageAdapter.loadApplicationById(
            options.prefillFromApplicationId,
          )
      : null;

  const draft = createApplicationDraft(
    course,
    resolvedApplicantProfile?.id ?? undefined,
    resolvedApplicantProfile,
    reusableSourceApplication,
    isStartingFromPreviousApplication
      ? { includeSourceDocuments: false }
      : undefined,
  );

  let persisted = await deps.persistApplication(draft, {
    applicantProfileId: resolvedApplicantProfile?.id ?? null,
    forceCreate: true,
  });

  if (isStartingFromPreviousApplication && reusableSourceApplication) {
    const clonedApplication = await cloneSourceApplicationDocuments(
      persisted,
      reusableSourceApplication,
    );

    persisted = await deps.persistApplication(clonedApplication, {
      applicantProfileId: resolvedApplicantProfile?.id ?? null,
    });
  }

  deps.trackDraftCreated(
    course,
    resolvedApplicantProfile?.id ?? null,
    persisted.applicationMeta.recordId ?? null,
  );

  return persisted;
}
