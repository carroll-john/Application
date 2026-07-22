import {
  BriefcaseBusiness,
  CircleAlert,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Info,
  LoaderCircle,
  Pencil,
  SearchCheck,
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
import { useApplication } from "../../context/ApplicationContext";
import { useAuth } from "../../context/AuthContext";
import { AuthModal } from "../auth";
import { UcCourseBrowseCard } from "../course";
import {
  getCvParserErrorMessage,
  parseCvForRecognition,
} from "../../lib/cvParserClient";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import {
  assessUcAdmission,
  getUcExperienceGroupLabel,
  rankUcCourses,
  type CvRecognitionDraft,
  type UcCourseMatch,
} from "../../lib/ucRplAssessment";
import { UcRplExperienceReview } from "./UcRplExperienceReview";

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
            Upload your CV to see which UC courses may match your work experience
            and qualifications.
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
            This is a guide only, not an admission offer or credit decision.
          </p>
        </div>

        <ol className="divide-y divide-[var(--border)] py-6 sm:py-9 lg:grid lg:grid-rows-3 lg:py-10 lg:pl-10">
          {[
            {
              icon: Upload,
              label: "Upload your CV",
              copy: "Add your current CV. You’ll only need to sign in if you start an application.",
            },
            {
              icon: UserRoundCheck,
              label: "Check your experience",
              copy: "Review the roles, dates and qualifications we find, and correct anything that doesn’t look right.",
            },
            {
              icon: GraduationCap,
              label: "Explore course matches",
              copy: "See which courses may match and whether your experience could count towards your study.",
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

function ParsingState() {
  return (
    <section className="content-block border border-[var(--border)] bg-white px-6 py-16 text-center sm:px-10">
      <LoaderCircle
        className="mx-auto h-10 w-10 animate-spin text-[var(--cta-secondary)]"
        aria-hidden="true"
      />
      <h1 className="mt-6 text-3xl font-bold text-slate-950">Reviewing your CV</h1>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
        We’re finding your work experience and qualifications. You’ll be able to
        check what we find before seeing your course matches.
      </p>
      <p className="mt-5 text-sm text-slate-500">This usually takes less than a minute.</p>
    </section>
  );
}

function MatchCard({
  match,
  mediaVariantIndex,
  isStarting,
  onStart,
  onView,
}: {
  isStarting: boolean;
  match: UcCourseMatch;
  mediaVariantIndex: number;
  onStart: () => void;
  onView: () => void;
}) {
  return (
    <UcCourseBrowseCard
      course={match.course}
      mediaVariantIndex={mediaVariantIndex}
      footer={(
        <div className="border-t border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <SearchCheck className="h-4 w-4 text-green-700" aria-hidden="true" />
                Entry guidance
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {match.admissionDetail}
              </p>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText
                  className="h-4 w-4 text-[var(--cta-secondary)]"
                  aria-hidden="true"
                />
                Potential credit
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {match.creditDetail}
              </p>
            </div>
          </div>
          <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {match.rationale}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
      )}
    />
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
  const mediaVariantByCourseCode = new Map(
    matches.map((match, index) => [match.course.code, index]),
  );

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
          Based on the work experience and qualifications you confirmed.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This is a guide only. It is not an admission offer or credit decision.
        </p>

        <div className="mt-7 grid border border-[var(--border)] sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: BriefcaseBusiness,
              label: admission.occupationTitle,
            },
            {
              icon: SearchCheck,
              label: getUcExperienceGroupLabel(admission.skillLevel),
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

      <div className="content-block flex flex-wrap gap-6 border border-[var(--border)] bg-white px-5 pt-4">
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

      {visibleMatches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.course.code}
              isStarting={startingCourseCode === match.course.code}
              match={match}
              mediaVariantIndex={mediaVariantByCourseCode.get(match.course.code) ?? 0}
              onStart={() => onStart(match)}
              onView={() => navigate(`/courses/${match.course.code}`)}
            />
          ))}
        </div>
      ) : (
        <div className="content-block border border-[var(--border)] bg-white p-8 text-center text-sm text-slate-600">
          No courses fall into this group. Try All courses.
        </div>
      )}
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
        <ParsingState />
      ) : null}
      {stage === "review" && draft && selectedFile ? (
        <UcRplExperienceReview
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
          context="apply"
          signUpRedirectPath="/"
          onAuthenticated={() => {
            setShowAuthModal(false);
            if (pendingStartMatch) {
              setAwaitingAuthenticatedStart(true);
            }
          }}
          onClose={() => {
            setShowAuthModal(false);
            setPendingStartMatch(null);
          }}
        />
      ) : null}
    </>
  );
}
