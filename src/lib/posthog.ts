export {
  getApplicationStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";
export {
  type AnalyticsEventMap,
  type AnalyticsEventName,
  type ApplicationRecordEventName,
  type ApplicationStepEventName,
} from "./analytics/events";
export {
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
  trackCvParserSaveContinueClicked,
} from "./analytics/cvParserAnalytics";
export {
  getTertiaryTranscriptParserErrorCode,
  trackTertiaryTranscriptParserDraftEmpty,
  trackTertiaryTranscriptParserDraftFailed,
  trackTertiaryTranscriptParserDraftSucceeded,
  trackTertiaryTranscriptParserSaveContinueClicked,
} from "./analytics/tertiaryTranscriptParserAnalytics";
export {
  trackEligibilityFeedbackSubmitted,
  trackEvidencePromptViewed,
  trackEvidenceSectionSkipped,
  trackEvidenceSectionUnskipped,
} from "./analytics/evidenceFlowAnalytics";
export { trackApplicationSubmitBlocked } from "./analytics/submitBlockedAnalytics";
export {
  associateCourseProviderGroup,
  capturePostHogEvent,
  initPostHog,
  isPostHogEnabled,
  isPublicAutocaptureRoute,
  isReplayPiiRoute,
  isSyntheticTestSession,
  syncPostHogUser,
  syncReplayRoutePrivacy,
} from "./analytics/posthogClient";
export {
  getPostHogSupportState,
  hidePostHogSupportWidget,
  sendPostHogSupportTicket,
} from "./analytics/posthogSupport";
export { isPostHogSensitiveRoute } from "./analytics/sanitizeAnalyticsUrl";
export {
  captureApplicationStepEvent,
  getApplicationAnalyticsProperties,
  getCourseAnalyticsProperties,
  trackApplicationStepView,
  trackPostHogPageView,
} from "./analytics/posthogProperties";
