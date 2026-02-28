import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccentIconBadge } from "../components/AccentIconBadge";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { ModalShell } from "../components/ModalShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  APPLICATION_COURSE,
  createSelectedCourseSeed,
} from "../lib/applicationProgress";
import { isEligibleForMbaCourse } from "../lib/courseEligibility";

type EligibilityOutcome = "success" | "fail" | null;

const acceleratedBenefits = [
  "Find out immediately if you are eligible to apply",
  "Upload documents for applications processed in under 48 hours",
  "Keep your progress as you move through the form",
  "Fast-track repeat applications from the dashboard",
] as const;

const mbaBenefits = [
  {
    icon: "💻",
    title: "Learn on your own terms",
    body:
      "Balance work, life and study through a fully online, modular application journey.",
  },
  {
    icon: "🎓",
    title: "Build on existing credentials",
    body:
      "Reuse prior education and experience to move into the next stage quickly.",
  },
  {
    icon: "🎯",
    title: "Translate experience into momentum",
    body:
      "The guided flow keeps complex admissions steps understandable and manageable.",
  },
] as const;

const eligibilityBenefits = [
  "Apply on StudyNext",
  "Liaise with a dedicated support person",
  "Fast turnaround time on applications",
  "Accelerate subsequent applications",
] as const;

export default function CourseDetails() {
  const navigate = useNavigate();
  const { isAuthorizedCompanyUser, session } = useAuth();
  const { selectCourse } = useApplication();
  const [showEligibility, setShowEligibility] = useState(false);
  const [eligibilityOutcome, setEligibilityOutcome] =
    useState<EligibilityOutcome>(null);
  const [eligibilityForm, setEligibilityForm] = useState({
    goals: "",
    education: "",
    experience: "",
  });

  const isEligibilityFormComplete =
    Boolean(eligibilityForm.goals) &&
    Boolean(eligibilityForm.education) &&
    Boolean(eligibilityForm.experience);

  const applicantProfilePath = `/applicant-profile?redirect=${encodeURIComponent(
    "/overview",
  )}&course=${encodeURIComponent(APPLICATION_COURSE.code)}`;

  function handleEligibleApplyNow() {
    selectCourse(
      createSelectedCourseSeed({
        code: APPLICATION_COURSE.code,
        title: APPLICATION_COURSE.title,
        intake: APPLICATION_COURSE.intake,
      }),
    );

    if (session && isAuthorizedCompanyUser) {
      navigate(applicantProfilePath);
      return;
    }

    navigate(`/sign-in?redirect=${encodeURIComponent(applicantProfilePath)}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <AppBrandHeader>
        <div className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 sm:block">
          {APPLICATION_COURSE.provider}
        </div>
      </AppBrandHeader>

      <section className="bg-[linear-gradient(135deg,#084E74_0%,#0b678f_55%,#0e7ca9_100%)] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide text-white/90">
              100% Online
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              {APPLICATION_COURSE.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-100 sm:text-xl">
              Become a leader of tomorrow through a flexible application
              experience designed to move quickly.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                "Accelerated application review",
                "Structured guided workflow",
                "Save and resume anytime",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur"
                >
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
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
              NEW! Accelerated application process
            </h2>
            <Checklist items={acceleratedBenefits} />
            <Button
              className="mt-8 w-full"
              onClick={() => setShowEligibility(true)}
            >
              Eligibility Check
            </Button>
          </SurfaceCard>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h2 className="text-3xl font-bold text-[#084E74]">
          The SCU MBA online benefits
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {mbaBenefits.map((card) => (
            <SurfaceCard
              key={card.title}
              className="rounded-[32px] bg-slate-50 p-6 text-center shadow-none"
            >
              <div className="text-4xl">{card.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.body}
              </p>
            </SurfaceCard>
          ))}
        </div>
      </section>

      {showEligibility && !eligibilityOutcome ? (
        <ModalShell
          onClose={() => setShowEligibility(false)}
          title="Eligibility Check"
        >
          <p className="mb-6 text-sm leading-6 text-slate-600">
            Tell us a little about your goals so we can gauge whether you are
            ready to proceed.
          </p>
          <div className="space-y-4">
            <SelectField
              label="Select: Description of goals"
              value={eligibilityForm.goals}
              onChange={(value) =>
                setEligibilityForm((previous) => ({ ...previous, goals: value }))
              }
              options={["Career advancement", "Expand knowledge", "Build network"]}
            />
            <SelectField
              label="Select: Education level"
              value={eligibilityForm.education}
              onChange={(value) =>
                setEligibilityForm((previous) => ({
                  ...previous,
                  education: value,
                }))
              }
              options={[
                "High school",
                "Diploma",
                "Bachelor degree",
                "Masters degree",
                "Doctorate",
              ]}
            />
            <SelectField
              label="Select: Experience"
              value={eligibilityForm.experience}
              onChange={(value) =>
                setEligibilityForm((previous) => ({
                  ...previous,
                  experience: value,
                }))
              }
              options={["Less than 2 years", "2-5 years", "5+ years"]}
            />
          </div>
          <Button
            className="mt-6 w-full"
            disabled={!isEligibilityFormComplete}
            onClick={() => {
              setEligibilityOutcome(
                isEligibleForMbaCourse({
                  education: eligibilityForm.education,
                  experience: eligibilityForm.experience,
                })
                  ? "success"
                  : "fail",
              );
            }}
          >
            Next
          </Button>
        </ModalShell>
      ) : null}

      {eligibilityOutcome ? (
        <ModalShell
          onClose={() => {
            setEligibilityOutcome(null);
            setShowEligibility(false);
          }}
          title={eligibilityOutcome === "success" ? "Success!" : "Sorry"}
        >
          <p
            className={`mb-4 text-lg font-semibold ${
              eligibilityOutcome === "success"
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {eligibilityOutcome === "success"
              ? "You are eligible to apply"
              : "You are currently ineligible for this course"}
          </p>
          {eligibilityOutcome === "success" ? (
            <Checklist items={eligibilityBenefits} />
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              This course currently expects either a bachelor degree or at least
              two years of experience.
            </p>
          )}
          <Button
            className="mt-6 w-full"
            onClick={() => {
              if (eligibilityOutcome === "success") {
                setEligibilityOutcome(null);
                setShowEligibility(false);
                handleEligibleApplyNow();
              } else {
                setEligibilityOutcome(null);
                setShowEligibility(false);
              }
            }}
          >
            {eligibilityOutcome === "success" ? "Apply Now" : "Close"}
          </Button>
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
  options: string[];
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
