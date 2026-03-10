import type {
  CanonicalApplicationV1,
  CanonicalDocumentReference,
  TransferPackageManifestV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import { isBackwardCompatibleVersion } from "./contracts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_REGEX = /^[a-f0-9]{64}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function validateSha256(value: string, field: string, errors: string[]): void {
  if (!SHA256_REGEX.test(value)) {
    errors.push(`${field} must be a lowercase SHA-256 hex digest.`);
  }
}

function validateIsoDate(
  value: string | undefined,
  field: string,
  errors: string[],
): void {
  if (value && !ISO_DATE_REGEX.test(value)) {
    errors.push(`${field} must be an ISO-8601 date or timestamp.`);
  }
}

function validateDocumentReference(
  document: CanonicalDocumentReference,
  index: number,
  errors: string[],
): void {
  if (!hasValue(document.documentId)) {
    errors.push(`documents[${index}].documentId is required.`);
  }

  if (!hasValue(document.filename)) {
    errors.push(`documents[${index}].filename is required.`);
  }

  if (!hasValue(document.sourceUri)) {
    errors.push(`documents[${index}].sourceUri is required.`);
  }

  if (document.sizeBytes <= 0) {
    errors.push(`documents[${index}].sizeBytes must be greater than zero.`);
  }

  validateSha256(
    document.checksumSha256,
    `documents[${index}].checksumSha256`,
    errors,
  );
  validateIsoDate(document.uploadedAt, `documents[${index}].uploadedAt`, errors);
}

export function validateCanonicalApplication(
  application: CanonicalApplicationV1,
): ValidationResult {
  const errors: string[] = [];

  if (application.schema !== "CanonicalApplicationV1") {
    errors.push("schema must equal CanonicalApplicationV1.");
  }

  if (
    !isBackwardCompatibleVersion(
      application.schemaVersion,
      application.compatibilityVersion,
    )
  ) {
    errors.push(
      "compatibilityVersion must be backward compatible with schemaVersion.",
    );
  }

  if (!hasValue(application.applicationId)) {
    errors.push("applicationId is required.");
  }

  if (!hasValue(application.applicantId)) {
    errors.push("applicantId is required.");
  }

  if (!hasValue(application.personalDetails.firstName)) {
    errors.push("personalDetails.firstName is required.");
  }

  if (!hasValue(application.personalDetails.lastName)) {
    errors.push("personalDetails.lastName is required.");
  }

  if (!hasValue(application.personalDetails.email)) {
    errors.push("personalDetails.email is required.");
  }

  if (!hasValue(application.selectedCourse.courseCode)) {
    errors.push("selectedCourse.courseCode is required.");
  }

  if (!hasValue(application.selectedCourse.providerCode)) {
    errors.push("selectedCourse.providerCode is required.");
  }

  if (!hasValue(application.selectedCourse.intakeCode)) {
    errors.push("selectedCourse.intakeCode is required.");
  }

  if (application.qualifications.length === 0) {
    errors.push("At least one qualification is required.");
  }

  application.documents.forEach((document, index) => {
    validateDocumentReference(document, index, errors);
  });

  const documentIds = new Set(
    application.documents.map((document) => document.documentId),
  );
  application.qualifications.forEach((qualification, index) => {
    if (!hasValue(qualification.qualificationId)) {
      errors.push(`qualifications[${index}].qualificationId is required.`);
    }

    if (!hasValue(qualification.institutionName)) {
      errors.push(`qualifications[${index}].institutionName is required.`);
    }

    qualification.documentIds.forEach((documentId) => {
      if (!documentIds.has(documentId)) {
        errors.push(
          `qualifications[${index}] references missing documentId ${documentId}.`,
        );
      }
    });
  });

  application.languageTests.forEach((languageTest, index) => {
    if (!hasValue(languageTest.provider)) {
      errors.push(`languageTests[${index}].provider is required.`);
    }

    languageTest.documentIds.forEach((documentId) => {
      if (!documentIds.has(documentId)) {
        errors.push(
          `languageTests[${index}] references missing documentId ${documentId}.`,
        );
      }
    });
  });

  validateIsoDate(application.submittedAt, "submittedAt", errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateTransferPackageManifest(
  manifest: TransferPackageManifestV1,
): ValidationResult {
  const errors: string[] = [];

  if (manifest.schema !== "TransferPackageManifestV1") {
    errors.push("schema must equal TransferPackageManifestV1.");
  }

  if (
    !isBackwardCompatibleVersion(
      manifest.schemaVersion,
      manifest.compatibilityVersion,
    )
  ) {
    errors.push(
      "compatibilityVersion must be backward compatible with schemaVersion.",
    );
  }

  if (!hasValue(manifest.applicationId)) {
    errors.push("applicationId is required.");
  }

  if (!hasValue(manifest.decisionId)) {
    errors.push("decisionId is required.");
  }

  if (manifest.artifacts.length === 0) {
    errors.push("At least one generated artifact is required.");
  }

  manifest.artifacts.forEach((artifact, index) => {
    if (!hasValue(artifact.filename)) {
      errors.push(`artifacts[${index}].filename is required.`);
    }

    if (artifact.byteSize <= 0) {
      errors.push(`artifacts[${index}].byteSize must be greater than zero.`);
    }

    validateSha256(
      artifact.checksumSha256,
      `artifacts[${index}].checksumSha256`,
      errors,
    );
    validateIsoDate(artifact.generatedAt, `artifacts[${index}].generatedAt`, errors);
  });

  manifest.documents.forEach((document, index) => {
    if (!hasValue(document.logicalPath)) {
      errors.push(`documents[${index}].logicalPath is required.`);
    }

    validateSha256(
      document.checksumSha256,
      `documents[${index}].checksumSha256`,
      errors,
    );
  });

  if (!hasValue(manifest.handoff.idempotencyKey)) {
    errors.push("handoff.idempotencyKey is required.");
  }

  validateIsoDate(manifest.generatedAt, "generatedAt", errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateUniversityMappingOverlay(
  overlay: UniversityMappingOverlayV1,
): ValidationResult {
  const errors: string[] = [];

  if (overlay.schema !== "UniversityMappingOverlayV1") {
    errors.push("schema must equal UniversityMappingOverlayV1.");
  }

  if (
    !isBackwardCompatibleVersion(
      overlay.schemaVersion,
      overlay.compatibilityVersion,
    )
  ) {
    errors.push(
      "compatibilityVersion must be backward compatible with schemaVersion.",
    );
  }

  if (!hasValue(overlay.partnerId)) {
    errors.push("partnerId is required.");
  }

  if (!hasValue(overlay.mappingProfileId)) {
    errors.push("mappingProfileId is required.");
  }

  validateIsoDate(overlay.activeFrom, "activeFrom", errors);

  const destinationPaths = new Set<string>();
  const canonicalPaths = new Set<string>();

  overlay.fieldMappings.forEach((mapping, index) => {
    if (!hasValue(mapping.canonicalPath)) {
      errors.push(`fieldMappings[${index}].canonicalPath is required.`);
    }

    if (!hasValue(mapping.destinationPath)) {
      errors.push(`fieldMappings[${index}].destinationPath is required.`);
    }

    if (canonicalPaths.has(mapping.canonicalPath)) {
      errors.push(
        `fieldMappings[${index}].canonicalPath must be unique within an overlay.`,
      );
    }

    if (destinationPaths.has(mapping.destinationPath)) {
      errors.push(
        `fieldMappings[${index}].destinationPath must be unique within an overlay.`,
      );
    }

    canonicalPaths.add(mapping.canonicalPath);
    destinationPaths.add(mapping.destinationPath);

    if (!mapping.required && mapping.defaultValue) {
      errors.push(
        `fieldMappings[${index}] cannot define defaultValue when required is false.`,
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
