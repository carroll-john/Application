export {
  getApplicationStepDefinition,
  getRequiredFunnelStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";
export {
  canCapturePostHog,
  capturePostHogEvent,
  initPostHog,
  isPostHogEnabled,
  onPostHogFeatureFlags,
  syncPostHogUser,
} from "./analytics/posthogClient";
export {
  getAiExperimentState,
  getCvParserExperimentState,
} from "./analytics/posthogExperiments";
export {
  captureApplicationStepEvent,
  getApplicationAnalyticsProperties,
  getCourseAnalyticsProperties,
  trackApplicationStepView,
  trackPostHogPageView,
} from "./analytics/posthogProperties";
export {
  CV_PARSER_FEATURE_FLAG_KEY,
  type AiExperimentState,
  type CvParserExperimentState,
} from "./analytics/posthogTypes";
