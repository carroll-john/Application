import { useCallback } from "react";
import type { ApplicationData, SelectedCourse } from "../../../lib/applicationData";
import {
  associateCourseProviderGroup,
  capturePostHogEvent,
  getApplicationAnalyticsProperties,
  getCourseAnalyticsProperties,
} from "../../../lib/posthog";

type DataEventProperties =
  | Record<string, unknown>
  | ((application: ApplicationData) => Record<string, unknown>);

export function useApplicationAnalytics() {
  const trackDraftResumed = useCallback(
    (course: SelectedCourse, applicationId: string) => {
      associateCourseProviderGroup(course.provider);
      capturePostHogEvent("application_draft_resumed", {
        ...getCourseAnalyticsProperties(course),
        application_id: applicationId,
        storage_mode: "remote",
      });
    },
    [],
  );

  const trackDraftCreated = useCallback(
    (
      course: SelectedCourse,
      applicantProfileId: string | null,
      applicationId: string | null,
    ) => {
      associateCourseProviderGroup(course.provider);
      capturePostHogEvent("application_draft_created", {
        ...getCourseAnalyticsProperties(course),
        applicant_profile_id: applicantProfileId,
        application_id: applicationId,
        storage_mode: "remote",
      });
    },
    [],
  );

  const trackApplicationDataEvent = useCallback(
    (
      eventName: string,
      persistedApplication: ApplicationData,
      properties?: DataEventProperties,
    ) => {
      const extraProperties =
        typeof properties === "function"
          ? properties(persistedApplication)
          : properties;

      capturePostHogEvent(eventName, {
        ...getApplicationAnalyticsProperties(persistedApplication),
        ...extraProperties,
      });
    },
    [],
  );

  const trackApplicationSubmitted = useCallback(
    (submittedApplication: ApplicationData) => {
      capturePostHogEvent("application_submitted", {
        ...getCourseAnalyticsProperties(
          submittedApplication.applicationMeta.selectedCourse,
        ),
        application_id: submittedApplication.applicationMeta.recordId ?? null,
        application_number:
          submittedApplication.applicationMeta.applicationNumber ?? null,
        submission_mode: "remote",
      });
    },
    [],
  );

  return {
    trackApplicationDataEvent,
    trackApplicationSubmitted,
    trackDraftCreated,
    trackDraftResumed,
  };
}
