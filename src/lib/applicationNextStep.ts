import type { ApplicationData } from "./applicationData";
import { getNextIncompleteStep } from "./applicationValidationSchema";

export function getNextIncompleteSection(data: ApplicationData): string | null {
  return getNextIncompleteStep(data);
}
