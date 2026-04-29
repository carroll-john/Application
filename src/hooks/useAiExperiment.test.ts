import { describe, expect, it } from "vitest";
import type { AiExperimentState } from "../lib/posthog";
import {
  buildAiExperimentProperties,
  getAiExperimentEventName,
  getAiExperimentExposureEventName,
} from "./useAiExperiment";

const enabledState: AiExperimentState = {
  enabled: true,
  source: "posthog",
  variant: "treatment",
};

const disabledFallbackState: AiExperimentState = {
  enabled: false,
  source: "fallback",
  variant: null,
};

describe("buildAiExperimentProperties", () => {
  it("returns the standard cohort properties using the default cohort name", () => {
    expect(buildAiExperimentProperties(enabledState, "my_flag")).toEqual({
      feature_flag_key: "my_flag",
      experiment_enabled_for_cohort: true,
      variant: "treatment",
    });
  });

  it("respects an overridden cohort property name for legacy dashboards", () => {
    expect(
      buildAiExperimentProperties(
        enabledState,
        "cv_parser_autofill_experiment",
        "parser_enabled_for_cohort",
      ),
    ).toEqual({
      feature_flag_key: "cv_parser_autofill_experiment",
      parser_enabled_for_cohort: true,
      variant: "treatment",
    });
  });

  it("uses 'none' when the variant is null", () => {
    expect(buildAiExperimentProperties(disabledFallbackState, "f")).toEqual({
      feature_flag_key: "f",
      experiment_enabled_for_cohort: false,
      variant: "none",
    });
  });

  it("merges extra properties without losing standard fields", () => {
    expect(
      buildAiExperimentProperties(enabledState, "f", undefined, {
        drafted_roles_count: 3,
        parse_duration_ms: 1200,
      }),
    ).toEqual({
      feature_flag_key: "f",
      experiment_enabled_for_cohort: true,
      variant: "treatment",
      drafted_roles_count: 3,
      parse_duration_ms: 1200,
    });
  });

  it("lets explicit extra properties override the standard cohort fields", () => {
    expect(
      buildAiExperimentProperties(enabledState, "f", undefined, {
        variant: "override-variant",
      }).variant,
    ).toBe("override-variant");
  });
});

describe("event-name helpers", () => {
  it("composes exposure event names from the prefix", () => {
    expect(getAiExperimentExposureEventName("cv_parser")).toBe(
      "cv_parser_experiment_exposure",
    );
  });

  it("composes generic event names from prefix and suffix", () => {
    expect(getAiExperimentEventName("cv_parser", "autofill_succeeded")).toBe(
      "cv_parser_autofill_succeeded",
    );
    expect(getAiExperimentEventName("rpl_assessor", "started")).toBe(
      "rpl_assessor_started",
    );
  });
});
