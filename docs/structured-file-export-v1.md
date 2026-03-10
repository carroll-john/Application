# Structured File Export V1

This document captures the `DIS-60` baseline for deterministic CSV/XML export generation and transfer package manifests.

## Mapping Config Contract

Each university export mapping config defines:
- `schema`
- `schemaVersion`
- `compatibilityVersion`
- `configId`
- `configVersion`
- `partnerId`
- `partnerName`
- `overlayId`
- `mappingProfileId`
- `format`
- `filenameStem`
- `fields[]`
- `handoff`

Optional template settings:
- `rootElementName`
- `rowElementName`
- `documentBasePath`
- `metadata`

Each field mapping defines:
- `sourcePath`
- `outputKey`
- `required`
- optional `transform`
- optional `defaultValue`

Validation guardrails:
- `configId`, `overlayId`, `mappingProfileId`, `partnerId`, and `filenameStem` are required.
- `fields[*].outputKey` must be unique within a config.
- XML configs validate `rootElementName`, `rowElementName`, and `fields[*].outputKey` as XML-safe element names.
- Invalid or incomplete configs fail before export generation.

## Supported Transforms

The baseline exporter supports:
- `identity`
- `uppercase`
- `lowercase`
- `date-iso`
- `boolean-yes-no`
- `join-lines`

## Determinism Rules

For a fixed application, decision, config, and `generatedAt`, the exporter produces the same:
- artifact filename
- artifact checksum
- manifest id
- manifest handoff idempotency key
- document logical paths

Deterministic ids:
- `artifactId = artifact-{decisionId}-{configId}-{configVersion}-{format}`
- `manifestId = manifest-{decisionId}-{configId}-{configVersion}`
- `handoff.idempotencyKey = {decisionId}:{partnerId}:{configId}:{configVersion}`

Artifact reuse:
- Export artifacts are stored by handoff idempotency key.
- A retry of the same decision/config pair reuses the previously generated artifact and manifest instead of generating duplicates.
- Stored references retain traceability for `configId`, `configVersion`, `overlayId`, `mappingProfileId`, and optional `provisioningJobId`.

## Manifest Behavior

The exporter builds `TransferPackageManifestV1` with:
- one structured export artifact per template run
- document references copied from canonical application documents
- secure handoff metadata for `sftp`, `manual-import`, `portal-upload`, or API-oriented delivery modes
- traceability metadata for config and provisioning linkage

## Validation

Two validation layers run for every generated export:
- mapping config validation before rendering
- format validation for CSV or XML structure
- `TransferPackageManifestV1` validation for artifact and manifest integrity
