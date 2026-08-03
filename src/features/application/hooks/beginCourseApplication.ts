import type { ApplicationData, SelectedCourse } from "../../../lib/applicationData";
import { createApplicationDraft } from "../../../lib/applicationRecords";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { ApplicationSummary } from "../../../lib/applicationRecords";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import type { AssessmentStorageAdapter } from "../../../lib/assessment/storageAdapter";
import type { AssessmentSessionSnapshot } from "../../../lib/assessment/types";
import { applyUcCvPrefill } from "../../../lib/ucRplAssessment";
import { applyUcTranscriptApplicationPrefill } from "../../../lib/ucTranscriptApplicationPrefill";
import { cloneSourceApplicationDocuments } from "./applicationDocumentClone";
import type { BeginCourseApplicationOptions } from "./useApplicationStorageOrchestration";

interface BeginCourseApplicationDeps {
  applications: ApplicationSummary[];
  assessmentStorageAdapter: AssessmentStorageAdapter;
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

function applyAssessmentPrefills(
  application: ApplicationData,
  session: AssessmentSessionSnapshot | null,
  authenticatedEmail: string | null,
) {
  if (!session) return application;
  const cvPrefilled = session.confirmedCv
    ? applyUcCvPrefill(application, session.confirmedCv, authenticatedEmail)
    : application;

  return session.transcriptAssessment
    ? applyUcTranscriptApplicationPrefill(cvPrefilled, session.transcriptAssessment, {
        cvQualificationsToReplace: session.confirmedCv?.tertiaryQualifications,
      })
    : cvPrefilled;
}

async function loadAssessmentSession(
  options: BeginCourseApplicationOptions | undefined,
  deps: BeginCourseApplicationDeps,
) {
  if (!options?.assessmentSessionId) return null;
  const session = await deps.assessmentStorageAdapter.loadSession(
    options.assessmentSessionId,
  );
  if (session.cohort !== "treatment" || session.status !== "evaluated") {
    throw new Error("Complete the treatment assessment before starting an application.");
  }
  return session;
}

async function promoteAssessment(
  assessment: AssessmentSessionSnapshot | null,
  application: ApplicationData,
  deps: BeginCourseApplicationDeps,
) {
  const applicationId = application.applicationMeta.recordId;
  if (!assessment || !applicationId) return application;

  await deps.assessmentStorageAdapter.promoteToApplication(
    assessment.id,
    applicationId,
  );
  return (await deps.storageAdapter.loadApplicationById(applicationId)) ?? application;
}

export async function beginCourseApplication(
  course: SelectedCourse,
  options: BeginCourseApplicationOptions | undefined,
  deps: BeginCourseApplicationDeps,
) {
  const [resolvedApplicantProfile, assessment] = await Promise.all([
    deps.ensureApplicantProfile(),
    loadAssessmentSession(options, deps),
  ]);
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
    const applicationWithPrefill = applyAssessmentPrefills(
      loadedApplication,
      assessment,
      options?.authenticatedEmail ?? null,
    );
    const reopenedApplication =
      applicationWithPrefill !== loadedApplication
        ? await deps.storageAdapter.saveApplication(applicationWithPrefill)
        : loadedApplication;
    const promoted = await promoteAssessment(assessment, reopenedApplication, deps);
    await deps.openApplication(existingApplication.id);
    deps.trackDraftResumed(course, existingApplication.id);
    return promoted;
  }

  const reusableSourceApplication =
    !options?.startFresh && options?.prefillFromApplicationId
      ? deps.data.applicationMeta.recordId === options.prefillFromApplicationId
        ? deps.data
        : await deps.storageAdapter.loadApplicationById(options.prefillFromApplicationId)
      : null;
  const baseDraft = createApplicationDraft(
    course,
    resolvedApplicantProfile?.id ?? undefined,
    resolvedApplicantProfile,
    reusableSourceApplication,
    isStartingFromPreviousApplication ? { includeSourceDocuments: false } : undefined,
  );
  const draft = applyAssessmentPrefills(
    baseDraft,
    assessment,
    options?.authenticatedEmail ?? null,
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

  persisted = await promoteAssessment(assessment, persisted, deps);
  deps.trackDraftCreated(
    course,
    resolvedApplicantProfile?.id ?? null,
    persisted.applicationMeta.recordId ?? null,
  );
  return persisted;
}
