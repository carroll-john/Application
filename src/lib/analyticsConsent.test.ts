import { describe, expect, it } from "vitest";
import {
  getAnalyticsConsentDecision,
  hasAnalyticsConsent,
  shouldPromptForAnalyticsConsent,
} from "./analyticsConsent";

describe("analytics consent defaults", () => {
  it("defaults to denied when no browser storage is available", () => {
    expect(getAnalyticsConsentDecision()).toBe("denied");
    expect(hasAnalyticsConsent()).toBe(false);
    expect(shouldPromptForAnalyticsConsent()).toBe(false);
  });
});
