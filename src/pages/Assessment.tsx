import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppBrandFooter } from "../components/AppBrandFooter";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { UcRplCourseMatcher, type UcRplAssessmentStage } from "../features/ucRpl";
import {
  AssessmentStorageError,
  createAssessmentStorageAdapter,
} from "../lib/assessment/storageAdapter";
import type { PilotActivation } from "../lib/assessment/types";
import { getCourseCatalogFor } from "../lib/courseCatalog";
import {
  capturePostHogEvent,
  registerPilotAnalyticsContext,
} from "../lib/posthog";

export default function Assessment() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("invite")?.trim() ?? "";
  const { session } = useAuth();
  const adapter = useMemo(() => createAssessmentStorageAdapter(session), [session]);
  const [activation, setActivation] = useState<PilotActivation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<UcRplAssessmentStage>("intro");
  const courses = useMemo(() => getCourseCatalogFor("uc"), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (!invitationToken) {
      setError("Open the assessment from your UC pilot invitation.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void adapter
      .activateInvitation(invitationToken)
      .then(async (nextActivation) => {
        if (!active) return;
        setActivation(nextActivation);
        try {
          window.sessionStorage.setItem("uc-pilot-cohort", nextActivation.cohort);
        } catch {
          // Cohort storage only controls the optional home-page entry point.
        }
        await registerPilotAnalyticsContext({
          cohort: nextActivation.cohort,
          participantId: nextActivation.participantId,
          partnerId: nextActivation.partnerId,
        });
        capturePostHogEvent("assessment_invitation_activated", {
          cohort: nextActivation.cohort,
          partner_id: nextActivation.partnerId,
        });
        if (nextActivation.resumed) {
          capturePostHogEvent("assessment_resumed", {
            cohort: nextActivation.cohort,
            partner_id: nextActivation.partnerId,
          });
        }
      })
      .catch((activationError) => {
        if (!active) return;
        capturePostHogEvent("assessment_failed", {
          error_code:
            activationError instanceof AssessmentStorageError
              ? activationError.code ?? "ASSESSMENT_ACTIVATION_FAILED"
              : "ASSESSMENT_ACTIVATION_FAILED",
          stage: "activation",
        });
        setError(
          activationError instanceof AssessmentStorageError
            ? activationError.message
            : "The pilot invitation could not be activated.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [adapter, invitationToken, session?.access_token]);

  return (
    <div className="min-h-screen bg-white">
      <AppBrandHeader
        maxWidthClassName="max-w-[1536px]"
        showApplicantProfileLink={false}
        variant="marketing"
      />
      <main
        className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
        data-sensitive
      >
        {loading ? (
          <div className="content-block flex min-h-72 items-center justify-center gap-3 border border-slate-200 bg-white text-sm text-slate-700">
            <LoadingSpinner />
            Checking your pilot invitation…
          </div>
        ) : null}

        {!loading && error ? (
          <section className="content-block border border-red-200 bg-red-50 p-8">
            <h1 className="text-3xl font-bold text-slate-950">
              Assessment unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-red-900" role="alert">
              {error}
            </p>
            <Link
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--cta-primary)] px-5 text-sm font-semibold text-[var(--cta-primary-text)] shadow-[var(--shadow-cta-primary)] transition hover:bg-[var(--cta-primary-hover)]"
              to="/"
            >
              Browse all UC courses
            </Link>
          </section>
        ) : null}

        {!loading && activation?.cohort === "control" ? (
          <section className="content-block border border-slate-200 bg-white p-8 sm:p-10">
            <h1 className="text-4xl font-bold text-slate-950">
              Explore your UC course options
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Your pilot invitation uses the standard course discovery and
              application journey. All 33 online postgraduate courses remain available.
            </p>
            <Link
              className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-[var(--cta-primary)] px-5 text-sm font-semibold text-[var(--cta-primary-text)] shadow-[var(--shadow-cta-primary)] transition hover:bg-[var(--cta-primary-hover)]"
              to="/"
            >
              Browse UC courses
            </Link>
          </section>
        ) : null}

        {!loading && activation?.cohort === "treatment" ? (
          <UcRplCourseMatcher
            assessmentSessionId={activation.sessionId}
            courses={courses}
            invitationToken={invitationToken}
            onStageChange={setStage}
            stage={stage}
          />
        ) : null}
      </main>
      <AppBrandFooter />
    </div>
  );
}
