import { afterEach, describe, expect, it } from "vitest";
import {
  AssessmentApiError,
  getAssessmentEnvironment,
  requireAssessmentTreatmentEnabled,
} from "./server";

const KEYS = [
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "UC_DEMO_SUPABASE_PROJECT_REF",
  "UC_MVP_SUPABASE_PROJECT_REF",
  "UC_ASSESSMENT_TREATMENT_ENABLED",
] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function configure(projectRef = "mvp-project") {
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_URL = `https://${projectRef}.supabase.co`;
  process.env.UC_DEMO_SUPABASE_PROJECT_REF = "demo-project";
  process.env.UC_MVP_SUPABASE_PROJECT_REF = projectRef;
}

afterEach(() => {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("assessment environment isolation", () => {
  it("accepts matching MVP-only Supabase configuration", () => {
    configure();
    expect(getAssessmentEnvironment()).toMatchObject({
      pilotProjectRef: "mvp-project",
      url: "https://mvp-project.supabase.co",
    });
  });

  it("fails closed when the URL and declared MVP project differ", () => {
    configure();
    process.env.SUPABASE_URL = "https://other-project.supabase.co";
    expect(() => getAssessmentEnvironment()).toThrowError(
      expect.objectContaining({ code: "ASSESSMENT_PROJECT_MISMATCH" }),
    );
  });

  it("blocks the frozen demo Supabase project", () => {
    configure("demo-project");
    try {
      getAssessmentEnvironment();
      throw new Error("Expected isolation guard to reject the demo project.");
    } catch (error) {
      expect(error).toBeInstanceOf(AssessmentApiError);
      expect((error as AssessmentApiError).code).toBe(
        "ASSESSMENT_DEMO_DEPENDENCY_BLOCKED",
      );
    }
  });

  it("fails closed unless the treatment switch is explicitly enabled", () => {
    delete process.env.UC_ASSESSMENT_TREATMENT_ENABLED;
    expect(() => requireAssessmentTreatmentEnabled()).toThrowError(
      expect.objectContaining({ code: "ASSESSMENT_TREATMENT_DISABLED" }),
    );
    process.env.UC_ASSESSMENT_TREATMENT_ENABLED = "true";
    expect(() => requireAssessmentTreatmentEnabled()).not.toThrow();
  });
});
