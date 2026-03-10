import type {
  CanonicalApplicationV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import type {
  DecisionRecordV1,
  PreparedProvisioningPayload,
  ProvisioningFailureClass,
  UniversityAdapter,
  VerificationHookV1,
} from "./provisioning";
import { AdapterExecutionError as AdapterExecutionErrorClass } from "./provisioning";

export type PortalRpaStepKey =
  | "portal.open-search"
  | "portal.lookup-applicant"
  | "portal.open-application"
  | "portal.submit-decision"
  | "portal.capture-confirmation"
  | "portal.verify-target-record"
  | "portal.reconcile-run";

export type PortalRpaActionKind =
  | "navigate"
  | "type"
  | "click"
  | "assert";

export type PortalRpaEvidenceOutcome =
  | "completed"
  | "failed"
  | "selector_drift";

export type PortalRpaRunState = "completed" | "exception";

export type PortalRpaRunbookId =
  | "portal-rpa.selector-drift"
  | "portal-rpa.credential-reset"
  | "portal-rpa.transient-retry"
  | "portal-rpa.duplicate-review"
  | "portal-rpa.manual-escalation";

export interface PortalRpaRunbook {
  runbookId: PortalRpaRunbookId;
  title: string;
  summary: string;
}

export interface PortalRpaActionEvidence {
  evidenceId: string;
  jobId: string;
  correlationId: string;
  routeKey: string;
  portalId: string;
  stepKey: PortalRpaStepKey;
  actionKind: PortalRpaActionKind;
  selectorKey?: string;
  selector?: string;
  occurredAt: string;
  outcome: PortalRpaEvidenceOutcome;
  details: string;
  screenshotRef?: string;
  externalReference?: string;
  runbookId?: PortalRpaRunbookId;
}

export interface PortalRpaDriftSignal {
  signalId: string;
  jobId: string;
  correlationId: string;
  routeKey: string;
  portalId: string;
  observedAt: string;
  selectorKey: string;
  expectedSelector: string;
  observedSelector?: string;
  summary: string;
  severity: "warning" | "critical";
  runbookId: PortalRpaRunbookId;
  runbookTitle: string;
}

export interface PortalRpaRunRecord {
  runId: string;
  jobId: string;
  correlationId: string;
  routeKey: string;
  portalId: string;
  observedAt: string;
  runState: PortalRpaRunState;
  evidenceCount: number;
  driftSignalCount: number;
  details: string;
  externalReference?: string;
  errorCode?: string;
  runbookId?: PortalRpaRunbookId;
  runbookTitle?: string;
}

export interface PortalRpaStatusView {
  routeKey: string;
  portalId: string;
  totalRuns: number;
  completedRuns: number;
  exceptionRuns: number;
  successRate: number;
  driftIncidentCount: number;
  latestRunState?: PortalRpaRunState;
  latestRunObservedAt?: string;
  latestErrorCode?: string;
  latestRunbookId?: PortalRpaRunbookId;
  latestRunbookTitle?: string;
}

export interface PortalRpaTelemetryFilters {
  jobId?: string;
  routeKey?: string;
}

export interface PortalRpaTelemetryStore {
  listDriftSignals(filters?: PortalRpaTelemetryFilters): PortalRpaDriftSignal[];
  listEvidence(filters?: PortalRpaTelemetryFilters): PortalRpaActionEvidence[];
  listRunRecords(filters?: PortalRpaTelemetryFilters): PortalRpaRunRecord[];
  listStatusViews(): PortalRpaStatusView[];
  recordDriftSignal(signal: PortalRpaDriftSignal): void;
  recordEvidence(evidence: PortalRpaActionEvidence): void;
  recordRun(record: PortalRpaRunRecord): void;
}

export interface PortalRpaFallbackAdapterOptions {
  portalId?: string;
  portalLabel?: string;
  portalBaseUrl?: string;
  preparedAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  reconciledAt?: string;
  telemetryStore?: PortalRpaTelemetryStore;
  selectorOverrides?: Partial<Record<PortalRpaStepKey, string>>;
  driftStepKey?: PortalRpaStepKey;
  observedDriftSelector?: string;
  executionErrorCode?: string;
  executionErrorMessage?: string;
  executionErrorRetryable?: boolean;
  executionErrorFailureClass?: ProvisioningFailureClass;
}

const PORTAL_RPA_RUNBOOKS: Record<PortalRpaRunbookId, PortalRpaRunbook> = {
  "portal-rpa.selector-drift": {
    runbookId: "portal-rpa.selector-drift",
    title: "Portal selector drift triage",
    summary:
      "Review the recorded selector mismatch, confirm portal DOM changes, update the deterministic selector map, and replay the exception after validation.",
  },
  "portal-rpa.credential-reset": {
    runbookId: "portal-rpa.credential-reset",
    title: "Portal credential reset",
    summary:
      "Validate service-account access, rotate credentials if required, and re-run the RPA flow only after portal sign-in is restored.",
  },
  "portal-rpa.transient-retry": {
    runbookId: "portal-rpa.transient-retry",
    title: "Portal transient retry",
    summary:
      "Confirm partner portal availability, wait for the retry window, and only escalate after repeated transient failures across the same route.",
  },
  "portal-rpa.duplicate-review": {
    runbookId: "portal-rpa.duplicate-review",
    title: "Portal duplicate review",
    summary:
      "Review the detected downstream duplicate, compare application identifiers, and resolve manually before replaying the provisioning attempt.",
  },
  "portal-rpa.manual-escalation": {
    runbookId: "portal-rpa.manual-escalation",
    title: "Portal manual escalation",
    summary:
      "Capture the run evidence, attach partner context, and escalate to operations when the portal path fails outside known recovery playbooks.",
  },
};

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cloneEvidence(evidence: PortalRpaActionEvidence): PortalRpaActionEvidence {
  return {
    ...evidence,
  };
}

function cloneDriftSignal(signal: PortalRpaDriftSignal): PortalRpaDriftSignal {
  return {
    ...signal,
  };
}

function cloneRunRecord(record: PortalRpaRunRecord): PortalRpaRunRecord {
  return {
    ...record,
  };
}

function createEvidenceId(
  jobId: string,
  stepKey: PortalRpaStepKey,
  occurredAt: string,
): string {
  return [
    "portal-rpa",
    sanitizeToken(jobId),
    sanitizeToken(stepKey),
    String(Date.parse(occurredAt)),
  ].join("-");
}

function getRunbookForErrorCode(code: string | undefined): PortalRpaRunbook {
  switch (code) {
    case "selector_drift":
      return PORTAL_RPA_RUNBOOKS["portal-rpa.selector-drift"];
    case "invalid_credentials":
      return PORTAL_RPA_RUNBOOKS["portal-rpa.credential-reset"];
    case "portal_timeout":
    case "portal_unavailable":
      return PORTAL_RPA_RUNBOOKS["portal-rpa.transient-retry"];
    case "duplicate_record":
      return PORTAL_RPA_RUNBOOKS["portal-rpa.duplicate-review"];
    default:
      return PORTAL_RPA_RUNBOOKS["portal-rpa.manual-escalation"];
  }
}

export class InMemoryPortalRpaTelemetryStore implements PortalRpaTelemetryStore {
  private readonly evidenceEvents: PortalRpaActionEvidence[] = [];
  private readonly driftSignals: PortalRpaDriftSignal[] = [];
  private readonly runRecords: PortalRpaRunRecord[] = [];

  listDriftSignals(
    filters: PortalRpaTelemetryFilters = {},
  ): PortalRpaDriftSignal[] {
    return this.driftSignals
      .filter((signal) => (filters.jobId ? signal.jobId === filters.jobId : true))
      .filter((signal) =>
        filters.routeKey ? signal.routeKey === filters.routeKey : true,
      )
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
      .map((signal) => cloneDriftSignal(signal));
  }

  listEvidence(filters: PortalRpaTelemetryFilters = {}): PortalRpaActionEvidence[] {
    return this.evidenceEvents
      .filter((event) => (filters.jobId ? event.jobId === filters.jobId : true))
      .filter((event) =>
        filters.routeKey ? event.routeKey === filters.routeKey : true,
      )
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map((event) => cloneEvidence(event));
  }

  listRunRecords(filters: PortalRpaTelemetryFilters = {}): PortalRpaRunRecord[] {
    return this.runRecords
      .filter((record) => (filters.jobId ? record.jobId === filters.jobId : true))
      .filter((record) =>
        filters.routeKey ? record.routeKey === filters.routeKey : true,
      )
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
      .map((record) => cloneRunRecord(record));
  }

  listStatusViews(): PortalRpaStatusView[] {
    const routeKeys = new Set(this.runRecords.map((record) => record.routeKey));
    return Array.from(routeKeys)
      .map((routeKey) => {
        const runs = this.runRecords.filter((record) => record.routeKey === routeKey);
        const latestRun = [...runs].sort((left, right) =>
          right.observedAt.localeCompare(left.observedAt),
        )[0];
        const completedRuns = runs.filter((record) => record.runState === "completed");
        const exceptionRuns = runs.filter((record) => record.runState === "exception");
        const driftIncidentCount = this.driftSignals.filter(
          (signal) => signal.routeKey === routeKey,
        ).length;
        return {
          routeKey,
          portalId: latestRun?.portalId ?? "",
          totalRuns: runs.length,
          completedRuns: completedRuns.length,
          exceptionRuns: exceptionRuns.length,
          successRate:
            runs.length === 0 ? 0 : Number((completedRuns.length / runs.length).toFixed(2)),
          driftIncidentCount,
          latestRunState: latestRun?.runState,
          latestRunObservedAt: latestRun?.observedAt,
          latestErrorCode: latestRun?.errorCode,
          latestRunbookId: latestRun?.runbookId,
          latestRunbookTitle: latestRun?.runbookTitle,
        } satisfies PortalRpaStatusView;
      })
      .sort((left, right) => left.routeKey.localeCompare(right.routeKey));
  }

  recordDriftSignal(signal: PortalRpaDriftSignal): void {
    this.driftSignals.push(cloneDriftSignal(signal));
  }

  recordEvidence(evidence: PortalRpaActionEvidence): void {
    this.evidenceEvents.push(cloneEvidence(evidence));
  }

  recordRun(record: PortalRpaRunRecord): void {
    this.runRecords.push(cloneRunRecord(record));
  }
}

function createPreparedPayload(input: {
  application: CanonicalApplicationV1;
  decision: DecisionRecordV1;
  overlay: UniversityMappingOverlayV1;
  job: {
    jobId: string;
    idempotencyKey: string;
    attempts: Array<{ attemptNumber: number }>;
    routingDecision: {
      routeKey: string;
    };
  };
  executionMetadata: Record<string, string>;
  verificationHooks: VerificationHookV1[];
}): PreparedProvisioningPayload {
  return {
    envelopeId: `${input.job.jobId}-attempt-${input.job.attempts.length + 1}`,
    jobId: input.job.jobId,
    applicationId: input.application.applicationId,
    decisionId: input.decision.decisionId,
    adapterMode: input.overlay.capabilityProfile.transportMode,
    idempotencyKey: input.job.idempotencyKey,
    fieldCount: input.overlay.fieldMappings.length,
    documentCount: input.application.documents.length,
    executionMetadata: { ...input.executionMetadata },
    verificationHooks: input.verificationHooks.map((hook) => ({
      ...hook,
    })),
  };
}

function buildDefaultSelectors(
  portalId: string,
): Record<PortalRpaStepKey, string> {
  return {
    "portal.open-search": `[data-portal="${portalId}"] [data-rpa="open-search"]`,
    "portal.lookup-applicant": `[data-portal="${portalId}"] [data-rpa="search-applicant"]`,
    "portal.open-application": `[data-portal="${portalId}"] [data-rpa="open-application"]`,
    "portal.submit-decision": `[data-portal="${portalId}"] [data-rpa="submit-decision"]`,
    "portal.capture-confirmation": `[data-portal="${portalId}"] [data-rpa="confirmation-code"]`,
    "portal.verify-target-record": `[data-portal="${portalId}"] [data-rpa="record-lookup"]`,
    "portal.reconcile-run": `[data-portal="${portalId}"] [data-rpa="receipt-log"]`,
  };
}

function buildEvidence(input: {
  actionKind: PortalRpaActionKind;
  correlationId: string;
  details: string;
  externalReference?: string;
  jobId: string;
  occurredAt: string;
  outcome: PortalRpaEvidenceOutcome;
  portalId: string;
  routeKey: string;
  runbookId?: PortalRpaRunbookId;
  selector?: string;
  selectorKey?: string;
  stepKey: PortalRpaStepKey;
}): PortalRpaActionEvidence {
  return {
    evidenceId: createEvidenceId(input.jobId, input.stepKey, input.occurredAt),
    jobId: input.jobId,
    correlationId: input.correlationId,
    routeKey: input.routeKey,
    portalId: input.portalId,
    stepKey: input.stepKey,
    actionKind: input.actionKind,
    selectorKey: input.selectorKey,
    selector: input.selector,
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    details: input.details,
    externalReference: input.externalReference,
    runbookId: input.runbookId,
    screenshotRef: `evidence://${sanitizeToken(input.jobId)}/${sanitizeToken(input.stepKey)}`,
  };
}

function buildDriftSignal(input: {
  correlationId: string;
  expectedSelector: string;
  jobId: string;
  observedAt: string;
  observedSelector?: string;
  portalId: string;
  routeKey: string;
  selectorKey: string;
}): PortalRpaDriftSignal {
  const runbook = PORTAL_RPA_RUNBOOKS["portal-rpa.selector-drift"];
  return {
    signalId: [
      "portal-rpa-drift",
      sanitizeToken(input.jobId),
      sanitizeToken(input.selectorKey),
      String(Date.parse(input.observedAt)),
    ].join("-"),
    jobId: input.jobId,
    correlationId: input.correlationId,
    routeKey: input.routeKey,
    portalId: input.portalId,
    observedAt: input.observedAt,
    selectorKey: input.selectorKey,
    expectedSelector: input.expectedSelector,
    observedSelector: input.observedSelector,
    summary: `Selector drift detected for ${input.selectorKey}.`,
    severity: "critical",
    runbookId: runbook.runbookId,
    runbookTitle: runbook.title,
  };
}

function buildRunRecord(input: {
  correlationId: string;
  details: string;
  driftSignalCount: number;
  evidenceCount: number;
  errorCode?: string;
  externalReference?: string;
  jobId: string;
  observedAt: string;
  portalId: string;
  routeKey: string;
  runState: PortalRpaRunState;
}): PortalRpaRunRecord {
  const runbook = input.errorCode ? getRunbookForErrorCode(input.errorCode) : undefined;
  return {
    runId: [
      "portal-rpa-run",
      sanitizeToken(input.jobId),
      String(Date.parse(input.observedAt)),
    ].join("-"),
    jobId: input.jobId,
    correlationId: input.correlationId,
    routeKey: input.routeKey,
    portalId: input.portalId,
    observedAt: input.observedAt,
    runState: input.runState,
    evidenceCount: input.evidenceCount,
    driftSignalCount: input.driftSignalCount,
    details: input.details,
    externalReference: input.externalReference,
    errorCode: input.errorCode,
    runbookId: runbook?.runbookId,
    runbookTitle: runbook?.title,
  };
}

export function createPortalRpaFallbackAdapter(
  options: PortalRpaFallbackAdapterOptions = {},
): UniversityAdapter {
  const portalId = options.portalId ?? "harbour-health-admissions";
  const portalLabel = options.portalLabel ?? "Harbour Health admissions portal";
  const portalBaseUrl =
    options.portalBaseUrl ?? `https://partner.example.edu/${portalId}`;
  const routeKey = `portal-rpa:${portalId}`;
  const verificationHooks: VerificationHookV1[] = [
    {
      kind: "record-lookup",
      target: `${portalBaseUrl}/api/applications/search`,
      intervalMinutes: 5,
      timeoutMinutes: 45,
    },
  ];
  const selectors = {
    ...buildDefaultSelectors(portalId),
    ...(options.selectorOverrides ?? {}),
  };
  const telemetryStore = options.telemetryStore;

  function recordEvidence(evidence: PortalRpaActionEvidence): void {
    telemetryStore?.recordEvidence(evidence);
  }

  function recordRun(record: PortalRpaRunRecord): void {
    telemetryStore?.recordRun(record);
  }

  function listEvidenceCount(jobId: string): number {
    return telemetryStore?.listEvidence({ jobId }).length ?? 0;
  }

  function listDriftSignalCount(jobId: string): number {
    return telemetryStore?.listDriftSignals({ jobId }).length ?? 0;
  }

  return {
    mode: "portal-rpa",
    routingProfile: {
      routeKey,
      priority: 20,
      supportedManifestFormats: ["json"],
      supportsInlineDocuments: true,
      supportedDuplicateCheckStrategies: ["email-and-course"],
    },
    failureTaxonomy: {
      codeFailureClasses: {
        selector_drift: "configuration",
        invalid_credentials: "authorization",
        duplicate_record: "duplicate_record",
        portal_timeout: "connectivity",
        portal_unavailable: "partner_system",
      },
      terminalCodes: ["selector_drift", "invalid_credentials", "duplicate_record"],
    },
    prepare: ({ application, decision, overlay, job }) => {
      const preparedAt = options.preparedAt ?? "2026-03-10T18:01:00Z";
      recordEvidence(
        buildEvidence({
          actionKind: "navigate",
          correlationId: job.correlationId,
          details: `Prepared deterministic portal step plan for ${portalLabel}.`,
          jobId: job.jobId,
          occurredAt: preparedAt,
          outcome: "completed",
          portalId,
          routeKey,
          selectorKey: "portal.open-search",
          selector: selectors["portal.open-search"],
          stepKey: "portal.open-search",
        }),
      );
      return createPreparedPayload({
        application,
        decision,
        overlay,
        job,
        executionMetadata: {
          routeKey,
          portalId,
          portalLabel,
          portalBaseUrl,
          decisionSubmissionPath: `${portalBaseUrl}/applications/decision`,
          confirmationLookupPath: `${portalBaseUrl}/applications/confirmations`,
          selectorCount: String(Object.keys(selectors).length),
        },
        verificationHooks,
      });
    },
    execute: (prepared, context) => {
      const stepPlan: Array<{
        actionKind: PortalRpaActionKind;
        details: string;
        selectorKey: PortalRpaStepKey;
      }> = [
        {
          actionKind: "type",
          selectorKey: "portal.lookup-applicant",
          details: "Look up the applicant by email and selected course code.",
        },
        {
          actionKind: "click",
          selectorKey: "portal.open-application",
          details: "Open the matched application record in the partner portal.",
        },
        {
          actionKind: "click",
          selectorKey: "portal.submit-decision",
          details: "Submit the deterministic decision payload through the portal form.",
        },
        {
          actionKind: "assert",
          selectorKey: "portal.capture-confirmation",
          details: "Capture the confirmation code returned by the portal.",
        },
      ];
      const submittedAt = options.submittedAt ?? "2026-03-10T18:02:00Z";

      for (const step of stepPlan) {
        if (options.driftStepKey === step.selectorKey) {
          const driftSignal = buildDriftSignal({
            correlationId: context.correlationId,
            expectedSelector: selectors[step.selectorKey],
            jobId: context.jobId,
            observedAt: submittedAt,
            observedSelector: options.observedDriftSelector,
            portalId,
            routeKey,
            selectorKey: step.selectorKey,
          });
          telemetryStore?.recordDriftSignal(driftSignal);
          recordEvidence(
            buildEvidence({
              actionKind: step.actionKind,
              correlationId: context.correlationId,
              details:
                "Portal selector drift blocked the deterministic fallback flow before submission.",
              jobId: context.jobId,
              occurredAt: submittedAt,
              outcome: "selector_drift",
              portalId,
              routeKey,
              runbookId: driftSignal.runbookId,
              selectorKey: step.selectorKey,
              selector: selectors[step.selectorKey],
              stepKey: step.selectorKey,
            }),
          );
          recordRun(
            buildRunRecord({
              correlationId: context.correlationId,
              details: driftSignal.summary,
              driftSignalCount: listDriftSignalCount(context.jobId),
              evidenceCount: listEvidenceCount(context.jobId),
              errorCode: "selector_drift",
              jobId: context.jobId,
              observedAt: submittedAt,
              portalId,
              routeKey,
              runState: "exception",
            }),
          );
          throw new AdapterExecutionErrorClass(
            "selector_drift",
            `Deterministic portal selector drift detected at ${step.selectorKey}.`,
            {
              retryable: false,
              failureClass: "configuration",
            },
          );
        }

        recordEvidence(
          buildEvidence({
            actionKind: step.actionKind,
            correlationId: context.correlationId,
            details: step.details,
            jobId: context.jobId,
            occurredAt: submittedAt,
            outcome: "completed",
            portalId,
            routeKey,
            selectorKey: step.selectorKey,
            selector: selectors[step.selectorKey],
            stepKey: step.selectorKey,
          }),
        );
      }

      if (options.executionErrorCode) {
        const runbook = getRunbookForErrorCode(options.executionErrorCode);
        recordEvidence(
          buildEvidence({
            actionKind: "assert",
            correlationId: context.correlationId,
            details:
              options.executionErrorMessage ??
              "Portal fallback execution failed before downstream confirmation.",
            jobId: context.jobId,
            occurredAt: submittedAt,
            outcome: "failed",
            portalId,
            routeKey,
            runbookId: runbook.runbookId,
            selectorKey: "portal.capture-confirmation",
            selector: selectors["portal.capture-confirmation"],
            stepKey: "portal.capture-confirmation",
          }),
        );
        recordRun(
          buildRunRecord({
            correlationId: context.correlationId,
            details:
              options.executionErrorMessage ??
              "Portal fallback execution failed before downstream confirmation.",
            driftSignalCount: listDriftSignalCount(context.jobId),
            evidenceCount: listEvidenceCount(context.jobId),
            errorCode: options.executionErrorCode,
            jobId: context.jobId,
            observedAt: submittedAt,
            portalId,
            routeKey,
            runState: "exception",
          }),
        );
        throw new AdapterExecutionErrorClass(
          options.executionErrorCode,
          options.executionErrorMessage ??
            "Portal fallback execution failed before downstream confirmation.",
          {
            retryable: options.executionErrorRetryable ?? false,
            failureClass: options.executionErrorFailureClass ?? "unexpected",
          },
        );
      }

      return {
        accepted: true,
        externalReference: `portal:${portalId}:${context.idempotencyKey}`,
        submittedAt,
      };
    },
    verify: (_prepared, execution, context) => {
      const verifiedAt = options.verifiedAt ?? "2026-03-10T18:03:00Z";
      recordEvidence(
        buildEvidence({
          actionKind: "assert",
          correlationId: context.correlationId,
          details: "Verified the created portal record via deterministic record lookup.",
          externalReference: execution.externalReference,
          jobId: context.jobId,
          occurredAt: verifiedAt,
          outcome: "completed",
          portalId,
          routeKey,
          selectorKey: "portal.verify-target-record",
          selector: selectors["portal.verify-target-record"],
          stepKey: "portal.verify-target-record",
        }),
      );
      return {
        verified: true,
        verifiedAt,
        externalReference: execution.externalReference,
      };
    },
    reconcile: (_prepared, verification, context) => {
      const reconciledAt = options.reconciledAt ?? "2026-03-10T18:04:00Z";
      recordEvidence(
        buildEvidence({
          actionKind: "assert",
          correlationId: context.correlationId,
          details: "Reconciled the portal submission against the confirmation log.",
          externalReference: verification.externalReference,
          jobId: context.jobId,
          occurredAt: reconciledAt,
          outcome: "completed",
          portalId,
          routeKey,
          selectorKey: "portal.reconcile-run",
          selector: selectors["portal.reconcile-run"],
          stepKey: "portal.reconcile-run",
        }),
      );
      recordRun(
        buildRunRecord({
          correlationId: context.correlationId,
          details: "Portal fallback run completed and reconciled successfully.",
          driftSignalCount: listDriftSignalCount(context.jobId),
          evidenceCount: listEvidenceCount(context.jobId),
          externalReference: verification.externalReference,
          jobId: context.jobId,
          observedAt: reconciledAt,
          portalId,
          routeKey,
          runState: "completed",
        }),
      );
      return {
        status: "matched",
        reconciledAt,
        details:
          "Portal fallback completed with deterministic action evidence and confirmation receipt.",
      };
    },
  };
}
