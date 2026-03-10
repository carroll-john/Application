# Structured File Export V1

This document captures the `DIS-60` baseline for deterministic CSV/XML export generation and transfer package manifests.

## Template Contract

Each university export template defines:
- `templateId`
- `partnerId`
- `partnerName`
- `format`
- `filenameStem`
- `fields[]`
- `handoff`

Optional template settings:
- `rootElementName`
- `rowElementName`
- `documentBasePath`

Each field defines:
- `sourcePath`
- `outputKey`
- `required`
- optional `transform`
- optional `defaultValue`

## Supported Transforms

The baseline exporter supports:
- `identity`
- `uppercase`
- `lowercase`
- `date-iso`
- `boolean-yes-no`
- `join-lines`

## Determinism Rules

For a fixed application, decision, template, and `generatedAt`, the exporter produces the same:
- artifact filename
- artifact checksum
- manifest id
- manifest handoff idempotency key
- document logical paths

Deterministic ids:
- `artifactId = artifact-{decisionId}-{templateId}-{format}`
- `manifestId = manifest-{decisionId}-{templateId}`
- `handoff.idempotencyKey = {decisionId}:{partnerId}:{templateId}`

## Manifest Behavior

The exporter builds `TransferPackageManifestV1` with:
- one structured export artifact per template run
- document references copied from canonical application documents
- secure handoff metadata for `sftp`, `manual-import`, `portal-upload`, or API-oriented delivery modes

## Validation

Two validation layers run for every generated export:
- format validation for CSV or XML structure
- `TransferPackageManifestV1` validation for artifact and manifest integrity
