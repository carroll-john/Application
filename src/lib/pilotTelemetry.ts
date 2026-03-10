import type { ReconciliationStatus } from "../integrationPlatform/operations";
import type { ProvisioningJobStatus } from "../integrationPlatform/provisioning";
import type {
  AdmissionsQueueRecord,
  AdmissionsQueueStatus,
} from "./admissionsWorkspace";
import { hashAnalyticsIdentifierSync } from "./analyticsIdentity";
import type {
  PartnerCourseRolloutConfig,
  PartnerCourseRolloutMode,
  PartnerCourseRolloutTransitionOutcome,
} from "./partnerCourseRollout";
import { capturePostHogEvent } from "./posthog";

export const PILOT_TELEMETRY_SCHEMA_VERSION = "v1";

const PILOT_SURFACE = "admissions-workspace";
const ADMISSIONS_QUEUE_STATUSES: readonly AdmissionsQueueStatus[] = [
  "new",
  "assigned",
  "under-review",
  "ready-for-decision",
  "decisioned",
  "provisioning",
  "provisioned",
  "provisioning-exception",
];
const PARTNER_COURSE_ROLLOUT_MODES: readonly PartnerCourseRolloutMode[] = [
  "mode-1-review-only",
  "mode-2-decision-export",
  "mode-3-automated-provisioning",
];
const PILOT_PROVISIONING_STATUSES: readonly string[] = [
  "pending",
  "in_progress",
  "retry_pending",
  "completed",
  "failed",
  "not-triggered",
];
const PILOT_RECONCILIATION_STATUSES: readonly string[] = [
  "matched",
  "missing_target_record",
  "partial_delivery",
  "invalid_target_record",
  "job_not_terminal",
  "not-run",
];
const PILOT_EXCEPTION_STATES: readonly string[] = [
  "none",
  "open",
  "replayed",
  "resolved",
];
const PILOT_ASSIGNMENT_STATES = ["assigned", "unassigned"] as const;
const PILOT_ASSIGNMENT_ACTIONS = ["assigned_to_me", "cleared"] as const;
const PILOT_DECISION_OUTCOMES = [
  "admit",
  "conditional",
  "waitlist",
  "reject",
] as const;
const PILOT_DOWNSTREAM_ACTIONS = [
  "none",
  "export",
  "automated-provisioning",
] as const;
const PILOT_DOCUMENT_ACCESS_OUTCOMES = ["opened", "blocked"] as const;
const PILOT_TIME_TO_DECISION_SOURCES = [
  "assignment",
  "submission",
  "last-activity",
  "unknown",
] as const;
const PILOT_ROLLOUT_UPDATE_OUTCOMES = ["applied", "rejected"] as const;

export type PilotMetricCategory = "viability" | "feasibility" | "desirability";

export type PilotMetricKey =
  | "decision_cycle_time_hours"
  | "approved_decision_handoff_rate"
  | "provisioning_success_rate_by_adapter"
  | "reconciliation_match_rate"
  | "weekly_active_reviewers"
  | "secure_document_view_success_rate";

export type PilotTelemetryEventName =
  | "admissions_rollout_mode_updated"
  | "admissions_queue_review_opened"
  | "admissions_queue_assignment_updated"
  | "admissions_decision_captured"
  | "admissions_document_preview_blocked"
  | "admissions_document_preview_opened"
  | "admissions_status_updated"
  | "admissions_note_added";

export interface PilotMetricDefinition {
  category: PilotMetricCategory;
  description: string;
  dimensions: string[];
  eventNames: PilotTelemetryEventName[];
  formula: string;
  key: PilotMetricKey;
  label: string;
  unit: "count" | "hours" | "rate" | "reviewers";
}

export type PilotTelemetryProperties = Record<
  string,
  string | number | boolean | null
>;

export interface PilotTelemetryValidationIssue {
  eventName: PilotTelemetryEventName;
  message: string;
  property: string;
}

type PilotTelemetryPropertyType = "boolean" | "number" | "string";

interface PilotTelemetryPropertyRule {
  allowedValues?: readonly string[];
  min?: number;
  required?: boolean;
  type: PilotTelemetryPropertyType;
}

interface PilotTelemetryEventDefinition {
  categories: readonly PilotMetricCategory[];
  description: string;
  properties: Record<string, PilotTelemetryPropertyRule>;
}

const PILOT_METRIC_DEFINITIONS: readonly PilotMetricDefinition[] = [
  {
    category: "viability",
    description:
      "Median queue-to-decision lead time for records that reach immutable decision capture.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_rollout_mode"],
    eventNames: ["admissions_decision_captured"],
    formula:
      "Aggregate `pilot_time_to_decision_hours` from `admissions_decision_captured` grouped by partner, course line, and rollout mode.",
    key: "decision_cycle_time_hours",
    label: "Decision cycle time",
    unit: "hours",
  },
  {
    category: "viability",
    description:
      "Share of approved decisions that produce a downstream export or automated provisioning handoff.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_rollout_mode"],
    eventNames: ["admissions_decision_captured"],
    formula:
      "Count approved `admissions_decision_captured` events where `pilot_downstream_action != none` divided by all approved decision events.",
    key: "approved_decision_handoff_rate",
    label: "Approved decision handoff rate",
    unit: "rate",
  },
  {
    category: "feasibility",
    description:
      "Provisioning completion rate segmented by selected adapter mode at decision handoff time.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_adapter_mode"],
    eventNames: ["admissions_decision_captured"],
    formula:
      "Count `admissions_decision_captured` events with `pilot_provisioning_status = completed` divided by decision events where `pilot_provisioning_triggered = true`.",
    key: "provisioning_success_rate_by_adapter",
    label: "Provisioning success rate",
    unit: "rate",
  },
  {
    category: "feasibility",
    description:
      "Reconciliation integrity after downstream handoff, segmented by partner course line and rollout mode.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_rollout_mode"],
    eventNames: ["admissions_decision_captured"],
    formula:
      "Count `admissions_decision_captured` events with `pilot_reconciliation_status = matched` divided by decision events where `pilot_provisioning_triggered = true`.",
    key: "reconciliation_match_rate",
    label: "Reconciliation match rate",
    unit: "rate",
  },
  {
    category: "desirability",
    description:
      "Unique active reviewer count over a seven-day window across queue, decision, document, and note interactions.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_rollout_mode"],
    eventNames: [
      "admissions_queue_review_opened",
      "admissions_decision_captured",
      "admissions_document_preview_opened",
      "admissions_note_added",
    ],
    formula:
      "Count distinct `pilot_actor_id_hash` values over 7 days across review-open, decision, note, and document-preview events.",
    key: "weekly_active_reviewers",
    label: "Weekly active reviewers",
    unit: "reviewers",
  },
  {
    category: "desirability",
    description:
      "Success rate for protected in-platform document viewing within the admissions review flow.",
    dimensions: ["pilot_partner_id", "pilot_course_line_key", "pilot_rollout_mode"],
    eventNames: [
      "admissions_document_preview_opened",
      "admissions_document_preview_blocked",
    ],
    formula:
      "Count `admissions_document_preview_opened` divided by all document preview outcome events.",
    key: "secure_document_view_success_rate",
    label: "Secure document view success rate",
    unit: "rate",
  },
] as const;

const COMMON_RECORD_PROPERTY_RULES: Record<string, PilotTelemetryPropertyRule> = {
  pilot_actor_id_hash: { required: true, type: "string" },
  pilot_application_id: { required: true, type: "string" },
  pilot_assignment_state: {
    allowedValues: PILOT_ASSIGNMENT_STATES,
    required: true,
    type: "string",
  },
  pilot_course_code: { required: true, type: "string" },
  pilot_course_line_key: { required: true, type: "string" },
  pilot_course_title: { required: true, type: "string" },
  pilot_exception_state: {
    allowedValues: PILOT_EXCEPTION_STATES,
    required: true,
    type: "string",
  },
  pilot_metric_categories: { required: true, type: "string" },
  pilot_note_count: { min: 0, required: true, type: "number" },
  pilot_partner_id: { required: true, type: "string" },
  pilot_partner_name: { required: true, type: "string" },
  pilot_priority: { required: true, type: "string" },
  pilot_provisioning_status: {
    allowedValues: PILOT_PROVISIONING_STATUSES,
    required: true,
    type: "string",
  },
  pilot_queue_status: {
    allowedValues: ADMISSIONS_QUEUE_STATUSES,
    required: true,
    type: "string",
  },
  pilot_reconciliation_status: {
    allowedValues: PILOT_RECONCILIATION_STATUSES,
    required: true,
    type: "string",
  },
  pilot_rollout_mode: {
    allowedValues: PARTNER_COURSE_ROLLOUT_MODES,
    required: true,
    type: "string",
  },
  pilot_schema_version: {
    allowedValues: [PILOT_TELEMETRY_SCHEMA_VERSION],
    required: true,
    type: "string",
  },
  pilot_surface: {
    allowedValues: [PILOT_SURFACE],
    required: true,
    type: "string",
  },
};

const COMMON_ROLLOUT_PROPERTY_RULES: Record<string, PilotTelemetryPropertyRule> = {
  pilot_actor_id_hash: { required: true, type: "string" },
  pilot_course_code: { required: true, type: "string" },
  pilot_course_line_key: { required: true, type: "string" },
  pilot_course_title: { required: true, type: "string" },
  pilot_metric_categories: { required: true, type: "string" },
  pilot_partner_id: { required: true, type: "string" },
  pilot_partner_name: { required: true, type: "string" },
  pilot_rollout_mode: {
    allowedValues: PARTNER_COURSE_ROLLOUT_MODES,
    required: true,
    type: "string",
  },
  pilot_schema_version: {
    allowedValues: [PILOT_TELEMETRY_SCHEMA_VERSION],
    required: true,
    type: "string",
  },
  pilot_surface: {
    allowedValues: [PILOT_SURFACE],
    required: true,
    type: "string",
  },
};

const PILOT_TELEMETRY_EVENT_DEFINITIONS: Record<
  PilotTelemetryEventName,
  PilotTelemetryEventDefinition
> = {
  admissions_rollout_mode_updated: {
    categories: ["feasibility"],
    description:
      "Rollout mode transitions or rejections for a partner course line in the admissions workspace.",
    properties: {
      ...COMMON_ROLLOUT_PROPERTY_RULES,
      pilot_previous_rollout_mode: {
        allowedValues: PARTNER_COURSE_ROLLOUT_MODES,
        required: true,
        type: "string",
      },
      pilot_rollout_reason_provided: { required: true, type: "boolean" },
      pilot_rollout_transition_count: { min: 0, required: true, type: "number" },
      pilot_rollout_update_outcome: {
        allowedValues: PILOT_ROLLOUT_UPDATE_OUTCOMES,
        required: true,
        type: "string",
      },
    },
  },
  admissions_queue_review_opened: {
    categories: ["desirability"],
    description: "A reviewer opens an admissions record from the queue.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
    },
  },
  admissions_queue_assignment_updated: {
    categories: ["desirability"],
    description:
      "A reviewer assigns or clears ownership on an admissions record from the queue.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
      pilot_assignment_action: {
        allowedValues: PILOT_ASSIGNMENT_ACTIONS,
        required: true,
        type: "string",
      },
    },
  },
  admissions_decision_captured: {
    categories: ["viability", "feasibility"],
    description:
      "Immutable admissions decision capture with downstream export or provisioning handoff context.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
      pilot_adapter_mode: { required: true, type: "string" },
      pilot_decision_outcome: {
        allowedValues: PILOT_DECISION_OUTCOMES,
        required: true,
        type: "string",
      },
      pilot_decision_reason_code: { required: true, type: "string" },
      pilot_downstream_action: {
        allowedValues: PILOT_DOWNSTREAM_ACTIONS,
        required: true,
        type: "string",
      },
      pilot_provisioning_triggered: { required: true, type: "boolean" },
      pilot_time_to_decision_hours: { min: 0, required: true, type: "number" },
      pilot_time_to_decision_source: {
        allowedValues: PILOT_TIME_TO_DECISION_SOURCES,
        required: true,
        type: "string",
      },
    },
  },
  admissions_document_preview_blocked: {
    categories: ["desirability"],
    description:
      "A protected document preview was blocked for the active reviewer.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
      pilot_document_access_outcome: {
        allowedValues: PILOT_DOCUMENT_ACCESS_OUTCOMES,
        required: true,
        type: "string",
      },
      pilot_document_access_reason: { required: true, type: "string" },
      pilot_document_category: { required: true, type: "string" },
      pilot_document_id: { required: true, type: "string" },
    },
  },
  admissions_document_preview_opened: {
    categories: ["desirability"],
    description: "A protected document preview was opened successfully.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
      pilot_document_access_outcome: {
        allowedValues: PILOT_DOCUMENT_ACCESS_OUTCOMES,
        required: true,
        type: "string",
      },
      pilot_document_category: { required: true, type: "string" },
      pilot_document_id: { required: true, type: "string" },
    },
  },
  admissions_status_updated: {
    categories: ["viability"],
    description:
      "A queue status transition inside the admissions review workflow.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
      pilot_previous_queue_status: {
        allowedValues: ADMISSIONS_QUEUE_STATUSES,
        required: true,
        type: "string",
      },
      pilot_status_target: {
        allowedValues: ADMISSIONS_QUEUE_STATUSES,
        required: true,
        type: "string",
      },
    },
  },
  admissions_note_added: {
    categories: ["desirability"],
    description: "A reviewer saves an operational handover note.",
    properties: {
      ...COMMON_RECORD_PROPERTY_RULES,
    },
  },
};

type AdmissionsPilotEventName = Exclude<
  PilotTelemetryEventName,
  "admissions_rollout_mode_updated"
>;

function getLatestProvisioningStatus(
  record: AdmissionsQueueRecord,
): ProvisioningJobStatus | "not-triggered" {
  return record.decisionTrace.provisioningJobs.at(-1)?.status ?? "not-triggered";
}

function getLatestProvisioningAdapterMode(
  record: AdmissionsQueueRecord,
): string {
  return record.decisionTrace.provisioningJobs.at(-1)?.adapterMode ?? "not-triggered";
}

function getLatestReconciliationStatus(
  record: AdmissionsQueueRecord,
): ReconciliationStatus | "not-run" {
  return record.decisionTrace.reconciliations.at(-1)?.status ?? "not-run";
}

function getOpenExceptionState(record: AdmissionsQueueRecord): string {
  const openException = [...record.decisionTrace.exceptions]
    .reverse()
    .find((candidate) => candidate.status === "open");
  return openException?.status ?? "none";
}

function resolveDecisionTimingBaseline(record: AdmissionsQueueRecord): {
  source: (typeof PILOT_TIME_TO_DECISION_SOURCES)[number];
  startedAt?: string;
} {
  if (record.assignedAt) {
    return {
      source: "assignment",
      startedAt: record.assignedAt,
    };
  }

  const assignmentEvent = record.auditEvents.find(
    (event) => event.type === "assignment",
  );
  if (assignmentEvent) {
    return {
      source: "assignment",
      startedAt: assignmentEvent.occurredAt,
    };
  }

  if (record.application.submittedAt) {
    return {
      source: "submission",
      startedAt: record.application.submittedAt,
    };
  }

  if (record.lastActivityAt) {
    return {
      source: "last-activity",
      startedAt: record.lastActivityAt,
    };
  }

  return {
    source: "unknown",
  };
}

export function calculateAdmissionsTimeToDecisionHours(
  record: AdmissionsQueueRecord,
  decidedAt: string,
): number {
  const baseline = resolveDecisionTimingBaseline(record);
  if (!baseline.startedAt) {
    return 0;
  }

  const startedAt = Date.parse(baseline.startedAt);
  const completedAt = Date.parse(decidedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return 0;
  }

  return Math.max(
    0,
    Number((((completedAt - startedAt) / (1000 * 60 * 60)) || 0).toFixed(2)),
  );
}

function buildEventCategories(
  eventName: PilotTelemetryEventName,
): string {
  return PILOT_TELEMETRY_EVENT_DEFINITIONS[eventName].categories.join(",");
}

export function listPilotMetricDefinitions(
  category?: PilotMetricCategory,
): PilotMetricDefinition[] {
  return PILOT_METRIC_DEFINITIONS.filter((definition) =>
    category ? definition.category === category : true,
  ).map((definition) => ({
    ...definition,
    dimensions: [...definition.dimensions],
    eventNames: [...definition.eventNames],
  }));
}

export function getPilotMetricDefinition(
  key: PilotMetricKey,
): PilotMetricDefinition | undefined {
  return listPilotMetricDefinitions().find((definition) => definition.key === key);
}

export function listPilotTelemetryEventDefinitions(): Record<
  PilotTelemetryEventName,
  PilotTelemetryEventDefinition
> {
  return Object.fromEntries(
    Object.entries(PILOT_TELEMETRY_EVENT_DEFINITIONS).map(([eventName, definition]) => [
      eventName,
      {
        ...definition,
        categories: [...definition.categories],
        properties: Object.fromEntries(
          Object.entries(definition.properties).map(([property, rule]) => [
            property,
            {
              ...rule,
              allowedValues: rule.allowedValues ? [...rule.allowedValues] : undefined,
            },
          ]),
        ),
      },
    ]),
  ) as unknown as Record<PilotTelemetryEventName, PilotTelemetryEventDefinition>;
}

export function createAdmissionsPilotTelemetryProperties(
  eventName: AdmissionsPilotEventName,
  input: {
    actor: string;
    properties?: PilotTelemetryProperties;
    record: AdmissionsQueueRecord;
    rolloutMode: PartnerCourseRolloutMode;
  },
): PilotTelemetryProperties {
  return {
    pilot_actor_id_hash: hashAnalyticsIdentifierSync(input.actor),
    pilot_application_id: input.record.applicationId,
    pilot_assignment_state: input.record.assignee ? "assigned" : "unassigned",
    pilot_course_code: input.record.application.selectedCourse.courseCode,
    pilot_course_line_key: `${input.record.application.selectedCourse.providerCode}:${input.record.application.selectedCourse.courseCode}`,
    pilot_course_title: input.record.application.selectedCourse.courseTitle,
    pilot_exception_state: getOpenExceptionState(input.record),
    pilot_metric_categories: buildEventCategories(eventName),
    pilot_note_count: input.record.notes.length,
    pilot_partner_id: input.record.application.selectedCourse.providerCode,
    pilot_partner_name: input.record.application.selectedCourse.providerName,
    pilot_priority: input.record.priority,
    pilot_provisioning_status: getLatestProvisioningStatus(input.record),
    pilot_queue_status: input.record.status,
    pilot_reconciliation_status: getLatestReconciliationStatus(input.record),
    pilot_rollout_mode: input.rolloutMode,
    pilot_schema_version: PILOT_TELEMETRY_SCHEMA_VERSION,
    pilot_surface: PILOT_SURFACE,
    ...input.properties,
  };
}

export function createRolloutModePilotTelemetryProperties(input: {
  actor: string;
  config: PartnerCourseRolloutConfig;
  nextMode: PartnerCourseRolloutMode;
  outcome: PartnerCourseRolloutTransitionOutcome;
  previousMode: PartnerCourseRolloutMode;
  reason: string;
}): PilotTelemetryProperties {
  return {
    pilot_actor_id_hash: hashAnalyticsIdentifierSync(input.actor),
    pilot_course_code: input.config.courseCode,
    pilot_course_line_key: `${input.config.partnerId}:${input.config.courseCode}`,
    pilot_course_title: input.config.courseTitle,
    pilot_metric_categories: buildEventCategories("admissions_rollout_mode_updated"),
    pilot_partner_id: input.config.partnerId,
    pilot_partner_name: input.config.partnerName,
    pilot_previous_rollout_mode: input.previousMode,
    pilot_rollout_mode: input.nextMode,
    pilot_rollout_reason_provided: input.reason.trim().length > 0,
    pilot_rollout_transition_count: input.config.transitions.length + 1,
    pilot_rollout_update_outcome: input.outcome,
    pilot_schema_version: PILOT_TELEMETRY_SCHEMA_VERSION,
    pilot_surface: PILOT_SURFACE,
  };
}

function validateProperty(
  eventName: PilotTelemetryEventName,
  property: string,
  rule: PilotTelemetryPropertyRule,
  value: unknown,
): PilotTelemetryValidationIssue[] {
  if (value === undefined) {
    return rule.required
      ? [
          {
            eventName,
            message: "Missing required telemetry property.",
            property,
          },
        ]
      : [];
  }

  if (rule.type === "string") {
    if (typeof value !== "string" || value.trim().length === 0) {
      return [
        {
          eventName,
          message: "Telemetry property must be a non-empty string.",
          property,
        },
      ];
    }

    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      return [
        {
          eventName,
          message: `Telemetry property must be one of: ${rule.allowedValues.join(", ")}.`,
          property,
        },
      ];
    }

    return [];
  }

  if (rule.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return [
        {
          eventName,
          message: "Telemetry property must be a finite number.",
          property,
        },
      ];
    }

    if (rule.min !== undefined && value < rule.min) {
      return [
        {
          eventName,
          message: `Telemetry property must be >= ${rule.min}.`,
          property,
        },
      ];
    }

    return [];
  }

  if (typeof value !== "boolean") {
    return [
      {
        eventName,
        message: "Telemetry property must be a boolean.",
        property,
      },
    ];
  }

  return [];
}

export function validatePilotTelemetryEvent(
  eventName: PilotTelemetryEventName,
  properties: PilotTelemetryProperties,
): PilotTelemetryValidationIssue[] {
  const definition = PILOT_TELEMETRY_EVENT_DEFINITIONS[eventName];
  return Object.entries(definition.properties).flatMap(([property, rule]) =>
    validateProperty(eventName, property, rule, properties[property]),
  );
}

export function validatePilotTelemetryBatch(
  events: Array<{
    eventName: PilotTelemetryEventName;
    properties: PilotTelemetryProperties;
  }>,
): PilotTelemetryValidationIssue[] {
  return events.flatMap((event) =>
    validatePilotTelemetryEvent(event.eventName, event.properties),
  );
}

export function captureAdmissionsPilotTelemetryEvent(
  eventName: AdmissionsPilotEventName,
  input: {
    actor: string;
    properties?: PilotTelemetryProperties;
    record: AdmissionsQueueRecord;
    rolloutMode: PartnerCourseRolloutMode;
  },
): PilotTelemetryValidationIssue[] {
  const properties = createAdmissionsPilotTelemetryProperties(eventName, input);
  const issues = validatePilotTelemetryEvent(eventName, properties);
  capturePostHogEvent(eventName, properties);
  return issues;
}

export function captureRolloutModePilotTelemetryEvent(input: {
  actor: string;
  config: PartnerCourseRolloutConfig;
  nextMode: PartnerCourseRolloutMode;
  outcome: PartnerCourseRolloutTransitionOutcome;
  previousMode: PartnerCourseRolloutMode;
  reason: string;
}): PilotTelemetryValidationIssue[] {
  const properties = createRolloutModePilotTelemetryProperties(input);
  const issues = validatePilotTelemetryEvent(
    "admissions_rollout_mode_updated",
    properties,
  );
  capturePostHogEvent("admissions_rollout_mode_updated", properties);
  return issues;
}

export function buildAdmissionsDecisionTelemetryProperties(input: {
  decisionOutcome: (typeof PILOT_DECISION_OUTCOMES)[number];
  downstreamAction: (typeof PILOT_DOWNSTREAM_ACTIONS)[number];
  provisioningTriggered: boolean;
  reasonCode: string;
  record: AdmissionsQueueRecord;
}): PilotTelemetryProperties {
  const latestDecision = input.record.decisionTrace.decisions.at(-1);
  const baseline = resolveDecisionTimingBaseline(input.record);

  return {
    pilot_adapter_mode: getLatestProvisioningAdapterMode(input.record),
    pilot_decision_outcome: input.decisionOutcome,
    pilot_decision_reason_code: input.reasonCode,
    pilot_downstream_action: input.downstreamAction,
    pilot_provisioning_triggered: input.provisioningTriggered,
    pilot_time_to_decision_hours: calculateAdmissionsTimeToDecisionHours(
      input.record,
      latestDecision?.decidedAt ?? input.record.lastActivityAt,
    ),
    pilot_time_to_decision_source: baseline.source,
  };
}
