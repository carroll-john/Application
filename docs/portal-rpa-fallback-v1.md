# Portal RPA Fallback V1

This note captures the `DIS-67` experimental `portal-rpa` fallback adapter for last-mile provisioning.

## Position in the architecture

- `portal-rpa` remains optional and partner-configurable through the existing overlay capability profile.
- It is a fallback path for partner course lines with no viable API or import route.
- The shared provisioning contract still owns job creation, retries, reconciliation, and exception queue integration.

## Deterministic step plan

The fallback adapter executes a fixed step sequence:
- `portal.open-search`
- `portal.lookup-applicant`
- `portal.open-application`
- `portal.submit-decision`
- `portal.capture-confirmation`
- `portal.verify-target-record`
- `portal.reconcile-run`

Each step records evidence with:
- action kind
- selector key and selector
- timestamp
- outcome (`completed`, `failed`, `selector_drift`)
- optional runbook id

## Failure taxonomy

The experiment currently maps portal-specific failures into shared classes:
- `selector_drift` -> `configuration` (terminal)
- `invalid_credentials` -> `authorization` (terminal)
- `duplicate_record` -> `duplicate_record` (terminal)
- `portal_timeout` -> `connectivity` (retryable)
- `portal_unavailable` -> `partner_system` (retryable)

## Drift signals and runbooks

Selector drift records a measurable signal with:
- selector key
- expected selector
- optional observed selector
- severity
- explicit runbook

Current runbooks:
- `portal-rpa.selector-drift`
- `portal-rpa.credential-reset`
- `portal-rpa.transient-retry`
- `portal-rpa.duplicate-review`
- `portal-rpa.manual-escalation`

These runbooks are surfaced alongside the latest portal run or drift signal so operators know whether to update selectors, reset credentials, wait for retry, or escalate manually.

## Measurable status view

`InMemoryPortalRpaTelemetryStore` exposes route-level status with:
- total runs
- completed runs
- exception runs
- success rate
- drift incident count
- latest error code
- latest runbook id/title

This lets the pilot measure whether the scoped fallback path is staying above the target auto-provisioning success threshold.

## Admissions trace integration

When a partner course line runs in rollout `Mode 3` and the overlay transport mode is `portal-rpa`, the admissions review trace now stores:
- portal run records
- portal action evidence
- selector drift signals

Those artifacts sit beside the shared provisioning job, reconciliation result, and exception queue state.
