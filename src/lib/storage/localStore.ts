import {
  type ApplicationData,
  type SelectedCourse,
} from "../applicationData";
import { getStepCompletionSummary } from "../applicationValidationSchema";

export { createApplicationDraft } from "./applicationDraft";
export {
  ACTIVE_APPLICATION_ID_STORAGE_KEY,
  loadLocalActiveApplicationId,
  saveLocalActiveApplicationId,
} from "./activeApplication";

export interface ApplicationSummary {
  applicationNumber?: string;
  completedStepCount: number;
  completionPercentage: number;
  course: SelectedCourse;
  id: string;
  status: "draft" | "submitted";
  submittedAt?: string;
  totalStepCount: number;
  updatedAt: string;
}

export function summarizeApplication(
  application: ApplicationData,
): ApplicationSummary | null {
  const recordId = application.applicationMeta.recordId;
  const selectedCourse = application.applicationMeta.selectedCourse;

  if (!recordId || !selectedCourse) {
    return null;
  }

  const stepCompletionSummary = getStepCompletionSummary(application);

  return {
    applicationNumber: application.applicationMeta.applicationNumber,
    completedStepCount: stepCompletionSummary.completedSteps,
    completionPercentage: stepCompletionSummary.completionPercentage,
    course: selectedCourse,
    id: recordId,
    status: application.applicationMeta.submittedAt ? "submitted" : "draft",
    submittedAt: application.applicationMeta.submittedAt,
    totalStepCount: stepCompletionSummary.totalSteps,
    updatedAt:
      application.applicationMeta.updatedAt ??
      application.applicationMeta.createdAt ??
      new Date().toISOString(),
  };
}

export function sortApplicationsForPrefillChooser(
  applications: ApplicationSummary[],
  targetCourseCode: string,
  activeApplicationId?: string | null,
) {
  return applications
    .filter((application) => application.course.code !== targetCourseCode)
    .sort((left, right) => {
      if (right.completionPercentage !== left.completionPercentage) {
        return right.completionPercentage - left.completionPercentage;
      }

      if (right.completedStepCount !== left.completedStepCount) {
        return right.completedStepCount - left.completedStepCount;
      }

      const leftSubmittedRank = Number(left.status === "submitted");
      const rightSubmittedRank = Number(right.status === "submitted");

      if (rightSubmittedRank !== leftSubmittedRank) {
        return rightSubmittedRank - leftSubmittedRank;
      }

      if (left.id === activeApplicationId) {
        return -1;
      }

      if (right.id === activeApplicationId) {
        return 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}
