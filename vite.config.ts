import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { viteDevConsolePlugin } from "./scripts/viteDevConsolePlugin";

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
      viteDevConsolePlugin(),
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
      include: ["src/**/*.test.ts", "api/**/*.test.ts"],
    },
    server: {
      proxy: {
        "/api/suggest": {
          target: "http://127.0.0.1:4193",
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: enableSentryUpload,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (["react", "react-dom", "react-router-dom"].some((m) => id.includes(`/node_modules/${m}/`))) return "react";
            if (id.includes("/node_modules/@sentry/react/")) return "sentry";
            if (id.includes("/node_modules/@supabase/supabase-js/")) return "supabase";
            if (["react-datepicker", "date-fns"].some((m) => id.includes(`/node_modules/${m}/`))) return "datepicker";
          },
        },
      },
    },
  };
});
