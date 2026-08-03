import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FROZEN_UC_DEMO = {
  alias: "uc-vc-demo.vercel.app",
  deploymentId: "dpl_DLFwvtFngQFTBCaFJhFL2Xfh9Zxk",
  directUrl:
    "application-prototype-hs6k75e5h-carroll-john-3665s-projects.vercel.app",
  vercelProjectId: "prj_YT7ILpPzCobZbN8VexieyYCEHZyk",
};

const MVP_PROJECT_NAME = "application-uc-mvp";

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function requireValue(errors, env, name) {
  const value = env[name]?.trim();
  if (!value) errors.push(`${name} is required.`);
  return value ?? "";
}

export function verifyUcMvpIsolation({ env, project }) {
  const errors = [];
  if (project.projectName !== MVP_PROJECT_NAME) {
    errors.push(`Vercel project must be ${MVP_PROJECT_NAME}.`);
  }
  if (!project.projectId || project.projectId === FROZEN_UC_DEMO.vercelProjectId) {
    errors.push("MVP Vercel project ID must differ from the frozen demo project.");
  }

  const pilotSupabaseRef = requireValue(
    errors,
    env,
    "UC_MVP_SUPABASE_PROJECT_REF",
  );
  const demoSupabaseRef = requireValue(
    errors,
    env,
    "UC_DEMO_SUPABASE_PROJECT_REF",
  );
  const serverSupabaseUrl = requireValue(errors, env, "SUPABASE_URL");
  const browserSupabaseUrl = requireValue(errors, env, "VITE_SUPABASE_URL");
  if (pilotSupabaseRef && pilotSupabaseRef === demoSupabaseRef) {
    errors.push("MVP and frozen-demo Supabase project IDs must differ.");
  }
  if (
    pilotSupabaseRef &&
    (projectRefFromUrl(serverSupabaseUrl) !== pilotSupabaseRef ||
      projectRefFromUrl(browserSupabaseUrl) !== pilotSupabaseRef)
  ) {
    errors.push("Browser and server Supabase URLs must resolve to the MVP project.");
  }

  const pilotPostHogId = requireValue(errors, env, "UC_MVP_POSTHOG_PROJECT_ID");
  const demoPostHogId = requireValue(errors, env, "UC_DEMO_POSTHOG_PROJECT_ID");
  if (pilotPostHogId && pilotPostHogId === demoPostHogId) {
    errors.push("MVP and frozen-demo PostHog project IDs must differ.");
  }

  const pilotEligibilityTarget = requireValue(
    errors,
    env,
    "UC_MVP_ELIGIBILITY_DEPLOYMENT_ID",
  );
  const demoEligibilityTarget = requireValue(
    errors,
    env,
    "UC_DEMO_ELIGIBILITY_DEPLOYMENT_ID",
  );
  if (pilotEligibilityTarget && pilotEligibilityTarget === demoEligibilityTarget) {
    errors.push("MVP eligibility deployment must differ from the frozen demo target.");
  }

  if (env.VITE_APP_BRAND !== "uc") {
    errors.push("VITE_APP_BRAND must be uc.");
  }
  if (env.VITE_DEMO_MODE !== "false") {
    errors.push("VITE_DEMO_MODE must be false for the MVP.");
  }
  if (
    env.SENTRY_ENVIRONMENT !== "uc-assessment-mvp" ||
    env.VITE_SENTRY_ENVIRONMENT !== "uc-assessment-mvp"
  ) {
    errors.push("Server and browser Sentry environments must be uc-assessment-mvp.");
  }

  const runtimeKeys = [
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "ELIGIBILITY_SERVICE_URL",
    "VITE_POSTHOG_HOST",
    "POSTHOG_HOST",
  ];
  for (const key of runtimeKeys) {
    const value = env[key]?.toLowerCase() ?? "";
    if (
      value.includes(FROZEN_UC_DEMO.alias) ||
      value.includes(FROZEN_UC_DEMO.directUrl) ||
      (demoSupabaseRef && value.includes(demoSupabaseRef.toLowerCase()))
    ) {
      errors.push(`${key} references a frozen-demo target.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`UC MVP isolation check failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    demoAliasProtected: true,
    eligibilityTargetsDifferent: true,
    postHogProjectsDifferent: true,
    supabaseProjectsDifferent: true,
    vercelProjectId: project.projectId,
    vercelProjectName: project.projectName,
  };
}

function run() {
  const projectPath = resolve(process.cwd(), ".vercel/project.json");
  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  const result = verifyUcMvpIsolation({ env: process.env, project });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
