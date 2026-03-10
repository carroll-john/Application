import type { CanonicalApplicationV1 } from "../integrationPlatform/contracts";
import { universityExportMappingConfigSamples } from "../integrationPlatform/examples";
import { universityMappingOverlaySamples } from "../integrationPlatform/examples";

export const PARTNER_COURSE_ROLLOUT_STORAGE_KEY =
  "application-prototype:partner-course-rollout:v1";

export type PartnerCourseRolloutMode =
  | "mode-1-review-only"
  | "mode-2-decision-export"
  | "mode-3-automated-provisioning";

export type PartnerCourseRolloutTransitionOutcome = "applied" | "rejected";

export interface PartnerCourseRolloutModeDefinition {
  automatedProvisioning: boolean;
  decisionCaptureEnabled: boolean;
  downstreamAction: "none" | "export" | "automated-provisioning";
  label: string;
  operatorSummary: string;
  shortLabel: string;
  tone: "warning" | "info" | "success";
}

export interface PartnerCourseRolloutTransition {
  actor: string;
  eventId: string;
  fromMode?: PartnerCourseRolloutMode;
  occurredAt: string;
  outcome: PartnerCourseRolloutTransitionOutcome;
  reason: string;
  toMode: PartnerCourseRolloutMode;
  validationErrors?: string[];
}

export interface PartnerCourseRolloutConfig {
  activeMode: PartnerCourseRolloutMode;
  configId: string;
  courseCode: string;
  courseTitle: string;
  partnerId: string;
  partnerName: string;
  transitions: PartnerCourseRolloutTransition[];
  updatedAt: string;
  updatedBy: string;
}

export interface PartnerCourseRolloutSnapshot {
  config?: PartnerCourseRolloutConfig;
  definition: PartnerCourseRolloutModeDefinition;
  isFallback: boolean;
  mode: PartnerCourseRolloutMode;
}

export interface TransitionPartnerCourseRolloutModeResult {
  config?: PartnerCourseRolloutConfig;
  configs: PartnerCourseRolloutConfig[];
  transition?: PartnerCourseRolloutTransition;
  valid: boolean;
  validationErrors: string[];
}

const ROLLOUT_MODE_DEFINITIONS: Record<
  PartnerCourseRolloutMode,
  PartnerCourseRolloutModeDefinition
> = {
  "mode-1-review-only": {
    automatedProvisioning: false,
    decisionCaptureEnabled: false,
    downstreamAction: "none",
    label: "Mode 1 · Review only",
    operatorSummary:
      "Review, assignment, and document checks stay in the portal. Decisions and downstream handoff remain outside the platform.",
    shortLabel: "Mode 1",
    tone: "warning",
  },
  "mode-2-decision-export": {
    automatedProvisioning: false,
    decisionCaptureEnabled: true,
    downstreamAction: "export",
    label: "Mode 2 · Decision and export",
    operatorSummary:
      "Decisions are captured in the portal. Approved outcomes generate a structured export package for manual or import-runner handoff.",
    shortLabel: "Mode 2",
    tone: "info",
  },
  "mode-3-automated-provisioning": {
    automatedProvisioning: true,
    decisionCaptureEnabled: true,
    downstreamAction: "automated-provisioning",
    label: "Mode 3 · Automated provisioning",
    operatorSummary:
      "Decisions are captured in the portal and approved outcomes trigger automated downstream provisioning through the configured adapter.",
    shortLabel: "Mode 3",
    tone: "success",
  },
};

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function createTransitionEventId(
  partnerId: string,
  courseCode: string,
  occurredAt: string,
  toMode: PartnerCourseRolloutMode,
): string {
  return [
    "rollout",
    sanitizeToken(partnerId),
    sanitizeToken(courseCode),
    String(Date.parse(occurredAt)),
    sanitizeToken(toMode),
  ].join("-");
}

function cloneTransition(
  transition: PartnerCourseRolloutTransition,
): PartnerCourseRolloutTransition {
  return {
    ...transition,
    validationErrors: transition.validationErrors
      ? [...transition.validationErrors]
      : undefined,
  };
}

function cloneConfig(config: PartnerCourseRolloutConfig): PartnerCourseRolloutConfig {
  return {
    ...config,
    transitions: config.transitions.map((transition) => cloneTransition(transition)),
  };
}

function normalizeConfig(config: PartnerCourseRolloutConfig): PartnerCourseRolloutConfig {
  return {
    ...config,
    transitions: (config.transitions ?? []).map((transition) =>
      cloneTransition(transition),
    ),
  };
}

function hasExportTemplate(partnerId: string): boolean {
  return universityExportMappingConfigSamples.some(
    (template) => template.partnerId === partnerId,
  );
}

function hasMappingOverlay(partnerId: string): boolean {
  return universityMappingOverlaySamples.some((overlay) => overlay.partnerId === partnerId);
}

function isAuthorizedRolloutActor(actor: string): boolean {
  const normalizedActor = actor.trim().toLowerCase();
  return normalizedActor.endsWith("@keypath.com.au");
}

export function getPartnerCourseRolloutModeDefinition(
  mode: PartnerCourseRolloutMode,
): PartnerCourseRolloutModeDefinition {
  return ROLLOUT_MODE_DEFINITIONS[mode];
}

export function createSeedPartnerCourseRolloutConfigs(): PartnerCourseRolloutConfig[] {
  const seedRows: Array<Omit<PartnerCourseRolloutConfig, "configId" | "transitions">> = [
    {
      activeMode: "mode-3-automated-provisioning",
      courseCode: "MBA-ONLINE",
      courseTitle: "Master of Business Administration",
      partnerId: "SCU",
      partnerName: "Southern Coast University",
      updatedAt: "2026-03-03T02:00:00Z",
      updatedBy: "ops.lead@keypath.com.au",
    },
    {
      activeMode: "mode-2-decision-export",
      courseCode: "GC-PM",
      courseTitle: "Graduate Certificate in Project Management",
      partnerId: "TIU",
      partnerName: "Tasman Institute of Technology",
      updatedAt: "2026-03-04T01:30:00Z",
      updatedBy: "ops.lead@keypath.com.au",
    },
    {
      activeMode: "mode-1-review-only",
      courseCode: "BN-HEALTH",
      courseTitle: "Bachelor of Nursing",
      partnerId: "HHI",
      partnerName: "Harbour Health Institute",
      updatedAt: "2026-03-05T00:45:00Z",
      updatedBy: "ops.lead@keypath.com.au",
    },
  ];

  return seedRows.map((row) => ({
    ...row,
    configId: `rollout-${sanitizeToken(row.partnerId)}-${sanitizeToken(row.courseCode)}`,
    transitions: [
      {
        actor: row.updatedBy,
        eventId: createTransitionEventId(
          row.partnerId,
          row.courseCode,
          row.updatedAt,
          row.activeMode,
        ),
        occurredAt: row.updatedAt,
        outcome: "applied",
        reason:
          row.activeMode === "mode-3-automated-provisioning"
            ? "Automated provisioning approved for the pilot partner course line."
            : row.activeMode === "mode-2-decision-export"
              ? "Structured export handoff is active while partner import remains supervised."
              : "Review-only mode is active while manual downstream entry remains outside the portal.",
        toMode: row.activeMode,
      },
    ],
  }));
}

export function loadPartnerCourseRolloutConfigs(): PartnerCourseRolloutConfig[] {
  if (typeof window === "undefined") {
    return createSeedPartnerCourseRolloutConfigs();
  }

  try {
    const storedValue = window.localStorage.getItem(PARTNER_COURSE_ROLLOUT_STORAGE_KEY);
    if (storedValue) {
      const parsed = JSON.parse(storedValue) as PartnerCourseRolloutConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((config) => normalizeConfig(config));
      }
    }
  } catch {
    // Fall back to seeded state.
  }

  const seeded = createSeedPartnerCourseRolloutConfigs();
  savePartnerCourseRolloutConfigs(seeded);
  return seeded;
}

export function savePartnerCourseRolloutConfigs(
  configs: PartnerCourseRolloutConfig[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PARTNER_COURSE_ROLLOUT_STORAGE_KEY,
      JSON.stringify(configs),
    );
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

export function findPartnerCourseRolloutConfig(
  configs: PartnerCourseRolloutConfig[],
  input: {
    courseCode: string;
    partnerId: string;
  },
): PartnerCourseRolloutConfig | undefined {
  return configs
    .map((config) => cloneConfig(config))
    .find(
      (config) =>
        config.partnerId === input.partnerId && config.courseCode === input.courseCode,
    );
}

export function getPartnerCourseRolloutSnapshot(
  application: CanonicalApplicationV1,
  configs: PartnerCourseRolloutConfig[],
): PartnerCourseRolloutSnapshot {
  const config = findPartnerCourseRolloutConfig(configs, {
    courseCode: application.selectedCourse.courseCode,
    partnerId: application.selectedCourse.providerCode,
  });

  if (config) {
    return {
      config,
      definition: getPartnerCourseRolloutModeDefinition(config.activeMode),
      isFallback: false,
      mode: config.activeMode,
    };
  }

  return {
    definition: getPartnerCourseRolloutModeDefinition("mode-1-review-only"),
    isFallback: true,
    mode: "mode-1-review-only",
  };
}

export function transitionPartnerCourseRolloutMode(
  configs: PartnerCourseRolloutConfig[],
  input: {
    actor: string;
    courseCode: string;
    courseTitle?: string;
    nextMode: PartnerCourseRolloutMode;
    occurredAt?: string;
    partnerId: string;
    partnerName?: string;
    reason: string;
  },
): TransitionPartnerCourseRolloutModeResult {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const nextConfigs = configs.map((config) => cloneConfig(config));
  const configIndex = nextConfigs.findIndex(
    (config) =>
      config.partnerId === input.partnerId && config.courseCode === input.courseCode,
  );
  const currentConfig = configIndex >= 0 ? nextConfigs[configIndex] : undefined;
  const validationErrors: string[] = [];

  if (!isAuthorizedRolloutActor(input.actor)) {
    validationErrors.push("Only authorized Keypath operators can change rollout modes.");
  }

  if (!input.reason.trim()) {
    validationErrors.push("A rollout transition reason is required.");
  }

  if (currentConfig && currentConfig.activeMode === input.nextMode) {
    validationErrors.push("The selected rollout mode is already active for this course line.");
  }

  if (!currentConfig && !input.partnerName?.trim()) {
    validationErrors.push("partnerName is required when creating a new rollout config.");
  }

  if (!currentConfig && !input.courseTitle?.trim()) {
    validationErrors.push("courseTitle is required when creating a new rollout config.");
  }

  if (input.nextMode === "mode-2-decision-export" && !hasExportTemplate(input.partnerId)) {
    validationErrors.push(
      "Mode 2 requires a structured export template for the selected partner.",
    );
  }

  if (
    input.nextMode === "mode-3-automated-provisioning" &&
    !hasMappingOverlay(input.partnerId)
  ) {
    validationErrors.push(
      "Mode 3 requires a registered university mapping overlay for the selected partner.",
    );
  }

  const transition: PartnerCourseRolloutTransition = {
    actor: input.actor,
    eventId: createTransitionEventId(
      input.partnerId,
      input.courseCode,
      occurredAt,
      input.nextMode,
    ),
    fromMode: currentConfig?.activeMode,
    occurredAt,
    outcome: validationErrors.length === 0 ? "applied" : "rejected",
    reason: input.reason.trim(),
    toMode: input.nextMode,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };

  if (currentConfig) {
    currentConfig.transitions = [...currentConfig.transitions, transition];
  }

  if (validationErrors.length > 0) {
    return {
      config: currentConfig,
      configs: nextConfigs,
      transition,
      valid: false,
      validationErrors,
    };
  }

  const nextConfig: PartnerCourseRolloutConfig = currentConfig
    ? {
        ...currentConfig,
        activeMode: input.nextMode,
        updatedAt: occurredAt,
        updatedBy: input.actor,
      }
    : {
        activeMode: input.nextMode,
        configId: `rollout-${sanitizeToken(input.partnerId)}-${sanitizeToken(input.courseCode)}`,
        courseCode: input.courseCode,
        courseTitle: input.courseTitle!.trim(),
        partnerId: input.partnerId,
        partnerName: input.partnerName!.trim(),
        transitions: [transition],
        updatedAt: occurredAt,
        updatedBy: input.actor,
      };

  if (configIndex >= 0) {
    nextConfigs[configIndex] = nextConfig;
  } else {
    nextConfigs.push(nextConfig);
  }

  return {
    config: nextConfig,
    configs: nextConfigs,
    transition,
    valid: true,
    validationErrors: [],
  };
}
