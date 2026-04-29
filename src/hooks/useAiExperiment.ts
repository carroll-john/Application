import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AiExperimentState,
  capturePostHogEvent,
  getAiExperimentState,
  onPostHogFeatureFlags,
} from "../lib/posthog";

type AiExperimentEventProperties = Record<string, unknown>;

export interface UseAiExperimentOptions {
  /** PostHog feature flag key controlling cohort assignment. */
  flagKey: string;
  /** Prefix prepended to event names (e.g. `cv_parser` → `cv_parser_autofill_succeeded`). */
  eventPrefix: string;
  /**
   * Property name carrying the cohort flag in captured events. Defaults to
   * `experiment_enabled_for_cohort`. Existing experiments override this to
   * preserve historical PostHog dashboards.
   */
  cohortPropertyName?: string;
}

export interface UseAiExperimentReturn {
  state: AiExperimentState;
  /**
   * Captures `${eventPrefix}_experiment_exposure` with the standard cohort
   * properties merged in. Call this once per user-visible decision point
   * where the cohort assignment becomes meaningful.
   */
  recordExposure: (extraProperties?: AiExperimentEventProperties) => void;
  /**
   * Captures `${eventPrefix}_${suffix}` with the standard cohort properties
   * merged in (and overridden by anything the caller passes in extra).
   */
  recordEvent: (
    suffix: string,
    extraProperties?: AiExperimentEventProperties,
  ) => void;
  /** Returns the standard cohort properties without capturing anything. */
  buildProperties: (
    extraProperties?: AiExperimentEventProperties,
  ) => AiExperimentEventProperties;
}

const DEFAULT_COHORT_PROPERTY_NAME = "experiment_enabled_for_cohort";

export function useAiExperiment({
  flagKey,
  eventPrefix,
  cohortPropertyName = DEFAULT_COHORT_PROPERTY_NAME,
}: UseAiExperimentOptions): UseAiExperimentReturn {
  const [state, setState] = useState<AiExperimentState>(() =>
    getAiExperimentState(flagKey),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const sync = () => {
      setState(getAiExperimentState(flagKey));
    };

    sync();

    const stopListening = onPostHogFeatureFlags(sync);
    return () => {
      stopListening();
    };
  }, [flagKey]);

  const buildProperties = useCallback<UseAiExperimentReturn["buildProperties"]>(
    (extraProperties) => {
      const current = stateRef.current;
      return {
        feature_flag_key: flagKey,
        [cohortPropertyName]: current.enabled,
        variant: current.variant ?? "none",
        ...extraProperties,
      };
    },
    [flagKey, cohortPropertyName],
  );

  const recordExposure = useCallback<UseAiExperimentReturn["recordExposure"]>(
    (extraProperties) => {
      const current = stateRef.current;
      capturePostHogEvent(`${eventPrefix}_experiment_exposure`, {
        experiment_source: current.source,
        ...buildProperties(extraProperties),
      });
    },
    [eventPrefix, buildProperties],
  );

  const recordEvent = useCallback<UseAiExperimentReturn["recordEvent"]>(
    (suffix, extraProperties) => {
      capturePostHogEvent(
        `${eventPrefix}_${suffix}`,
        buildProperties(extraProperties),
      );
    },
    [eventPrefix, buildProperties],
  );

  return useMemo(
    () => ({ state, recordExposure, recordEvent, buildProperties }),
    [state, recordExposure, recordEvent, buildProperties],
  );
}
