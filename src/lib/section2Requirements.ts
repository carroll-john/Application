import {
  getSection2SubmissionMissingFields as getSchemaSection2SubmissionMissingFields,
  meetsSection2SubmissionRequirement as meetsSchemaSection2SubmissionRequirement,
  type Section2RequirementInput,
} from "./applicationValidationSchema";

export function meetsSection2SubmissionRequirement(
  input: Section2RequirementInput,
) {
  return meetsSchemaSection2SubmissionRequirement(input);
}

export function getSection2SubmissionMissingFields(
  input: Section2RequirementInput,
) {
  return getSchemaSection2SubmissionMissingFields(input);
}
