export {
  getApplicationStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";
export {
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
  trackCvParserSaveContinueClicked,
} from "./analytics/cvParserAnalytics";
export {
  associateCourseProviderGroup,
  canCapturePostHog,
  capturePostHogEvent,
  initPostHog,
  isPostHogEnabled,
  isReplayPiiRoute,
  onPostHogFeatureFlags,
  syncPostHogUser,
  syncReplayRoutePrivacy,
} from "./analytics/posthogClient";
export {
  captureApplicationStepEvent,
  getApplicationAnalyticsProperties,
  getCourseAnalyticsProperties,
  trackApplicationStepView,
  trackPostHogPageView,
} from "./analytics/posthogProperties";
export {
  isPostHogSensitiveRoute,
  sanitizeAnalyticsSearch,
  sanitizeAnalyticsUrl,
} from "./analytics/sanitizeAnalyticsUrl";
