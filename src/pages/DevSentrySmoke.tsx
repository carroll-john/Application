import * as Sentry from "@sentry/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { captureSentryException, isSentryEnabled } from "../lib/sentry";

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function DevSentrySmoke() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleTrace() {
    setStatus("Sending Sentry trace...");

    await Sentry.startSpan(
      {
        name: "Dev Sentry Smoke Trace",
        op: "ui.click",
      },
      async (span) => {
        span?.setAttribute("smoke_test", true);
        span?.setAttribute("route", "/dev/sentry-smoke");
        await wait(350);
      },
    );

    setStatus("Trace sent. Check Sentry performance for Dev Sentry Smoke Trace.");
  }

  function handleHandledError() {
    const error = new Error("Sentry smoke test: handled exception");

    captureSentryException(error, {
      extras: {
        smokeTest: true,
        route: "/dev/sentry-smoke",
      },
      tags: {
        flow: "dev_sentry_smoke",
        smoke_test: "true",
      },
    });

    setStatus("Handled exception sent. Check Sentry issues for the smoke-test error.");
  }

  function handleUnhandledError() {
    setStatus("Throwing uncaught error...");

    window.setTimeout(() => {
      throw new Error("Sentry smoke test: uncaught exception");
    }, 0);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader showApplicantProfileLink={false}>
        <Link
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#084E74] transition-colors hover:border-[#084E74]/60 hover:bg-[#F2F8FB]"
          to="/"
        >
          Back to app
        </Link>
      </AppBrandHeader>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#084E74]">
            Development only
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Sentry smoke test
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Use this page to generate one intentional Sentry exception and one
            intentional traced interaction without touching preview or production.
          </p>
        </div>

        <SurfaceCard className="p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Current status</p>
              <p className="mt-2">
                Sentry runtime is{" "}
                <span className="font-semibold">
                  {isSentryEnabled ? "enabled" : "disabled"}
                </span>
                .
              </p>
              <p className="mt-1">
                {status ??
                  "No smoke test has been triggered in this browser session yet."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleHandledError} type="button">
                Send handled exception
              </Button>
              <Button onClick={handleTrace} type="button" variant="soft">
                Send trace
              </Button>
              <Button
                onClick={handleUnhandledError}
                type="button"
                variant="outline"
              >
                Throw uncaught error
              </Button>
            </div>

            <div className="rounded-3xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm leading-6 text-[var(--info-text)]">
              <p className="font-semibold">Expected results</p>
              <p className="mt-2">
                The handled and uncaught error buttons should create issue events.
                The trace button should create a performance span named{" "}
                <span className="font-semibold">Dev Sentry Smoke Trace</span>.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
