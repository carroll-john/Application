import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".claude/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      // Build artifacts (gitignored): linting them flags directives copied
      // from their TypeScript sources, which is noise.
      ".api-runtime-check/**",
      ".tmp/**",
      "eligibility-service/node_modules/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "api/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // All event capture goes through the typed wrappers in src/lib/analytics
      // (re-exported from src/lib/posthog). Importing posthog-js directly
      // bypasses the event catalog, bot filtering and URL sanitization.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "posthog-js",
              message:
                "Import from src/lib/posthog instead — direct posthog-js usage bypasses the typed event catalog and privacy guards.",
            },
            {
              name: "posthog-js/react",
              message:
                "Import from src/lib/posthog instead — direct posthog-js usage bypasses the typed event catalog and privacy guards.",
            },
          ],
        },
      ],
    },
  },
  {
    // The analytics layer itself (and its tests), plus the Sentry↔PostHog
    // link, are the only places allowed to touch the SDK directly.
    files: ["src/lib/analytics/**", "src/lib/posthog.test.ts", "src/lib/sentry.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
