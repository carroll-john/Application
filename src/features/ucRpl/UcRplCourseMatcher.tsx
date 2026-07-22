import {
  BriefcaseBusiness,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Info,
  LoaderCircle,
  Pencil,
  SearchCheck,
  ShieldCheck,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { NativeSelect } from "../../components/ui/native-select";
import { useApplication } from "../../context/ApplicationContext";
import { useAuth } from "../../context/AuthContext";
import { AuthModal } from "../auth";
import {
  getCvParserErrorMessage,
  parseCvForRecognition,
} from "../../lib/cvParserClient";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import {
  assessUcAdmission,
  rankUcCourses,
  type CvRecognitionDraft,
  type OscaSkillLevel,
  type UcCourseMatch,
} from "../../lib/ucRplAssessment";

type AssessmentStage = "intro" | "parsing" | "review" | "results";
type MatchFilter = "best_match" | "needs_review" | "all";

interface UcRplCourseMatcherProps {
  courses: CourseCatalogEntry[];
}

const FILTER_LABELS: Record<MatchFilter, string> = {
  all: "All courses",
  best_match: "Best matches",
  needs_review: "Needs review",
};

function formatRolePeriod(role: CvRecognitionDraft["experiences"][number]) {
  const start = [role.startMonth, role.startYear].filter(Boolean).join(" ");
  const end = role.currentRole
    ? "Present"
    : [role.endMonth, role.endYear].filter(Boolean).join(" ");
  return [start, end].filter(Boolean).join(" – ") || "Dates not found";
}

function IntroState({
  fileInputRef,
  onChooseFile,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChooseFile: (file: File | null) => void;
}) {
  return (
    <section
      aria-labelledby="uc-rpl-heading"
      className="content-block bg-white"
    >
      <div className="grid lg:grid-cols-[1.35fr_0.9fr]">
        <div className="border-b border-[var(--border)] py-6 sm:py-9 lg:border-b-0 lg:border-r lg:py-12 lg:pr-12">
          <h1
            id="uc-rpl-heading"
            className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl"
          >
            Find courses that recognise your experience
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Upload your CV to see how your work and prior learning may support
            admission and potential credit.
          </p>

          <button
            type="button"
            className="content-block mt-7 flex w-full items-center gap-5 border border-dashed border-slate-400 bg-slate-50 px-5 py-6 text-left transition hover:border-[var(--cta-secondary)] hover:bg-blue-50/40 focus:outline-none focus:ring-4 focus:ring-[var(--cta-secondary)]/15"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onChooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center border border-[var(--border)] bg-white text-[var(--cta-secondary)]">
              <FileText className="h-7 w-7" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold text-slate-950">
                Drag and drop your file here
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                or choose a PDF, DOC, DOCX or TXT file
              </span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only rounded-full"
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(event) => {
              onChooseFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />

          <div className="mt-5">
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload your CV
            </Button>
          </div>

          <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This is an indicative check, not an admission offer or formal credit
            decision.
          </p>
        </div>

        <ol className="divide-y divide-[var(--border)] py-6 sm:py-9 lg:grid lg:grid-rows-3 lg:py-10 lg:pl-10">
          {[
            {
              icon: Upload,
              label: "Upload your CV",
              copy: "Sign in and add your current CV securely.",
            },
            {
              icon: UserRoundCheck,
              label: "Check your experience",
              copy: "Review the roles and dates we find, and correct anything that doesn’t look right.",
            },
            {
              icon: GraduationCap,
              label: "Explore course matches",
              copy: "See where your experience may support entry requirements or potential credit.",
            },
          ].map((step, index) => (
            <li
              key={step.label}
              className="flex gap-5 py-6 first:pt-0 last:pb-0 lg:items-center lg:gap-6 lg:py-8 lg:first:pt-8 lg:last:pb-8"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-[var(--cta-secondary)] lg:h-11 lg:w-11 lg:text-base">
                {index + 1}
              </span>
              <step.icon
                className="mt-1 h-6 w-6 shrink-0 text-[var(--cta-secondary)] lg:mt-0 lg:h-7 lg:w-7"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-xl font-semibold text-slate-950 lg:text-2xl">
                  {step.label}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600 lg:mt-2 lg:text-base lg:leading-7">
                  {step.copy}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ParsingState({ fileName }: { fileName: string }) {
  return (
    <section className="content-block border border-[var(--border)] bg-white px-6 py-16 text-center sm:px-10">
      <LoaderCircle
        className="mx-auto h-10 w-10 animate-spin text-[var(--cta-secondary)]"
        aria-hidden="true"
      />
      <h1 className="mt-6 text-3xl font-bold text-slate-950">
        Reviewing your experience
      </h1>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
        We’re extracting roles, qualifications and evidence from {fileName}, then
        finding an indicative OSCA occupation match for you to confirm.
      </p>
      <p className="mt-5 text-sm text-slate-500">This usually takes under a minute.</p>
    </section>
  );
}

function ReviewState({
  draft,
  fileName,
  onChange,
  onContinue,
  onStartOver,
}: {
  draft: CvRecognitionDraft;
  fileName: string;
  onChange: (draft: CvRecognitionDraft) => void;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const includedCount = draft.experiences.filter(
    (experience) => experience.includeInAssessment,
  ).length;

  return (
    <section aria-labelledby="review-experience-heading" className="space-y-6">
      <div className="content-block border border-[var(--border)] bg-white p-6 sm:p-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--cta-secondary)]">
              {fileName}
            </p>
            <h1
              id="review-experience-heading"
              className="mt-2 text-4xl font-bold tracking-tight text-slate-950"
            >
              Review your experience
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Confirm what we found before we use it. OSCA candidates are based on
              the duties described in your CV, not the job title alone.
            </p>
          </div>
          <Button variant="neutralOutline" onClick={onStartOver}>
            Upload another CV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
        <div className="space-y-5">
          {draft.experiences.map((experience, index) => (
            <article
              key={experience.id}
              className="content-block border border-[var(--border)] bg-white p-6"
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Include ${experience.position} in assessment`}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-[var(--cta-primary)] focus:ring-[var(--cta-primary)]"
                  type="checkbox"
                  checked={experience.includeInAssessment}
                  onChange={(event) => {
                    const experiences = [...draft.experiences];
                    experiences[index] = {
                      ...experience,
                      includeInAssessment: event.target.checked,
                    };
                    onChange({ ...draft, experiences });
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {experience.position || "Role title not found"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {[experience.company, formatRolePeriod(experience)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {experience.oscaConfidence} confidence
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_0.35fr]">
                <div>
                  <Label htmlFor={`osca-title-${experience.id}`}>
                    Indicative OSCA occupation
                  </Label>
                  <Input
                    id={`osca-title-${experience.id}`}
                    value={experience.oscaOccupationTitle}
                    placeholder="Enter the closest OSCA occupation"
                    onChange={(event) => {
                      const experiences = [...draft.experiences];
                      experiences[index] = {
                        ...experience,
                        oscaOccupationTitle: event.target.value,
                      };
                      onChange({ ...draft, experiences });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor={`osca-level-${experience.id}`}>Skill level</Label>
                  <NativeSelect
                    id={`osca-level-${experience.id}`}
                    value={experience.oscaSkillLevel?.toString() ?? ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      const experiences = [...draft.experiences];
                      experiences[index] = {
                        ...experience,
                        oscaSkillLevel:
                          value >= 1 && value <= 5
                            ? (value as OscaSkillLevel)
                            : null,
                      };
                      onChange({ ...draft, experiences });
                    }}
                  >
                    <option value="">Needs review</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level.toString()}>
                        Level {level}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {experience.oscaRationale ? (
                <p className="mt-4 border-l-2 border-blue-200 pl-4 text-sm leading-6 text-slate-600">
                  {experience.oscaRationale}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="content-block border border-[var(--border)] bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-950">Details to pre-fill</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Check the safe contact details we can carry into your application.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="cv-first-name">First name</Label>
                <Input
                  id="cv-first-name"
                  value={draft.profile.firstName}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      profile: { ...draft.profile, firstName: event.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="cv-last-name">Last name</Label>
                <Input
                  id="cv-last-name"
                  value={draft.profile.lastName}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      profile: { ...draft.profile, lastName: event.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="cv-phone">Phone</Label>
                <Input
                  id="cv-phone"
                  type="tel"
                  value={draft.profile.phone}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      profile: { ...draft.profile, phone: event.target.value },
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-slate-600">
              <p>{draft.tertiaryQualifications.length} tertiary qualification(s)</p>
              <p className="mt-1">
                {draft.professionalAccreditations.length} professional accreditation(s)
              </p>
              <p className="mt-1">{includedCount} included role(s)</p>
            </div>
          </div>

          <div className="content-block border border-blue-200 bg-blue-50/60 p-5">
            <p className="flex gap-2 text-sm leading-6 text-slate-700">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
                aria-hidden="true"
              />
              We won’t infer sensitive personal information. Your sign-in email
              remains the authoritative email for the application.
            </p>
          </div>
        </aside>
      </div>

      <div className="content-block flex flex-col gap-4 border border-[var(--border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          You can edit all pre-filled fields before submitting an application.
        </p>
        <Button disabled={includedCount === 0} onClick={onContinue}>
          Find my course matches
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function MatchCard({
  index,
  match,
  isStarting,
  onStart,
  onView,
}: {
  index: number;
  isStarting: boolean;
  match: UcCourseMatch;
  onStart: () => void;
  onView: () => void;
}) {
  return (
    <article className="content-block border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-[var(--cta-secondary)]">
          {index + 1}
        </div>
        <div className="min-w-0">
          <h3 className="text-2xl font-semibold text-slate-950">{match.course.title}</h3>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1 border-b border-[var(--border)] pb-3 sm:grid-cols-[10rem_1fr]">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <SearchCheck className="h-4 w-4 text-green-700" aria-hidden="true" />
                Admission indication
              </span>
              <span className="text-sm leading-6 text-slate-600">
                {match.admissionDetail}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-[var(--cta-secondary)]" aria-hidden="true" />
                Potential credit
              </span>
              <span className="text-sm leading-6 text-slate-600">
                {match.creditDetail}
              </span>
            </div>
          </div>
          <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {match.rationale}
          </p>
        </div>
        <div className="flex min-w-40 flex-col gap-2">
          <Button disabled={isStarting} onClick={onStart}>
            {isStarting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isStarting ? "Starting…" : "Start application"}
          </Button>
          <Button variant="neutralOutline" onClick={onView}>
            View course
          </Button>
        </div>
      </div>
    </article>
  );
}

function ResultsState({
  admission,
  filter,
  matches,
  onEdit,
  onFilter,
  onStart,
  startingCourseCode,
}: {
  admission: ReturnType<typeof assessUcAdmission>;
  filter: MatchFilter;
  matches: UcCourseMatch[];
  onEdit: () => void;
  onFilter: (filter: MatchFilter) => void;
  onStart: (match: UcCourseMatch) => void;
  startingCourseCode: string | null;
}) {
  const navigate = useNavigate();
  const visibleMatches = matches.filter((match) => {
    if (filter === "all") return true;
    return match.category === filter;
  });

  return (
    <section aria-labelledby="course-matches-heading" className="space-y-6">
      <div className="content-block border border-[var(--border)] bg-white p-6 sm:p-9">
        <h1
          id="course-matches-heading"
          className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl"
        >
          Courses matched to your experience
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Based on the work experience and prior learning you confirmed.
        </p>

        <div className="mt-7 grid border border-[var(--border)] sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: BriefcaseBusiness,
              label: admission.occupationTitle,
            },
            {
              icon: SearchCheck,
              label: admission.skillLevel
                ? `OSCA Skill Level ${admission.skillLevel}`
                : "OSCA review needed",
            },
            {
              icon: ClipboardCheck,
              label: `${admission.experienceYears} years relevant experience`,
            },
            {
              icon: GraduationCap,
              label: admission.equivalentGpa
                ? `UC equivalent GPA: ${admission.equivalentGpa.toFixed(1)}`
                : "Faculty review pathway",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex min-h-24 items-center gap-3 border-b border-[var(--border)] p-4 last:border-b-0 sm:border-r lg:border-b-0"
            >
              <item.icon
                className="h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-slate-800">{item.label}</span>
            </div>
          ))}
          <button
            type="button"
            className="flex min-h-20 items-center justify-center gap-2 p-4 text-sm font-semibold text-[var(--cta-secondary)] hover:bg-blue-50"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Review my experience
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_0.4fr]">
        <div className="content-block border border-[var(--border)] bg-white">
          <div className="flex flex-wrap gap-6 border-b border-[var(--border)] px-5 pt-4">
            {(Object.keys(FILTER_LABELS) as MatchFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`border-b-2 px-1 pb-3 text-sm font-semibold transition ${
                  filter === item
                    ? "border-[var(--cta-primary)] text-[var(--cta-primary)]"
                    : "border-transparent text-slate-600 hover:text-slate-950"
                }`}
                onClick={() => onFilter(item)}
              >
                {FILTER_LABELS[item]}
              </button>
            ))}
          </div>
          <div className="space-y-4 bg-slate-50 p-4 sm:p-5">
            {visibleMatches.length > 0 ? (
              visibleMatches.map((match, index) => (
                <MatchCard
                  key={match.course.code}
                  index={index}
                  isStarting={startingCourseCode === match.course.code}
                  match={match}
                  onStart={() => onStart(match)}
                  onView={() => navigate(`/courses/${match.course.code}`)}
                />
              ))
            ) : (
              <div className="bg-white p-8 text-center text-sm text-slate-600">
                No courses fall into this group. Try All courses.
              </div>
            )}
          </div>
        </div>

        <aside className="content-block border border-[var(--border)] bg-white p-6 lg:sticky lg:top-6">
          <h2 className="text-2xl font-semibold text-slate-950">
            How this assessment works
          </h2>
          <ol className="mt-5 divide-y divide-[var(--border)]">
            {[
              {
                title: "OSCA informs the admission indication",
                copy: "Your confirmed occupation skill level and relevant experience are mapped to UC’s prototype admission bands.",
              },
              {
                title: "Course requirements are checked separately",
                copy: "Academic prerequisites, professional requirements and other course conditions still apply.",
              },
              {
                title: "Credit needs evidence and faculty approval",
                copy: "A Course Convener may request documents, tests or demonstrations before recommending an outcome for senior faculty approval.",
              },
            ].map((item, index) => (
              <li key={item.title} className="flex gap-4 py-5 first:pt-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--cta-secondary)] text-xs font-bold text-[var(--cta-secondary)]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.copy}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex gap-2 border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Indicative only. This is not an admission offer or a formal credit decision.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Prototype assumption: OSCA Skill Level 2 experience from 2 to under 3
            years is included in the GPA 4.0 band.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function UcRplCourseMatcher({ courses }: UcRplCourseMatcherProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { beginCourseApplication } = useApplication();
  const { isAuthenticated, userEmail } = useAuth();
  const [stage, setStage] = useState<AssessmentStage>("intro");
  const [draft, setDraft] = useState<CvRecognitionDraft | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingStartMatch, setPendingStartMatch] = useState<UcCourseMatch | null>(null);
  const [awaitingAuthenticatedStart, setAwaitingAuthenticatedStart] = useState(false);
  const [filter, setFilter] = useState<MatchFilter>("best_match");
  const [startingCourseCode, setStartingCourseCode] = useState<string | null>(null);

  const admission = useMemo(
    () => (draft ? assessUcAdmission(draft.experiences) : null),
    [draft],
  );
  const matches = useMemo(
    () => (draft && admission ? rankUcCourses(courses, draft.experiences, admission) : []),
    [admission, courses, draft],
  );

  async function parseSelectedFile(file: File) {
    setError(null);
    setSelectedFile(file);
    setStage("parsing");

    try {
      const parsed = await parseCvForRecognition(file);
      if (parsed.experiences.length === 0) {
        throw new Error("We couldn't find any employment roles in this CV.");
      }
      setDraft(parsed);
      setStage("review");
    } catch (parseError) {
      setError(
        parseError instanceof Error && parseError.message.includes("employment roles")
          ? parseError.message
          : getCvParserErrorMessage(parseError),
      );
      setStage("intro");
    }
  }

  function chooseFile(file: File | null) {
    if (!file) return;
    if (!isAuthenticated) {
      setPendingStartMatch(null);
      setSelectedFile(file);
      setShowAuthModal(true);
      return;
    }
    void parseSelectedFile(file);
  }

  const startApplication = useCallback(async (match: UcCourseMatch) => {
    if (!draft || !selectedFile || startingCourseCode) return;
    if (!isAuthenticated) {
      setPendingStartMatch(match);
      setShowAuthModal(true);
      return;
    }
    setError(null);
    setStartingCourseCode(match.course.code);

    try {
      await beginCourseApplication(
        {
          code: match.course.code,
          intake: match.course.intakeLabel,
          provider: match.course.provider,
          title: match.course.title,
        },
        {
          authenticatedEmail: userEmail,
          cvFile: selectedFile,
          startFresh: true,
          ucCvPrefill: draft,
        },
      );
      navigate("/overview");
    } catch (startError) {
      console.error("Failed to start application from UC recognition assessment", startError);
      setError("We couldn't start your application right now. Please try again.");
      setStartingCourseCode(null);
      window.scrollTo({ behavior: "smooth", top: 0 });
    }
  }, [
    beginCourseApplication,
    draft,
    isAuthenticated,
    navigate,
    selectedFile,
    startingCourseCode,
    userEmail,
  ]);

  useEffect(() => {
    if (!awaitingAuthenticatedStart || !isAuthenticated || !pendingStartMatch) {
      return;
    }

    setAwaitingAuthenticatedStart(false);
    const match = pendingStartMatch;
    setPendingStartMatch(null);
    void startApplication(match);
  }, [
    awaitingAuthenticatedStart,
    isAuthenticated,
    pendingStartMatch,
    startApplication,
  ]);

  return (
    <>
      {error ? (
        <div
          className="mb-5 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {stage === "intro" ? (
        <IntroState
          fileInputRef={fileInputRef}
          onChooseFile={chooseFile}
        />
      ) : null}
      {stage === "parsing" && selectedFile ? (
        <ParsingState fileName={selectedFile.name} />
      ) : null}
      {stage === "review" && draft && selectedFile ? (
        <ReviewState
          draft={draft}
          fileName={selectedFile.name}
          onChange={setDraft}
          onContinue={() => setStage("results")}
          onStartOver={() => {
            setDraft(null);
            setSelectedFile(null);
            setStage("intro");
          }}
        />
      ) : null}
      {stage === "results" && admission ? (
        <ResultsState
          admission={admission}
          filter={filter}
          matches={matches}
          onEdit={() => setStage("review")}
          onFilter={setFilter}
          onStart={(match) => void startApplication(match)}
          startingCourseCode={startingCourseCode}
        />
      ) : null}

      {showAuthModal ? (
        <AuthModal
          context="eligibility"
          signUpRedirectPath="/"
          onAuthenticated={() => {
            setShowAuthModal(false);
            if (pendingStartMatch) {
              setAwaitingAuthenticatedStart(true);
            } else if (selectedFile) {
              void parseSelectedFile(selectedFile);
            }
          }}
          onClose={() => {
            setShowAuthModal(false);
            if (pendingStartMatch) {
              setPendingStartMatch(null);
            } else {
              setSelectedFile(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
