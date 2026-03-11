import type { StepCompletionLabel } from "./applicationValidationSchema";
import type { ApplicationData } from "./applicationData";
import { getNextIncompleteStep } from "./applicationValidationSchema";

export function getNextIncompleteSection(
  data: ApplicationData,
): StepCompletionLabel | null {
  return getNextIncompleteStep(data);
}
