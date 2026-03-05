import type { ApplicationData } from "./applicationData";
import {
  getSubmissionValidationIssues,
  type ValidationIssue,
} from "./applicationValidationSchema";

export type ValidationError = ValidationIssue;

export function validateApplication(data: ApplicationData) {
  return getSubmissionValidationIssues(data);
}
