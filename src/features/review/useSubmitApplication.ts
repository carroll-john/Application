import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplication } from "../../context/ApplicationContext";
import {
  getSubmissionValidationIssues,
  type ValidationIssue,
} from "../../lib/applicationValidationSchema";
import { trackApplicationSubmitBlocked } from "../../lib/analytics/submitBlockedAnalytics";
import {
  captureApplicationStepEvent,
  capturePostHogEvent,
  getApplicationAnalyticsProperties,
} from "../../lib/posthog";
import { captureSentryException } from "../../lib/sentry";
import { sleep } from "../../lib/utils";

export function useSubmitApplication() {
  const navigate = useNavigate();
  const { data, markApplicationSubmitted } = useApplication();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationErrors = useMemo(
    () => getSubmissionValidationIssues(data),
    [data],
  );

  const groupedErrors = useMemo(
    () =>
      validationErrors.reduce<Record<string, Record<string, ValidationIssue[]>>>(
        (accumulator, error) => {
          accumulator[error.section] ??= {};
          accumulator[error.section][error.subsection] ??= [];
          accumulator[error.section][error.subsection].push(error);
          return accumulator;
        },
        {},
      ),
    [validationErrors],
  );

  async function handleSubmit() {
    setSubmitError(null);

    if (validationErrors.length > 0) {
      trackApplicationSubmitBlocked({
        application: data,
        validationIssues: validationErrors,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      captureApplicationStepEvent("application_submit_started", {
        application: data,
        pathname: "/review",
        properties: {
          validation_error_count: 0,
        },
      });
      await sleep(300);
      await markApplicationSubmitted();
      navigate("/submitted");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't submit the application right now. Please try again.";
      capturePostHogEvent("application_submit_failed", {
        ...getApplicationAnalyticsProperties(data),
        error_message: message,
      });
      captureSentryException(error, {
        extras: {
          activeApplicationId: data.applicationMeta.recordId ?? null,
          courseCode: data.applicationMeta.selectedCourse?.code ?? null,
          courseTitle: data.applicationMeta.selectedCourse?.title ?? null,
        },
        tags: {
          flow: "application_submit",
          screen: "review_and_submit",
        },
      });
      setSubmitError(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveAndExit() {
    setIsSubmitting(true);
    await sleep(600);
    navigate("/dashboard");
    setIsSubmitting(false);
  }

  return {
    groupedErrors,
    handleSaveAndExit,
    handleSubmit,
    isSubmitting,
    submitError,
    validationErrors,
  };
}
