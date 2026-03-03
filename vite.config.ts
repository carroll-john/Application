import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN?.trim();
  const sentryOrg = env.SENTRY_ORG?.trim();
  const sentryProject = env.SENTRY_PROJECT?.trim();
  const sentryRelease =
    env.SENTRY_RELEASE?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim();
  const enableSentryUpload = Boolean(
    sentryAuthToken && sentryOrg && sentryProject && sentryRelease,
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(enableSentryUpload
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: sentryOrg,
              project: sentryProject,
              release: {
                name: sentryRelease,
              },
              sourcemaps: {
                assets: "./dist/**",
                filesToDeleteAfterUpload: "dist/**/*.map",
              },
              telemetry: false,
            }),
          ]
        : []),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
    build: {
      sourcemap: enableSentryUpload,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            sentry: ["@sentry/react"],
            supabase: ["@supabase/supabase-js"],
            datepicker: ["react-datepicker", "date-fns"],
          },
        },
      },
    },
  };
});
