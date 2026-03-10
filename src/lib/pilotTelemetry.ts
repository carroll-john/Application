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
export const PILOT_TELEMETRY_STORAGE_KEY =
  "application-prototype:pilot-telemetry:v1";

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

export interface PilotTelemetryEventRecord {
  eventId: string;
  eventName: PilotTelemetryEventName;
  occurredAt: string;
  properties: PilotTelemetryProperties;
}

export interface PilotTelemetryEventFilter {
  adapterMode?: string;
  actorIdHash?: string;
  courseCode?: string;
  courseLineKey?: string;
  eventNames?: PilotTelemetryEventName[];
  partnerId?: string;
  partnerName?: string;
  rolloutMode?: PartnerCourseRolloutMode;
  since?: string;
  until?: string;
}

export interface PilotTelemetryCoverageCheck {
  detail: string;
  key:
    | "queue-activity"
    | "decision-flow"
    | "document-flow"
    | "handover-flow"
    | "schema-validation";
  passed: boolean;
}

export interface PilotTelemetryCoverageReport {
  checks: PilotTelemetryCoverageCheck[];
  issueCount: number;
  passed: boolean;
  validationIssues: PilotTelemetryValidationIssue[];
}

export interface AdmissionsPilotTelemetrySummary {
  averageTimeToDecisionHours: number | null;
  coverage: PilotTelemetryCoverageReport;
  decisionCount: number;
  medianTimeToDecisionHours: number | null;
  totalEvents: number;
  weeklyActiveReviewers: number;
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

function clonePilotTelemetryEventRecord(
  event: PilotTelemetryEventRecord,
): PilotTelemetryEventRecord {
  return {
    ...event,
    properties: { ...event.properties },
  };
}

function createPilotTelemetryEventId(
  eventName: PilotTelemetryEventName,
  occurredAt: string,
  properties: PilotTelemetryProperties,
): string {
  return [
    "pilot-telemetry",
    eventName,
    String(Date.parse(occurredAt) || occurredAt),
    String(properties.pilot_application_id ?? properties.pilot_course_line_key ?? "unknown"),
    String(properties.pilot_actor_id_hash ?? "anonymous"),
  ].join(":");
}

function isWithinRange(
  value: string,
  range: { since?: string; until?: string },
): boolean {
  const target = Date.parse(value);
  if (!Number.isFinite(target)) {
    return false;
  }

  if (range.since) {
    const since = Date.parse(range.since);
    if (Number.isFinite(since) && target < since) {
      return false;
    }
  }

  if (range.until) {
    const until = Date.parse(range.until);
    if (Number.isFinite(until) && target > until) {
      return false;
    }
  }

  return true;
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(2),
  );
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }

  return Number(sorted[middle].toFixed(2));
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

export function loadPilotTelemetryEvents(): PilotTelemetryEventRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(PILOT_TELEMETRY_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue) as PilotTelemetryEventRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((event) => clonePilotTelemetryEventRecord(event));
  } catch {
    return [];
  }
}

export function savePilotTelemetryEvents(
  events: PilotTelemetryEventRecord[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PILOT_TELEMETRY_STORAGE_KEY,
      JSON.stringify(events),
    );
  } catch {
    // Ignore storage failures and keep client telemetry best-effort.
  }
}

export function clearPilotTelemetryEvents(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(PILOT_TELEMETRY_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep client telemetry best-effort.
  }
}

export function appendPilotTelemetryEvent(
  event: PilotTelemetryEventRecord,
): PilotTelemetryEventRecord[] {
  const nextEvents = [
    ...loadPilotTelemetryEvents().filter(
      (candidate) => candidate.eventId !== event.eventId,
    ),
    clonePilotTelemetryEventRecord(event),
  ];
  savePilotTelemetryEvents(nextEvents);
  return nextEvents;
}

export function filterPilotTelemetryEvents(
  events: PilotTelemetryEventRecord[],
  filters: PilotTelemetryEventFilter = {},
): PilotTelemetryEventRecord[] {
  const eventNames = filters.eventNames ? new Set(filters.eventNames) : null;

  return events.filter((event) => {
    const properties = event.properties;

    return (
      (eventNames ? eventNames.has(event.eventName) : true) &&
      (filters.partnerId
        ? properties.pilot_partner_id === filters.partnerId
        : true) &&
      (filters.partnerName
        ? properties.pilot_partner_name === filters.partnerName
        : true) &&
      (filters.courseCode
        ? properties.pilot_course_code === filters.courseCode
        : true) &&
      (filters.courseLineKey
        ? properties.pilot_course_line_key === filters.courseLineKey
        : true) &&
      (filters.rolloutMode
        ? properties.pilot_rollout_mode === filters.rolloutMode
        : true) &&
      (filters.adapterMode
        ? properties.pilot_adapter_mode === filters.adapterMode
        : true) &&
      (filters.actorIdHash
        ? properties.pilot_actor_id_hash === filters.actorIdHash
        : true) &&
      isWithinRange(event.occurredAt, {
        since: filters.since,
        until: filters.until,
      })
    );
  });
}

export function listPilotTelemetryEvents(
  filters: PilotTelemetryEventFilter = {},
): PilotTelemetryEventRecord[] {
  return filterPilotTelemetryEvents(loadPilotTelemetryEvents(), filters);
}

function buildPilotTelemetryCoverageChecks(
  events: PilotTelemetryEventRecord[],
): PilotTelemetryCoverageCheck[] {
  const validationIssues = validatePilotTelemetryBatch(
    events.map((event) => ({
      eventName: event.eventName,
      properties: event.properties,
    })),
  );

  return [
    {
      detail:
        "Queue activity should include review-open, assignment, or status transitions.",
      key: "queue-activity",
      passed: events.some((event) =>
        [
          "admissions_queue_review_opened",
          "admissions_queue_assignment_updated",
          "admissions_status_updated",
        ].includes(event.eventName),
      ),
    },
    {
      detail:
        "Decision flow should include immutable decision capture with time-to-decision dimensions.",
      key: "decision-flow",
      passed: events.some(
        (event) => event.eventName === "admissions_decision_captured",
      ),
    },
    {
      detail:
        "Document flow should include at least one secure preview outcome for admissions evidence.",
      key: "document-flow",
      passed: events.some((event) =>
        [
          "admissions_document_preview_opened",
          "admissions_document_preview_blocked",
        ].includes(event.eventName),
      ),
    },
    {
      detail:
        "Handover flow should include operational note or assignment activity for reviewer collaboration.",
      key: "handover-flow",
      passed: events.some((event) =>
        [
          "admissions_note_added",
          "admissions_queue_assignment_updated",
        ].includes(event.eventName),
      ),
    },
    {
      detail:
        "All stored events should satisfy the pilot telemetry schema validation rules.",
      key: "schema-validation",
      passed: validationIssues.length === 0,
    },
  ];
}

export function buildPilotTelemetryCoverageReport(
  events: PilotTelemetryEventRecord[],
  filters: PilotTelemetryEventFilter = {},
): PilotTelemetryCoverageReport {
  const filteredEvents = filterPilotTelemetryEvents(events, filters);
  const validationIssues = validatePilotTelemetryBatch(
    filteredEvents.map((event) => ({
      eventName: event.eventName,
      properties: event.properties,
    })),
  );
  const checks = buildPilotTelemetryCoverageChecks(filteredEvents);

  return {
    checks,
    issueCount: checks.filter((check) => !check.passed).length,
    passed: checks.every((check) => check.passed),
    validationIssues,
  };
}

export function buildAdmissionsPilotTelemetrySummary(
  events: PilotTelemetryEventRecord[],
  filters: PilotTelemetryEventFilter = {},
): AdmissionsPilotTelemetrySummary {
  const filteredEvents = filterPilotTelemetryEvents(events, filters);
  const decisionEvents = filteredEvents.filter(
    (event) => event.eventName === "admissions_decision_captured",
  );
  const timeToDecisionHours = decisionEvents
    .map((event) => event.properties.pilot_time_to_decision_hours)
    .filter((value): value is number => typeof value === "number");
  const referenceTimestamp =
    filteredEvents.at(-1)?.occurredAt ?? new Date().toISOString();
  const weeklyReviewerEvents = filteredEvents.filter((event) =>
    [
      "admissions_queue_review_opened",
      "admissions_decision_captured",
      "admissions_document_preview_opened",
      "admissions_note_added",
    ].includes(event.eventName),
  );
  const weeklyWindowStart = new Date(referenceTimestamp);
  weeklyWindowStart.setDate(weeklyWindowStart.getDate() - 7);
  const activeReviewers = new Set(
    filterPilotTelemetryEvents(weeklyReviewerEvents, {
      since: weeklyWindowStart.toISOString(),
      until: referenceTimestamp,
    })
      .map((event) => event.properties.pilot_actor_id_hash)
      .filter((value): value is string => typeof value === "string"),
  );

  return {
    averageTimeToDecisionHours: calculateAverage(timeToDecisionHours),
    coverage: buildPilotTelemetryCoverageReport(filteredEvents),
    decisionCount: decisionEvents.length,
    medianTimeToDecisionHours: calculateMedian(timeToDecisionHours),
    totalEvents: filteredEvents.length,
    weeklyActiveReviewers: activeReviewers.size,
  };
}

function recordPilotTelemetryEvent(
  eventName: PilotTelemetryEventName,
  properties: PilotTelemetryProperties,
  occurredAt = new Date().toISOString(),
): PilotTelemetryValidationIssue[] {
  const issues = validatePilotTelemetryEvent(eventName, properties);
  const eventRecord: PilotTelemetryEventRecord = {
    eventId: createPilotTelemetryEventId(eventName, occurredAt, properties),
    eventName,
    occurredAt,
    properties: { ...properties },
  };

  appendPilotTelemetryEvent(eventRecord);
  capturePostHogEvent(eventName, properties);
  return issues;
}

export function captureAdmissionsPilotTelemetryEvent(
  eventName: AdmissionsPilotEventName,
  input: {
    actor: string;
    occurredAt?: string;
    properties?: PilotTelemetryProperties;
    record: AdmissionsQueueRecord;
    rolloutMode: PartnerCourseRolloutMode;
  },
): PilotTelemetryValidationIssue[] {
  const properties = createAdmissionsPilotTelemetryProperties(eventName, input);
  return recordPilotTelemetryEvent(eventName, properties, input.occurredAt);
}

export function captureRolloutModePilotTelemetryEvent(input: {
  actor: string;
  config: PartnerCourseRolloutConfig;
  nextMode: PartnerCourseRolloutMode;
  occurredAt?: string;
  outcome: PartnerCourseRolloutTransitionOutcome;
  previousMode: PartnerCourseRolloutMode;
  reason: string;
}): PilotTelemetryValidationIssue[] {
  const properties = createRolloutModePilotTelemetryProperties(input);
  return recordPilotTelemetryEvent(
    "admissions_rollout_mode_updated",
    properties,
    input.occurredAt,
  );
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
