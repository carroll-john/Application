import {
  canonicalApplicationVersion,
  transferPackageManifestVersion,
  type SchemaVersion,
} from "./contracts.ts";

export interface SchemaFieldDescriptor {
  path: string;
  type: string;
  required: boolean;
}

export interface SchemaSnapshot {
  schemaName: string;
  version: SchemaVersion;
  minimumReaderVersion: SchemaVersion;
  fields: SchemaFieldDescriptor[];
}

export interface SchemaCompatibilityIssue {
  path: string;
  message: string;
}

export interface SchemaCompatibilityResult {
  compatible: boolean;
  issues: SchemaCompatibilityIssue[];
}

export interface SchemaCompatibilityFixture {
  name: string;
  description: string;
  baseline: SchemaSnapshot;
  candidate: SchemaSnapshot;
  expectedCompatible: boolean;
  expectedIssueMessages?: string[];
}

function compareVersions(
  left: SchemaVersion,
  right: SchemaVersion,
): number {
  const [leftMajor, leftMinor, leftPatch] = left.split(".").map(Number);
  const [rightMajor, rightMinor, rightPatch] = right.split(".").map(Number);

  if (leftMajor !== rightMajor) {
    return leftMajor - rightMajor;
  }

  if (leftMinor !== rightMinor) {
    return leftMinor - rightMinor;
  }

  return leftPatch - rightPatch;
}

function toFieldMap(
  fields: SchemaFieldDescriptor[],
): Map<string, SchemaFieldDescriptor> {
  return new Map(fields.map((field) => [field.path, field]));
}

function validateSnapshot(snapshot: SchemaSnapshot): SchemaCompatibilityIssue[] {
  const issues: SchemaCompatibilityIssue[] = [];
  const seenPaths = new Set<string>();

  snapshot.fields.forEach((field) => {
    if (seenPaths.has(field.path)) {
      issues.push({
        path: field.path,
        message: `Duplicate field path "${field.path}" in ${snapshot.schemaName}.`,
      });
      return;
    }

    seenPaths.add(field.path);
  });

  return issues;
}

export function validateSchemaCompatibility(
  baseline: SchemaSnapshot,
  candidate: SchemaSnapshot,
): SchemaCompatibilityResult {
  const issues: SchemaCompatibilityIssue[] = [
    ...validateSnapshot(baseline),
    ...validateSnapshot(candidate),
  ];

  if (baseline.schemaName !== candidate.schemaName) {
    issues.push({
      path: "schemaName",
      message: `Schema name changed from ${baseline.schemaName} to ${candidate.schemaName}.`,
    });
  }

  if (compareVersions(candidate.version, baseline.version) < 0) {
    issues.push({
      path: "version",
      message: `Candidate version ${candidate.version} must not be older than baseline ${baseline.version}.`,
    });
  }

  if (compareVersions(candidate.minimumReaderVersion, baseline.minimumReaderVersion) > 0) {
    issues.push({
      path: "minimumReaderVersion",
      message:
        `Candidate minimumReaderVersion ${candidate.minimumReaderVersion} is stricter than baseline ${baseline.minimumReaderVersion}.`,
    });
  }

  const candidateFields = toFieldMap(candidate.fields);

  baseline.fields.forEach((baselineField) => {
    const candidateField = candidateFields.get(baselineField.path);

    if (!candidateField) {
      issues.push({
        path: baselineField.path,
        message: `Missing previously supported field "${baselineField.path}".`,
      });
      return;
    }

    if (candidateField.type !== baselineField.type) {
      issues.push({
        path: baselineField.path,
        message:
          `Field "${baselineField.path}" changed type from ${baselineField.type} to ${candidateField.type}.`,
      });
    }

    if (!baselineField.required && candidateField.required) {
      issues.push({
        path: baselineField.path,
        message:
          `Field "${baselineField.path}" became required but was optional in the baseline schema.`,
      });
    }
  });

  return {
    compatible: issues.length === 0,
    issues,
  };
}

export const canonicalApplicationSnapshotV1: SchemaSnapshot = {
  schemaName: "CanonicalApplicationV1",
  version: canonicalApplicationVersion.currentVersion,
  minimumReaderVersion: canonicalApplicationVersion.minimumReaderVersion,
  fields: [
    { path: "schema", type: "literal:CanonicalApplicationV1", required: true },
    { path: "schemaVersion", type: "semver", required: true },
    { path: "compatibilityVersion", type: "semver", required: true },
    { path: "applicationId", type: "string", required: true },
    { path: "applicantId", type: "string", required: true },
    { path: "sourceSystem", type: "literal:application-prototype", required: true },
    { path: "submittedAt", type: "iso-datetime", required: false },
    { path: "status", type: "enum:draft|submitted|assessed|decisioned", required: true },
    { path: "personalDetails.firstName", type: "string", required: true },
    { path: "personalDetails.lastName", type: "string", required: true },
    { path: "personalDetails.middleName", type: "string", required: false },
    { path: "personalDetails.preferredName", type: "string", required: false },
    { path: "personalDetails.dateOfBirth", type: "iso-date", required: false },
    { path: "personalDetails.email", type: "string", required: true },
    { path: "personalDetails.phone", type: "string", required: false },
    { path: "personalDetails.citizenshipStatus", type: "string", required: false },
    { path: "residentialAddress.formattedAddress", type: "string", required: false },
    { path: "residentialAddress.country", type: "string", required: false },
    { path: "postalAddress.formattedAddress", type: "string", required: false },
    { path: "postalAddress.country", type: "string", required: false },
    { path: "selectedCourse.courseCode", type: "string", required: true },
    { path: "selectedCourse.courseTitle", type: "string", required: true },
    { path: "selectedCourse.providerCode", type: "string", required: true },
    { path: "selectedCourse.providerName", type: "string", required: true },
    { path: "selectedCourse.intakeCode", type: "string", required: true },
    { path: "selectedCourse.intakeLabel", type: "string", required: true },
    { path: "selectedCourse.studyMode", type: "enum:online|on-campus|blended", required: false },
    { path: "qualifications[]", type: "array", required: true },
    { path: "qualifications[].qualificationId", type: "string", required: true },
    { path: "qualifications[].level", type: "qualification-level", required: true },
    { path: "qualifications[].institutionName", type: "string", required: true },
    { path: "qualifications[].country", type: "string", required: true },
    { path: "qualifications[].courseName", type: "string", required: true },
    { path: "qualifications[].startDate", type: "iso-date", required: false },
    { path: "qualifications[].endDate", type: "iso-date", required: false },
    { path: "qualifications[].completed", type: "boolean", required: true },
    { path: "qualifications[].gradingScheme", type: "string", required: false },
    { path: "qualifications[].gradeAverage", type: "string", required: false },
    { path: "qualifications[].documentIds[]", type: "string", required: true },
    { path: "employmentHistory[]", type: "array", required: true },
    { path: "employmentHistory[].experienceId", type: "string", required: true },
    { path: "employmentHistory[].employerName", type: "string", required: true },
    { path: "employmentHistory[].title", type: "string", required: true },
    { path: "employmentHistory[].employmentType", type: "employment-type", required: false },
    { path: "employmentHistory[].startDate", type: "iso-date", required: false },
    { path: "employmentHistory[].endDate", type: "iso-date", required: false },
    { path: "employmentHistory[].currentRole", type: "boolean", required: true },
    { path: "employmentHistory[].dutiesSummary", type: "string", required: false },
    { path: "languageTests[]", type: "array", required: true },
    { path: "languageTests[].testId", type: "string", required: true },
    { path: "languageTests[].provider", type: "string", required: true },
    { path: "languageTests[].testName", type: "string", required: true },
    { path: "languageTests[].completedAt", type: "iso-date", required: false },
    { path: "languageTests[].overallScore", type: "string", required: false },
    { path: "languageTests[].documentIds[]", type: "string", required: true },
    { path: "documents[]", type: "array", required: true },
    { path: "documents[].documentId", type: "string", required: true },
    { path: "documents[].category", type: "document-category", required: true },
    { path: "documents[].filename", type: "string", required: true },
    { path: "documents[].contentType", type: "string", required: true },
    { path: "documents[].sizeBytes", type: "number", required: true },
    { path: "documents[].checksumSha256", type: "sha256", required: true },
    { path: "documents[].sourceUri", type: "string", required: true },
    { path: "documents[].uploadedAt", type: "iso-datetime", required: true },
    { path: "documents[].requiredForSubmission", type: "boolean", required: false },
    { path: "metadata", type: "record<string,string>", required: false },
  ],
};

export const transferPackageManifestSnapshotV1: SchemaSnapshot = {
  schemaName: "TransferPackageManifestV1",
  version: transferPackageManifestVersion.currentVersion,
  minimumReaderVersion: transferPackageManifestVersion.minimumReaderVersion,
  fields: [
    { path: "schema", type: "literal:TransferPackageManifestV1", required: true },
    { path: "schemaVersion", type: "semver", required: true },
    { path: "compatibilityVersion", type: "semver", required: true },
    { path: "manifestId", type: "string", required: true },
    { path: "applicationId", type: "string", required: true },
    { path: "decisionId", type: "string", required: true },
    { path: "partnerId", type: "string", required: true },
    { path: "partnerName", type: "string", required: true },
    { path: "generatedAt", type: "iso-datetime", required: true },
    { path: "artifacts[]", type: "array", required: true },
    { path: "artifacts[].artifactId", type: "string", required: true },
    { path: "artifacts[].artifactType", type: "artifact-type", required: true },
    { path: "artifacts[].filename", type: "string", required: true },
    { path: "artifacts[].checksumSha256", type: "sha256", required: true },
    { path: "artifacts[].byteSize", type: "number", required: true },
    { path: "artifacts[].generatedAt", type: "iso-datetime", required: true },
    { path: "documents[]", type: "array", required: true },
    { path: "documents[].documentId", type: "string", required: true },
    { path: "documents[].logicalPath", type: "string", required: true },
    { path: "documents[].filename", type: "string", required: true },
    { path: "documents[].checksumSha256", type: "sha256", required: true },
    { path: "documents[].byteSize", type: "number", required: true },
    { path: "documents[].category", type: "string", required: true },
    { path: "handoff.handoffMode", type: "handoff-mode", required: true },
    { path: "handoff.destinationRef", type: "string", required: true },
    { path: "handoff.encryptionProfile", type: "encryption-profile", required: true },
    { path: "handoff.idempotencyKey", type: "string", required: true },
    { path: "metadata", type: "record<string,string>", required: false },
  ],
};

export function getCurrentSchemaSnapshots(): SchemaSnapshot[] {
  return [
    canonicalApplicationSnapshotV1,
    transferPackageManifestSnapshotV1,
  ];
}
