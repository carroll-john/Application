/**
 * Single source of truth for every client-side analytics event name.
 *
 * Add new events here first: the name becomes part of `AnalyticsEventName`,
 * which `capturePostHogEvent` (and the narrower wrappers) accept — a name not
 * listed here fails to compile. `events.test.ts` keeps this catalog and the
 * tables in docs/analytics-events.md in sync, so after adding an event run
 * the tests and update the docs when prompted.
 *
 * Never rename a shipped event: PostHog dashboards, funnels and historical
 * data reference the exact strings below.
 */
export const ANALYTICS_EVENT_NAMES = [
  // PostHog reserved pageview, sent manually with sanitized URL properties
  // (see posthogProperties.trackPostHogPageView).
  "$pageview",

  // Core application funnel (docs/analytics-events.md §Core Funnel Events).
  "application_start_requested",
  "application_draft_created",
  "application_step_viewed",
  "application_step_completed",
  "application_submit_started",
  "application_submitted",

  // Submit-path outcomes.
  "application_submit_blocked",
  "application_submit_failed",

  // Application progress.
  "application_draft_resumed",
  "application_opened_from_dashboard",
  "application_saved_for_later",
  "application_sign_in_redirected",
  "eligibility_check_opened",
  "eligibility_check_completed",

  // Section 2 supporting-evidence flow (doc-first qualifications hub).
  "application_evidence_prompt_viewed",
  "application_evidence_section_skipped",
  "application_evidence_section_unskipped",
  "eligibility_feedback_submitted",

  // Auth.
  "auth_gate_opened",
  "auth_sign_in_attempted",
  "auth_sign_in_succeeded",
  "auth_sign_in_failed",
  "auth_sign_up_attempted",
  "auth_sign_up_confirmation_sent",
  "auth_sign_up_failed",
  "auth_password_reset_completed",

  // Record updates.
  "application_cv_saved",
  "application_cv_removed",
  "application_employment_experience_saved",
  "application_employment_experience_removed",
  "application_language_test_saved",
  "application_language_test_removed",
  "application_professional_accreditation_saved",
  "application_professional_accreditation_removed",
  "application_secondary_qualification_saved",
  "application_secondary_qualification_removed",
  "application_tertiary_qualification_saved",
  "application_tertiary_qualification_removed",

  // CV parser.
  "cv_parser_save_continue_clicked",
  "cv_parser_draft_succeeded",
  "cv_parser_draft_empty",
  "cv_parser_draft_failed",

  // Tertiary transcript parser.
  "tertiary_transcript_parser_save_continue_clicked",
  "tertiary_transcript_parser_draft_succeeded",
  "tertiary_transcript_parser_draft_empty",
  "tertiary_transcript_parser_draft_failed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * Properties for each event. Stage 1 keeps every event's properties open
 * (`Record<string, unknown>`); tighten individual entries to concrete shapes
 * per domain as follow-ups, without renaming anything.
 */
export type AnalyticsEventMap = Record<AnalyticsEventName, Record<string, unknown>>;

/**
 * Events captured through `captureApplicationStepEvent`, which resolves the
 * application-step definition from the pathname and attaches step context.
 */
export type ApplicationStepEventName = Extract<
  AnalyticsEventName,
  "application_step_completed" | "application_saved_for_later" | "application_submit_started"
>;

/** Record-update events emitted when application collections are persisted. */
export type ApplicationRecordEventName = Extract<
  AnalyticsEventName,
  | "application_cv_saved"
  | "application_cv_removed"
  | "application_employment_experience_saved"
  | "application_employment_experience_removed"
  | "application_language_test_saved"
  | "application_language_test_removed"
  | "application_professional_accreditation_saved"
  | "application_professional_accreditation_removed"
  | "application_secondary_qualification_saved"
  | "application_secondary_qualification_removed"
  | "application_tertiary_qualification_saved"
  | "application_tertiary_qualification_removed"
>;
