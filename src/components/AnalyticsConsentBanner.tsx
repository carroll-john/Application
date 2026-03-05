import { useEffect, useState } from "react";
import {
  onAnalyticsConsentChange,
  setAnalyticsConsent,
  shouldPromptForAnalyticsConsent,
} from "../lib/analyticsConsent";
import { Button } from "./ui/button";

export function AnalyticsConsentBanner() {
  const [isVisible, setIsVisible] = useState(() => shouldPromptForAnalyticsConsent());

  useEffect(() => {
    const syncVisibility = () => {
      setIsVisible(shouldPromptForAnalyticsConsent());
    };

    const unsubscribe = onAnalyticsConsentChange(syncVisibility);
    syncVisibility();

    return unsubscribe;
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 px-4 sm:bottom-6 sm:px-6 lg:px-8">
      <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-900 sm:text-base">
            Help us improve the application experience
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
            We use privacy-safe analytics to understand flow quality. You can
            allow or decline analytics capture for this browser.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="w-full sm:w-auto"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setAnalyticsConsent(false)}
          >
            Decline
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            type="button"
            onClick={() => setAnalyticsConsent(true)}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
