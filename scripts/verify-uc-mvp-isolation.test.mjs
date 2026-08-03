import assert from "node:assert/strict";
import test from "node:test";
import {
  FROZEN_UC_DEMO,
  verifyUcMvpIsolation,
} from "./verify-uc-mvp-isolation.mjs";

function safeInput() {
  return {
    env: {
      ELIGIBILITY_SERVICE_URL: "https://eligibility-uc-mvp-staging.example/api/evaluate",
      POSTHOG_HOST: "https://eu.i.posthog.com",
      SENTRY_ENVIRONMENT: "uc-assessment-mvp",
      SUPABASE_URL: "https://mvp-project.supabase.co",
      UC_DEMO_ELIGIBILITY_DEPLOYMENT_ID: "demo-service",
      UC_DEMO_POSTHOG_PROJECT_ID: "demo-posthog",
      UC_DEMO_SUPABASE_PROJECT_REF: "demo-project",
      UC_MVP_ELIGIBILITY_DEPLOYMENT_ID: "mvp-staging-service",
      UC_MVP_POSTHOG_PROJECT_ID: "mvp-posthog",
      UC_MVP_SUPABASE_PROJECT_REF: "mvp-project",
      VITE_APP_BRAND: "uc",
      VITE_DEMO_MODE: "false",
      VITE_POSTHOG_HOST: "https://eu.i.posthog.com",
      VITE_SENTRY_ENVIRONMENT: "uc-assessment-mvp",
      VITE_SUPABASE_URL: "https://mvp-project.supabase.co",
    },
    project: { projectId: "prj_mvp", projectName: "application-uc-mvp" },
  };
}

test("accepts separate MVP projects and service targets", () => {
  assert.deepEqual(verifyUcMvpIsolation(safeInput()), {
    demoAliasProtected: true,
    eligibilityTargetsDifferent: true,
    postHogProjectsDifferent: true,
    supabaseProjectsDifferent: true,
    vercelProjectId: "prj_mvp",
    vercelProjectName: "application-uc-mvp",
  });
});

test("rejects the frozen demo Vercel project and alias", () => {
  const input = safeInput();
  input.project.projectId = FROZEN_UC_DEMO.vercelProjectId;
  input.env.ELIGIBILITY_SERVICE_URL = `https://${FROZEN_UC_DEMO.alias}/api`;
  assert.throws(
    () => verifyUcMvpIsolation(input),
    /Vercel project ID must differ[\s\S]*frozen-demo target/,
  );
});

test("rejects shared Supabase, PostHog, and eligibility targets", () => {
  const input = safeInput();
  input.env.UC_MVP_SUPABASE_PROJECT_REF = "demo-project";
  input.env.SUPABASE_URL = "https://demo-project.supabase.co";
  input.env.VITE_SUPABASE_URL = "https://demo-project.supabase.co";
  input.env.UC_MVP_POSTHOG_PROJECT_ID = "demo-posthog";
  input.env.UC_MVP_ELIGIBILITY_DEPLOYMENT_ID = "demo-service";
  assert.throws(
    () => verifyUcMvpIsolation(input),
    /Supabase project IDs must differ[\s\S]*PostHog project IDs must differ[\s\S]*eligibility deployment must differ/,
  );
});
