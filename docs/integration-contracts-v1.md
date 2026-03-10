# Integration Contracts V1

This document defines the baseline V1 contracts for `DIS-59`. It is intentionally narrow: stable canonical application data, transfer manifests, and university mapping overlays that unblock orchestration (`DIS-61`) and file export (`DIS-60`).

## Versioning Rules

- Current version for all three contracts: `1.0.0`
- Compatibility floor: `1.0.0`
- Backward-compatibility rule:
  - Patch and minor releases must be additive only.
  - Existing fields cannot be removed or reinterpreted without a major version bump.
  - Readers must ignore unknown metadata fields.

## CanonicalApplicationV1

Required top-level fields:
- `schema`
- `schemaVersion`
- `compatibilityVersion`
- `applicationId`
- `applicantId`
- `sourceSystem`
- `status`
- `personalDetails`
- `selectedCourse`
- `qualifications`
- `employmentHistory`
- `languageTests`
- `documents`

Required nested fields:
- `personalDetails.firstName`
- `personalDetails.lastName`
- `personalDetails.email`
- `selectedCourse.courseCode`
- `selectedCourse.providerCode`
- `selectedCourse.intakeCode`
- `qualifications[*].qualificationId`
- `qualifications[*].institutionName`
- `documents[*].documentId`
- `documents[*].filename`
- `documents[*].checksumSha256`
- `documents[*].sourceUri`
- `documents[*].uploadedAt`

Optional fields:
- `submittedAt`
- `residentialAddress`
- `postalAddress`
- `personalDetails.middleName`
- `personalDetails.preferredName`
- `personalDetails.dateOfBirth`
- `personalDetails.phone`
- `personalDetails.citizenshipStatus`
- `selectedCourse.studyMode`
- `qualifications[*].startDate`
- `qualifications[*].endDate`
- `qualifications[*].gradingScheme`
- `qualifications[*].gradeAverage`
- `employmentHistory[*].employmentType`
- `employmentHistory[*].dutiesSummary`
- `languageTests[*].completedAt`
- `languageTests[*].overallScore`
- `metadata`

Validation rules:
- At least one qualification is required.
- Qualification and language-test `documentIds` must resolve to entries in `documents`.
- `checksumSha256` must be a lowercase 64-character SHA-256 digest.
- Dates and timestamps must be ISO-8601 strings.

## TransferPackageManifestV1

Required top-level fields:
- `schema`
- `schemaVersion`
- `compatibilityVersion`
- `manifestId`
- `applicationId`
- `decisionId`
- `partnerId`
- `partnerName`
- `generatedAt`
- `artifacts`
- `documents`
- `handoff`

Required nested fields:
- `artifacts[*].artifactId`
- `artifacts[*].artifactType`
- `artifacts[*].filename`
- `artifacts[*].checksumSha256`
- `artifacts[*].byteSize`
- `artifacts[*].generatedAt`
- `documents[*].documentId`
- `documents[*].logicalPath`
- `documents[*].checksumSha256`
- `handoff.handoffMode`
- `handoff.destinationRef`
- `handoff.encryptionProfile`
- `handoff.idempotencyKey`

Validation rules:
- At least one artifact is required.
- Artifact and document checksums must use deterministic SHA-256 values.
- `handoff.idempotencyKey` is mandatory because downstream retries must not create duplicate provisioning effects.

## UniversityMappingOverlayV1

Required top-level fields:
- `schema`
- `schemaVersion`
- `compatibilityVersion`
- `overlayId`
- `partnerId`
- `partnerName`
- `mappingProfileId`
- `activeFrom`
- `capabilityProfile`
- `fieldMappings`

Required nested fields:
- `capabilityProfile.transportMode`
- `capabilityProfile.acceptsDocumentsInline`
- `capabilityProfile.manifestFormat`
- `capabilityProfile.duplicateCheckStrategy`
- `fieldMappings[*].canonicalPath`
- `fieldMappings[*].destinationPath`
- `fieldMappings[*].required`
- `fieldMappings[*].transform`

Validation rules:
- `fieldMappings[*].canonicalPath` must be unique within an overlay.
- `fieldMappings[*].destinationPath` must be unique within an overlay.
- `defaultValue` is only valid for required mappings.

## Sample Payload Coverage

The V1 baseline includes three partner/profile variants:
- `southern-coast-online`: file-based online postgraduate flow
- `tasman-import`: import-workflow partner with language-test evidence
- `harbour-health-rpa`: portal or RPA-oriented health-course flow

Source fixtures live in [src/integrationPlatform/examples.ts](/Users/jc/Documents/new-project-integration-mvp-build/src/integrationPlatform/examples.ts).
