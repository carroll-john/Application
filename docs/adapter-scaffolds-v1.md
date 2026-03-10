# Adapter Scaffolds V1

This document captures the `DIS-63` baseline for `import-workflow` and `edge` adapter scaffolds.

## Capability Registry

The scaffold registry publishes adapter descriptors for the new transport modes:
- `import-workflow`
- `edge`

Each descriptor includes:
- `dispatchChannel`
- `deploymentBoundary`
- `credentialBoundary`
- `requiresPrivateNetwork`
- `verificationKinds`
- deployment assumptions

The orchestrator can consume `registry.toAdapters()` directly, so pilot partners can switch transport mode without custom orchestration code.

Each scaffold also publishes a routing and failure policy surface:
- `routingProfile.routeKey` identifies the concrete route used for retries and audit history.
- `routingProfile.priority` lets a more specific connector win when multiple adapters share a mode.
- `supportedManifestFormats`, `supportsInlineDocuments`, and `supportedDuplicateCheckStrategies` constrain which overlay capability profiles the route can serve.
- `failureTaxonomy` maps partner-specific error codes into shared failure classes and marks terminal codes that must not be retried automatically.

## Import Workflow Scaffold

Baseline assumptions:
- A partner-managed import runner consumes manifests from a managed drop location.
- Credentials stay within the partner workflow boundary.
- Verification uses batch-status polling and delivery receipts.

Prepared payload metadata includes:
- drop location and workflow id
- manifest and document-inline flags from the overlay
- credential and deployment boundary markers

Default route and failure policy:
- `routeKey = import-workflow:{workflowId}`
- priority `20`
- supports XML manifests with inline documents and `email-and-course` duplicate detection
- treats `invalid_credentials`, `invalid_payload`, and `duplicate_record` as terminal failures

## Edge Connector Scaffold

Baseline assumptions:
- The connector runs inside the partner network boundary.
- Secrets remain local to the edge runtime.
- Verification uses edge acknowledgements plus downstream record lookup.

Prepared payload metadata includes:
- connector id and dispatch endpoint
- private-network requirement flag
- credential and deployment boundary markers

Default route and failure policy:
- `routeKey = edge:{connectorId}`
- priority `20`
- supports JSON manifests without inline documents and `source-application-id` duplicate detection
- treats `invalid_credentials` and `configuration_error` as terminal failures

## Shared Contract Additions

`PreparedProvisioningPayload` now supports two optional fields for scaffolded adapters:
- `executionMetadata`
- `verificationHooks`

Those fields let import-workflow and edge adapters expose the same execution-planning and verification shape while still using the shared `prepare -> execute -> verify -> reconcile` contract.
