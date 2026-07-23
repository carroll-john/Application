import type { ApplicationData, SelectedCourse } from "../../../lib/applicationData";
import { createApplicationDraft } from "../../../lib/applicationRecords";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { ApplicationSummary } from "../../../lib/applicationRecords";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import { cloneSourceApplicationDocuments } from "./applicationDocumentClone";
import type { BeginCourseApplicationOptions } from "./useApplicationStorageOrchestration";
import { applyUcCvPrefill } from "../../../lib/ucRplAssessment";
import { applyUcTranscriptApplicationPrefill } from "../../../lib/ucTranscriptApplicationPrefill";
import { replaceStoredDocument } from "../../../lib/documentStorage";

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

function applyUcPrefills(
  application: ApplicationData,
  options: BeginCourseApplicationOptions | undefined,
) {
  const cvPrefilled = options?.ucCvPrefill
    ? applyUcCvPrefill(
        application,
        options.ucCvPrefill,
        options.authenticatedEmail ?? null,
      )
    : application;

  return options?.ucTranscriptPrefill
    ? applyUcTranscriptApplicationPrefill(
        cvPrefilled,
        options.ucTranscriptPrefill,
      )
    : cvPrefilled;
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
    const loadedApplication =
      (await deps.storageAdapter.loadApplicationById(existingApplication.id)) ?? deps.data;
    const applicationWithPrefill = applyUcPrefills(loadedApplication, options);
    let reopenedApplication =
      applicationWithPrefill !== loadedApplication
      ? await deps.storageAdapter.saveApplication(
          applicationWithPrefill,
        )
      : loadedApplication;

    if (options?.cvFile) {
      const cvDocument = await replaceStoredDocument(
        options.cvFile,
        reopenedApplication.cvDocument,
        { applicationId: existingApplication.id, kind: "cv" },
      );
      reopenedApplication = await deps.storageAdapter.saveApplication({
        ...reopenedApplication,
        cvDocument,
        cvFileName: cvDocument?.name,
        cvUploaded: Boolean(cvDocument),
      });
    }
    await deps.openApplication(existingApplication.id);
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

  const baseDraft = createApplicationDraft(
    course,
    resolvedApplicantProfile?.id ?? undefined,
    resolvedApplicantProfile,
    reusableSourceApplication,
    isStartingFromPreviousApplication
      ? { includeSourceDocuments: false }
      : undefined,
  );
  const draft = applyUcPrefills(baseDraft, options);

  let persisted = await deps.persistApplication(draft, {
    applicantProfileId: resolvedApplicantProfile?.id ?? null,
    forceCreate: true,
  });

  if (options?.cvFile && persisted.applicationMeta.recordId) {
    const cvDocument = await replaceStoredDocument(options.cvFile, undefined, {
      applicationId: persisted.applicationMeta.recordId,
      kind: "cv",
    });

    persisted = await deps.persistApplication({
      ...persisted,
      cvDocument,
      cvFileName: cvDocument?.name,
      cvUploaded: Boolean(cvDocument),
    });
  }

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
