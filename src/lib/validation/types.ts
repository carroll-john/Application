import type { ApplicationData } from "../applicationData";

export type ValidationTarget = "stepComplete" | "submissionReady";

export type StepCompletionLabel =
  | "Basic information"
  | "Personal contact details"
  | "Citizenship information"
  | "Address details"
  | "CV upload"
  | "Employment experience"
  | "Tertiary qualifications";

export interface ValidationIssue {
  section: string;
  subsection: string;
  field: string;
  path: string;
  stepLabel?: StepCompletionLabel;
}

export interface ValidationRule {
  section: string;
  subsection: string;
  field: string;
  path: string;
  stepLabel?: StepCompletionLabel;
  targets: ValidationTarget[];
  isMissing: (data: ApplicationData, target: ValidationTarget) => boolean;
}

export const SECTION_1 = "Section 1: Personal information";
export const SECTION_2 = "Section 2: Qualifications";
export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const stepCompletionOrder: StepCompletionLabel[] = [
  "Basic information",
  "Personal contact details",
  "Citizenship information",
  "Address details",
  "CV upload",
  "Employment experience",
  "Tertiary qualifications",
];
