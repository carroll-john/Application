import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AccentIconBadge } from "../components/AccentIconBadge";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { ModalShell } from "../components/ModalShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import { getCourseByCode, getDefaultCourse } from "../lib/courseCatalog";
import {
  evaluateCourseEligibility,
  type EligibilityAnswers,
} from "../lib/courseEligibility";
import {
  capturePostHogEvent,
  getCourseAnalyticsProperties,
} from "../lib/posthog";

type EligibilityOutcome = "success" | "fail" | null;

export default function CourseDetails() {
  const navigate = useNavigate();
  const { courseCode } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthorizedCompanyUser, isBypassedInDev } = useAuth();
  const { beginCourseApplication, isHydrating } = useApplication();
  const course = useMemo(
    () => getCourseByCode(courseCode) ?? getDefaultCourse(),
    [courseCode],
  );
  const [showEligibility, setShowEligibility] = useState(false);
  const [eligibilityOutcome, setEligibilityOutcome] =
    useState<EligibilityOutcome>(null);
  const [eligibilityReason, setEligibilityReason] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [eligibilityForm, setEligibilityForm] = useState<EligibilityAnswers>({
    educationLevel: "",
    experienceRange: "",
    goal: "",
  });
  const courseDetailsSectionRef = useRef<HTMLElement | null>(null);
  const entryRequirementsRef = useRef<HTMLDivElement | null>(null);
  const [isStartingApplication, setIsStartingApplication] = useState(false);
  const autoApplyStartedRef = useRef(false);
  const isAuthenticated = Boolean(isBypassedInDev || isAuthorizedCompanyUser);
  const shouldAutoApply =
    searchParams.get("apply") === "1" && searchParams.get("eligible") === "1";
  const isApplyActionPending = isHydrating || isStartingApplication;

  function resetEligibilityState() {
    setApplyError(null);
    setEligibilityOutcome(null);
    setEligibilityReason("");
    setShowEligibility(false);
  }

  useEffect(() => {
    if (!shouldAutoApply || !isAuthenticated || isHydrating || autoApplyStartedRef.current) {
      return;
    }

    autoApplyStartedRef.current = true;

    void beginCourseApplication({
      code: course.code,
      intake: course.intakeLabel,
      provider: course.provider,
      title: course.title,
    })
      .then(() => {
        navigate("/overview", { replace: true });
      })
      .catch(() => {
        autoApplyStartedRef.current = false;
        setEligibilityOutcome("success");
        setEligibilityReason(
          `You meet the entry criteria for ${course.title}.`,
        );
        setApplyError(
          "We couldn't start your application right now. Try again.",
        );
      });
  }, [
    beginCourseApplication,
    course.code,
    course.intakeLabel,
    course.provider,
    course.title,
    isAuthenticated,
    isHydrating,
    navigate,
    shouldAutoApply,
  ]);

  const isEligibilityFormComplete =
    Boolean(eligibilityForm.goal) &&
    Boolean(eligibilityForm.educationLevel) &&
    Boolean(eligibilityForm.experienceRange);

  async function handleEligibleApplyNow() {
    if (isApplyActionPending) {
      return;
    }

    setApplyError(null);

    if (isAuthenticated) {
      capturePostHogEvent("application_start_requested", {
        ...getCourseAnalyticsProperties(course),
        auth_state: "authenticated",
      });
      setIsStartingApplication(true);

      try {
        await beginCourseApplication({
          code: course.code,
          intake: course.intakeLabel,
          provider: course.provider,
          title: course.title,
        });
        resetEligibilityState();
        navigate("/overview");
      } catch {
        setApplyError(
          "We couldn't start your application right now. Try again.",
        );
      } finally {
        setIsStartingApplication(false);
      }

      return;
    }

    capturePostHogEvent("application_sign_in_redirected", {
      ...getCourseAnalyticsProperties(course),
      auth_state: "anonymous",
      redirect_reason: "eligible_apply",
    });
    resetEligibilityState();
    navigate(
      `/sign-in?redirect=${encodeURIComponent(
        `/courses/${course.code}?eligible=1&apply=1`,
      )}`,
    );
  }

  function handleReviewRequirements() {
    resetEligibilityState();

    window.requestAnimationFrame(() => {
      const target = entryRequirementsRef.current ?? courseDetailsSectionRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBrandHeader>
        <div className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 sm:block">
          {course.provider}
        </div>
      </AppBrandHeader>

      <section className="bg-[linear-gradient(135deg,#084E74_0%,#0b678f_55%,#0e7ca9_100%)] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide text-white/90">
                {course.delivery}
              </span>
              {course.categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide text-white/90"
                >
                  {category}
                </span>
              ))}
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              {course.title}
            </h1>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Provider
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{course.provider}</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Duration
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {course.duration || "Flexible study"}
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Intake
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {course.intakeLabel}
                </p>
              </div>
            </div>
          </div>

          <SurfaceCard className="rounded-[36px] border-0 bg-[#E4EFEE] p-6 text-slate-900 shadow-[0_32px_60px_rgba(8,78,116,0.25)] sm:p-8">
            <AccentIconBadge className="mb-6" size="lg" tone="brandSoft">
              <svg
                aria-hidden="true"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M7 8h10M7 12h6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </AccentIconBadge>
            <h2 className="text-2xl font-bold text-[#084E74]">
              Accelerated application process
            </h2>
            <Checklist
              items={[
                "Start with a course-specific eligibility check",
                "Create or reuse your profile after sign in",
                "Save and resume applications across courses",
              ]}
            />
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">At a glance</p>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Study level
                  </dt>
                  <dd className="mt-1 font-medium">{course.studyLevel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Course type
                  </dt>
                  <dd className="mt-1 font-medium">{course.courseType}</dd>
                </div>
                {course.feeSummary ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Fees
                    </dt>
                    <dd className="mt-1 font-medium">{course.feeSummary}</dd>
                  </div>
                ) : null}
                {course.supportSummary ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Support
                    </dt>
                    <dd className="mt-1 text-slate-600">{course.supportSummary}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <Button
              className="mt-8 w-full"
              onClick={() => {
                capturePostHogEvent("eligibility_check_opened", {
                  ...getCourseAnalyticsProperties(course),
                });
                setShowEligibility(true);
              }}
            >
              Eligibility Check
            </Button>
          </SurfaceCard>
        </div>
      </section>

      <section
        ref={courseDetailsSectionRef}
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
      >
        <div>
          <h2 className="text-3xl font-bold text-[#084E74]">Course details</h2>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">
                Course overview
              </h3>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {course.description || course.summary}
              </p>
            </SurfaceCard>

            {course.entryRequirements ? (
              <div ref={entryRequirementsRef}>
                <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
                  <h3 className="text-2xl font-bold text-slate-950">
                    Entry requirements
                  </h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    {course.entryRequirements}
                  </p>
                </SurfaceCard>
              </div>
            ) : null}

            {course.recognitionOfPriorLearning ? (
              <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
                <h3 className="text-2xl font-bold text-slate-950">
                  Recognition of prior learning
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  {course.recognitionOfPriorLearning}
                </p>
              </SurfaceCard>
            ) : null}
          </div>

          <div className="space-y-6">
            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">
                Core subjects
              </h3>
              {course.coreSubjects.length ? (
                <ul className="mt-4 space-y-3">
                  {course.coreSubjects.map((subject) => (
                    <li key={subject} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Subject list available on request.
                </p>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">
                Course facts
              </h3>
              <dl className="mt-4 space-y-4 text-sm text-slate-700">
                {course.subjectArea ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Subject area
                    </dt>
                    <dd className="mt-1 font-medium">{course.subjectArea}</dd>
                  </div>
                ) : null}
                {course.duration ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Duration
                    </dt>
                    <dd className="mt-1 font-medium">{course.duration}</dd>
                  </div>
                ) : null}
                {course.feeSummary ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Fees
                    </dt>
                    <dd className="mt-1 font-medium">{course.feeSummary}</dd>
                  </div>
                ) : null}
                {course.supportOptions.length ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Support options
                    </dt>
                    <dd className="mt-1 space-y-2">
                      {course.supportOptions.map((option) => (
                        <p key={option} className="leading-6">
                          {option}
                        </p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {course.feeNotes.length ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Good to know
                    </dt>
                    <dd className="mt-1 space-y-2">
                      {course.feeNotes.map((note) => (
                        <p key={note} className="leading-6">
                          {note}
                        </p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {course.outcomes ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Outcomes
                    </dt>
                    <dd className="mt-1 leading-6">{course.outcomes}</dd>
                  </div>
                ) : null}
              </dl>
            </SurfaceCard>
          </div>
        </div>
      </section>

      {showEligibility && !eligibilityOutcome ? (
        <ModalShell
          onClose={() => {
            setApplyError(null);
            setShowEligibility(false);
          }}
          title="Eligibility Check"
        >
          <p className="mb-6 text-sm leading-6 text-slate-600">
            Answer a few questions so we can check this course&apos;s entry
            criteria before you start an application.
          </p>
          <div className="space-y-4">
            <SelectField
              label="Select: Description of goals"
              value={eligibilityForm.goal ?? ""}
              onChange={(value) =>
                setEligibilityForm((previous) => ({ ...previous, goal: value }))
              }
              options={course.eligibility.goalsOptions}
            />
            <SelectField
              label="Select: Education level"
              value={eligibilityForm.educationLevel ?? ""}
              onChange={(value) =>
                setEligibilityForm((previous) => ({
                  ...previous,
                  educationLevel: value,
                }))
              }
              options={course.eligibility.educationOptions}
            />
            <SelectField
              label="Select: Experience"
              value={eligibilityForm.experienceRange ?? ""}
              onChange={(value) =>
                setEligibilityForm((previous) => ({
                  ...previous,
                  experienceRange: value,
                }))
              }
              options={course.eligibility.experienceOptions}
            />
          </div>
          <Button
            className="mt-6 w-full"
            disabled={!isEligibilityFormComplete}
            onClick={() => {
              setApplyError(null);
              const result = evaluateCourseEligibility(course.eligibility, eligibilityForm);
              capturePostHogEvent("eligibility_check_completed", {
                ...getCourseAnalyticsProperties(course),
                education_level: eligibilityForm.educationLevel,
                eligible: result.eligible,
                experience_range: eligibilityForm.experienceRange,
                goal: eligibilityForm.goal,
              });
              setEligibilityOutcome(result.eligible ? "success" : "fail");
              setEligibilityReason(result.reason ?? "");
            }}
          >
            Next
          </Button>
        </ModalShell>
      ) : null}

      {eligibilityOutcome ? (
        <ModalShell
          maxWidthClassName="max-w-xl"
          onClose={resetEligibilityState}
          title={
            eligibilityOutcome === "success"
              ? "Eligible to apply"
              : "Not eligible yet"
          }
        >
          <p
            className={`mb-4 text-lg font-semibold ${
              eligibilityOutcome === "success"
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {eligibilityOutcome === "success"
              ? "You meet the entry criteria"
              : "You do not meet the entry criteria yet"}
          </p>
          <p className="text-sm leading-6 text-slate-600">
            {eligibilityReason}
          </p>
          {applyError ? (
            <p className="mt-4 text-sm font-medium text-[var(--error-text)]">
              {applyError}
            </p>
          ) : null}
          {eligibilityOutcome === "success" ? (
            <Button
              className="mt-6 w-full"
              disabled={isApplyActionPending}
              onClick={() => {
                void handleEligibleApplyNow();
              }}
            >
              {isAuthenticated
                ? isApplyActionPending
                  ? "Preparing application..."
                  : "Start application"
                : "Sign in to apply"}
            </Button>
          ) : (
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={handleReviewRequirements}>
                Review entry requirements
              </Button>
              <Button
                className="w-full"
                variant="soft"
                onClick={() => {
                  setApplyError(null);
                  setEligibilityReason("");
                  setEligibilityOutcome(null);
                }}
              >
                Try again
              </Button>
              <Button
                className="w-full"
                variant="neutralOutline"
                onClick={() => {
                  resetEligibilityState();
                  navigate("/");
                }}
              >
                Browse courses
              </Button>
            </div>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#084E74]" />
          <span className="text-sm leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
