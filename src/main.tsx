import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { installDevConsoleBridge } from "./lib/devConsoleBridge";
import { initPostHog, syncReplayRoutePrivacy } from "./lib/posthog";
import { initSentry, isSentryEnabled } from "./lib/sentry";

installDevConsoleBridge();
initPostHog();
syncReplayRoutePrivacy(window.location.pathname);
initSentry();

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing root element");
}

const root = isSentryEnabled
  ? createRoot(container, {
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
      onUncaughtError: Sentry.reactErrorHandler(),
    })
  : createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
