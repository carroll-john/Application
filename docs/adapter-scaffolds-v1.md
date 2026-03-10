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

The scaffold now emits a structured dispatch contract and receipt contract:
- `ImportWorkflowDispatchPayloadV1` defines the versioned handoff object sent to the partner import runner.
- `ImportWorkflowVerificationReceiptV1` defines the receipt schema consumed by `verify` and `reconcile`.
- Receipt statuses map to provisioning outcomes so `processing` stays retryable, `imported` completes, and `rejected` fails with explicit reason codes.

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
- route key, ack target, and record-lookup target
- connector availability status at dispatch planning time
- private-network requirement flag
- credential and deployment boundary markers

Default route and failure policy:
- `routeKey = edge:{connectorId}`
- priority `20`
- supports JSON manifests without inline documents and `source-application-id` duplicate detection
- treats `invalid_credentials` and `configuration_error` as terminal failures

Edge telemetry additions:
- `InMemoryEdgeConnectorTelemetryStore` captures connector health snapshots plus per-run telemetry events without changing the shared orchestrator contract.
- Telemetry events are emitted at `prepared`, `dispatched`, `verified`, and `reconciled` stages.
- Operations-facing connector status views expose latest availability plus latest run stage/state per connector.
- Connectivity failures can surface `offline` availability while successful runs keep `healthy` status and a final `completed` run state.

## Shared Contract Additions

`PreparedProvisioningPayload` now supports two optional fields for scaffolded adapters:
- `dispatchPayload`
- `executionMetadata`
- `verificationHooks`

Those fields let import-workflow and edge adapters expose the same execution-planning and verification shape while still using the shared `prepare -> execute -> verify -> reconcile` contract.
