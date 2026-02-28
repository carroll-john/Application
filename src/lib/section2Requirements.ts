interface Section2RequirementInput {
  cvUploaded: boolean;
  employmentExperiencesCount: number;
  tertiaryQualificationsCount: number;
}

export function meetsSection2SubmissionRequirement({
  cvUploaded,
  employmentExperiencesCount,
  tertiaryQualificationsCount,
}: Section2RequirementInput) {
  return tertiaryQualificationsCount > 0 || (cvUploaded && employmentExperiencesCount > 0);
}

export function getSection2SubmissionMissingFields(
  input: Section2RequirementInput,
) {
  if (meetsSection2SubmissionRequirement(input)) {
    return [];
  }

  const missingFields: string[] = [];

  if (!input.cvUploaded) {
    missingFields.push("CV upload or a tertiary qualification");
  }

  if (input.employmentExperiencesCount === 0) {
    missingFields.push("Employment experience or a tertiary qualification");
  }

  return missingFields;
}
