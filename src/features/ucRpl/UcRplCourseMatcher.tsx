import {
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  CircleAlert,
  ClipboardCheck,
  Clock3,
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
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import { AccentIconBadge } from "../../components/AccentIconBadge";
import { Button } from "../../components/ui/button";
import { StatusPill } from "../../components/StatusPill";
import { useApplication } from "../../context/ApplicationContext";
import { useAuth } from "../../context/AuthContext";
import { AuthModal } from "../auth";
import { StudyNextCourseBrowseCard } from "../course";
import {
  getCvParserErrorMessage,
  parseCvForRecognition,
} from "../../lib/cvParserClient";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import type { UcCreditAssessmentResult } from "../../lib/ucCreditAssessment";
import { capturePostHogEvent } from "../../lib/posthog";
import {
  AssessmentStorageError,
  createAssessmentStorageAdapter,
} from "../../lib/assessment/storageAdapter";
import {
  assessUcAdmission,
  formatUcExperienceDuration,
  getUcCourseMatchExperienceSummary,
  getUcExperienceGroupLabel,
  getUcExperienceReviewGuidance,
  getUcWorkEntryGuidance,
  rankUcCourses,
  summarizeUcExperienceByOscaLevel,
  type CvRecognitionDraft,
  type OscaSkillLevel,
  type UcCourseMatch,
  type UcOscaExperienceSummary,
} from "../../lib/ucRplAssessment";
import { UcRplExperienceReview } from "./UcRplExperienceReview";
import { UcCreditAssessmentComparison } from "./UcCreditAssessmentComparison";
import {
  UcCreditAssessmentPanel,
  type UcCreditAssessmentStatus,
} from "./UcCreditAssessmentPanel";
import type { UcRplAssessmentStage } from "./ucRplAssessmentStage";

type MatchFilter = "best_match" | "needs_review" | "all";

interface UcRplCourseMatcherProps {
  assessmentSessionId: string | null;
  courses: CourseCatalogEntry[];
  invitationToken: string;
  onStageChange: (stage: UcRplAssessmentStage) => void;
  stage: UcRplAssessmentStage;
}
const CONFIDENCE_BADGE: Record<
  UcCourseMatch["entryConfidence"],
  { label: string; tone: "neutral" | "success" | "warning" }
> = {
  high: { label: "High confidence", tone: "success" },
  medium: { label: "Medium confidence", tone: "warning" },
  low: { label: "Low confidence", tone: "neutral" },
};

function ConfidenceBadge({
  confidence,
}: {
  confidence: UcCourseMatch["entryConfidence"];
}) {
  const badge = CONFIDENCE_BADGE[confidence];

  return (
    <StatusPill className="px-2.5 py-1 text-xs" tone={badge.tone}>
      {badge.label}
    </StatusPill>
  );
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
            Upload your CV to see which courses may match your work experience
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
            aria-label="Upload your CV"
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
          <p className="mt-3 text-xs leading-5 text-slate-500">
            When you upload, we use one secure AI-assisted CV extraction so you
            can review the drafted fields. Before sign-in, the file and extracted
            content are not stored by the assessment service. You choose what to
            confirm before anything enters a resumable session.
          </p>
        </div>

        <ol className="divide-y divide-[var(--border)] py-6 sm:py-9 lg:grid lg:grid-rows-3 lg:py-10 lg:pl-10">
          {[
            {
              icon: Upload,
              label: "Upload your CV",
              copy: "Add your current CV. You can explore matches without signing in; sign-in is required before a credit assessment or application.",
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

export function UcCourseMatchSummaryRail({
  experienceMonths,
  includedRoleCount,
  onEdit,
  skillLevel,
}: {
  experienceMonths: number;
  includedRoleCount: number;
  onEdit: () => void;
  skillLevel: OscaSkillLevel | null;
}) {
  const roleCountLabel = `${includedRoleCount} ${
    includedRoleCount === 1 ? "role" : "roles"
  } from CV`;
  const items = [
    {
      emphasis: undefined,
      icon: ClipboardCheck,
      label: roleCountLabel,
    },
    {
      emphasis: undefined,
      icon: Clock3,
      label: formatUcExperienceDuration(experienceMonths),
    },
    {
      emphasis: undefined,
      icon: Briefcase,
      label: getUcExperienceGroupLabel(skillLevel),
    },
    {
      emphasis: "info",
      icon: GraduationCap,
      label: getUcWorkEntryGuidance(skillLevel, experienceMonths),
    },
  ] as const;

  return (
    <div
      aria-label="Experience summary"
      className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_1.35fr_auto]"
    >
      {items.map((item) => {
        const isProminent = item.emphasis === "info";

        return (
          <div
            key={item.label}
            className={`flex min-h-20 items-center gap-3 rounded-[20px] px-4 py-4 ${
              isProminent
                ? "border border-[var(--sn-mint)]/40 bg-[var(--sn-mint-soft)]/45 shadow-[var(--shadow-xs)]"
                : "border border-slate-200 bg-slate-50"
            }`}
          >
            {isProminent ? (
              <AccentIconBadge className="shrink-0" tone="mint">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </AccentIconBadge>
            ) : (
              <item.icon
                className="h-5 w-5 shrink-0 text-[var(--sn-mint)]"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-sm font-semibold ${
                isProminent ? "text-[var(--sn-navy)]" : "text-slate-800"
              }`}
            >
              {item.label}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        className="flex min-h-12 items-center justify-center gap-2 self-stretch rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[var(--sn-navy)] transition hover:border-[var(--sn-mint)] hover:bg-[var(--sn-mint)]/10 sm:col-span-2 xl:col-span-1"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit
      </button>
    </div>
  );
}

export function ShortlistProgressHighlight({
  shortlistedCount,
}: {
  shortlistedCount: number;
}) {
  return (
    <div className="content-block relative flex flex-wrap items-center justify-between gap-4 overflow-hidden border border-[var(--sn-yellow)]/45 bg-white p-5 pl-7 shadow-sm sm:p-6 sm:pl-8">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-2 bg-[var(--sn-yellow)]"
      />
      <div className="flex items-center gap-4">
        <AccentIconBadge className="shrink-0" tone="yellow">
          <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
        </AccentIconBadge>
        <div>
          <p className="font-semibold text-[var(--sn-navy)]">
            {shortlistedCount} of 3 courses shortlisted
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Choose three courses to compare potential credit, study time and tuition.
          </p>
        </div>
      </div>
      <div className="flex gap-2.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full border transition-colors ${
              index < shortlistedCount
                ? "border-[var(--sn-yellow)] bg-[var(--sn-yellow)] ring-4 ring-[var(--sn-yellow)]/20"
                : "border-slate-300 bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function UcRplMatchCard({
  assessmentResult,
  isAssessmentComplete,
  isShortlistFull,
  isShortlisted,
  match,
  isStarting,
  onStart,
  onToggleShortlist,
  onView,
  variantIndex = 0,
}: {
  assessmentResult?: UcCreditAssessmentResult;
  isAssessmentComplete: boolean;
  isShortlistFull: boolean;
  isShortlisted: boolean;
  isStarting: boolean;
  match: UcCourseMatch;
  onStart: () => void;
  onToggleShortlist: () => void;
  onView: () => void;
  variantIndex?: number;
}) {
  const shortlistDisabled =
    isAssessmentComplete || (isShortlistFull && !isShortlisted);

  return (
    <StudyNextCourseBrowseCard
      appearance="match"
      course={match.course}
      onViewCourse={onView}
      showSummary={false}
      showMedia
      variantIndex={(variantIndex % 2) + 2}
      footer={(
        <div className="flex flex-1 flex-col border-t border-slate-100 bg-white">
          <div className="flex-1 p-5 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              <div className="rounded-[20px] bg-[var(--success-bg)]/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <SearchCheck className="h-4 w-4 text-green-700" aria-hidden="true" />
                    Entry guidance
                  </p>
                  <ConfidenceBadge confidence={match.entryConfidence} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {match.admissionDetail}
                </p>
              </div>
              {!assessmentResult ? (
                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileText
                        className="h-4 w-4 text-[var(--cta-secondary)]"
                        aria-hidden="true"
                      />
                      Credit potential
                    </p>
                    <ConfidenceBadge confidence={match.creditConfidence} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {match.creditDetail}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {assessmentResult ? (
            <UcCreditAssessmentComparison result={assessmentResult} />
          ) : null}

          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 sm:px-6 sm:pb-6">
            <Button
              aria-pressed={!assessmentResult ? isShortlisted : undefined}
              disabled={assessmentResult ? isStarting : shortlistDisabled}
              variant={!assessmentResult && isShortlisted ? "soft" : "default"}
              onClick={assessmentResult ? onStart : onToggleShortlist}
            >
              {assessmentResult && isStarting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {!assessmentResult && isShortlisted ? (
                <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
              ) : null}
              {!assessmentResult && !isShortlisted ? (
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
              ) : null}
              {assessmentResult
                ? isStarting
                  ? "Starting…"
                  : "Start application"
                : isShortlisted
                  ? "Shortlisted"
                  : isShortlistFull
                    ? "Shortlist full"
                    : "Shortlist"}
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
  assessmentPanel,
  assessmentResults,
  assessmentStatus,
  experienceSummary,
  experienceGuidance,
  filter,
  includedRoleCount,
  matches,
  onEdit,
  onFilter,
  onStart,
  onToggleShortlist,
  shortlistedCourseCodes,
  startingCourseCode,
}: {
  admission: ReturnType<typeof assessUcAdmission>;
  assessmentPanel: ReactNode;
  assessmentResults: Map<string, UcCreditAssessmentResult>;
  assessmentStatus: UcCreditAssessmentStatus;
  experienceSummary: UcOscaExperienceSummary | null;
  experienceGuidance: string;
  filter: MatchFilter;
  includedRoleCount: number;
  matches: UcCourseMatch[];
  onEdit: () => void;
  onFilter: (filter: MatchFilter) => void;
  onStart: (match: UcCourseMatch) => void;
  onToggleShortlist: (match: UcCourseMatch) => void;
  shortlistedCourseCodes: string[];
  startingCourseCode: string | null;
}) {
  const navigate = useNavigate();
  const visibleMatches = matches.filter((match) => {
    if (filter === "all") return true;
    return match.category === filter;
  });
  const displayedSkillLevel = experienceSummary?.skillLevel ?? admission.skillLevel;
  const displayedExperienceMonths =
    experienceSummary?.experienceMonths ?? admission.experienceMonths;
  const isShortlistFull = shortlistedCourseCodes.length === 3;

  return (
    <section aria-labelledby="course-matches-heading" className="space-y-6">
      <div className="content-block relative overflow-hidden border border-slate-200 bg-white p-6 shadow-[0_18px_48px_rgba(31,42,58,0.08)] sm:p-9">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5 bg-[var(--sn-mint)]"
        />
        <h1
          id="course-matches-heading"
          className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl"
        >
          Courses matched to your experience
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Based on the experience and qualifications you reviewed.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This is a guide only. It is not an admission offer or credit decision.
        </p>

        <UcCourseMatchSummaryRail
          experienceMonths={displayedExperienceMonths}
          includedRoleCount={includedRoleCount}
          skillLevel={displayedSkillLevel}
          onEdit={onEdit}
        />

        <div className="mt-5 flex gap-3 rounded-[20px] border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm leading-6 text-[var(--info-text)] sm:p-5">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
            aria-hidden="true"
          />
          <p>{experienceGuidance}</p>
        </div>
      </div>

      <ShortlistProgressHighlight
        shortlistedCount={shortlistedCourseCodes.length}
      />

      {assessmentPanel}

      <div className="content-block flex flex-wrap gap-2 border border-slate-200 bg-white p-2 shadow-sm">
        {(Object.keys(FILTER_LABELS) as MatchFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
              filter === item
                ? "bg-[var(--sn-navy)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
            onClick={() => onFilter(item)}
          >
            {FILTER_LABELS[item]}
          </button>
        ))}
      </div>

      {visibleMatches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleMatches.map((match, index) => (
            <UcRplMatchCard
              key={match.course.code}
              assessmentResult={assessmentResults.get(match.course.code)}
              isAssessmentComplete={assessmentStatus === "complete"}
              isShortlistFull={isShortlistFull}
              isShortlisted={shortlistedCourseCodes.includes(match.course.code)}
              isStarting={startingCourseCode === match.course.code}
              match={match}
              onStart={() => onStart(match)}
              onToggleShortlist={() => onToggleShortlist(match)}
              onView={() => navigate(`/courses/${match.course.code}`)}
              variantIndex={index}
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

export function UcRplCourseMatcher({
  assessmentSessionId,
  courses,
  invitationToken,
  onStageChange,
  stage,
}: UcRplCourseMatcherProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { beginCourseApplication } = useApplication();
  const { isAuthenticated, session, userEmail } = useAuth();
  const assessmentStorageAdapter = useMemo(
    () => createAssessmentStorageAdapter(session),
    [session],
  );
  const [draft, setDraft] = useState<CvRecognitionDraft | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIntent, setAuthIntent] = useState<"application" | "credit" | null>(null);
  const [pendingStartMatch, setPendingStartMatch] = useState<UcCourseMatch | null>(null);
  const [awaitingAuthenticatedStart, setAwaitingAuthenticatedStart] = useState(false);
  const [filter, setFilter] = useState<MatchFilter>("best_match");
  const [startingCourseCode, setStartingCourseCode] = useState<string | null>(null);
  const [shortlistedCourseCodes, setShortlistedCourseCodes] = useState<string[]>([]);
  const [assessmentStatus, setAssessmentStatus] =
    useState<UcCreditAssessmentStatus>("ready");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentResults, setAssessmentResults] = useState(
    new Map<string, UcCreditAssessmentResult>(),
  );

  const admission = useMemo(
    () => (draft ? assessUcAdmission(draft.experiences) : null),
    [draft],
  );
  const matches = useMemo(
    () => (draft && admission ? rankUcCourses(courses, draft, admission) : []),
    [admission, courses, draft],
  );
  const shortlist = useMemo(
    () =>
      shortlistedCourseCodes
        .map((courseCode) =>
          matches.find((match) => match.course.code === courseCode),
        )
        .filter((match): match is UcCourseMatch => Boolean(match)),
    [matches, shortlistedCourseCodes],
  );
  const experienceSummaries = useMemo(
    () => (draft ? summarizeUcExperienceByOscaLevel(draft.experiences) : []),
    [draft],
  );
  const experienceSummary = useMemo(
    () =>
      admission
        ? getUcCourseMatchExperienceSummary(
            experienceSummaries,
            admission.skillLevel,
          )
        : null,
    [admission, experienceSummaries],
  );
  const experienceGuidance = useMemo(
    () => getUcExperienceReviewGuidance(experienceSummaries),
    [experienceSummaries],
  );
  const includedRoleCount = useMemo(
    () =>
      draft?.experiences.filter((experience) => experience.includeInAssessment)
        .length ?? 0,
    [draft],
  );

  async function parseSelectedFile(file: File) {
    setError(null);
    setAssessmentError(null);
    setAssessmentResults(new Map());
    setAssessmentStatus("ready");
    setShortlistedCourseCodes([]);
    setTranscriptFile(null);
    setSelectedFile(file);
    onStageChange("parsing");

    try {
      const parsed = await parseCvForRecognition(file, {
        pilotInvitationToken: invitationToken,
      });
      if (parsed.experiences.length === 0) {
        throw new Error("We couldn't find any employment roles in this CV.");
      }
      setDraft(parsed);
      onStageChange("review");
    } catch (parseError) {
      capturePostHogEvent("assessment_failed", {
        error_code:
          parseError instanceof AssessmentStorageError
            ? parseError.code ?? "ASSESSMENT_CV_PARSE_FAILED"
            : "ASSESSMENT_CV_PARSE_FAILED",
        stage: "cv_parse",
      });
      setError(
        parseError instanceof Error && parseError.message.includes("employment roles")
          ? parseError.message
          : getCvParserErrorMessage(parseError),
      );
      onStageChange("intro");
    }
  }

  function chooseFile(file: File | null) {
    if (!file) return;
    void parseSelectedFile(file);
  }

  function toggleShortlist(match: UcCourseMatch) {
    if (assessmentStatus === "complete") return;
    const isSelected = shortlistedCourseCodes.includes(match.course.code);
    const next = isSelected
      ? shortlistedCourseCodes.filter(
          (courseCode) => courseCode !== match.course.code,
        )
      : shortlistedCourseCodes.length < 3
        ? [...shortlistedCourseCodes, match.course.code]
        : shortlistedCourseCodes;

    if (next === shortlistedCourseCodes) return;

    setShortlistedCourseCodes(next);
    setAssessmentStatus("ready");
    setAssessmentError(null);
    setAssessmentResults(new Map());
    setTranscriptFile(null);

    if (next.length === 3 && shortlistedCourseCodes.length !== 3) {
      capturePostHogEvent("assessment_shortlist_completed", {
        course_count: next.length,
        governed_course_count: next.filter((courseCode) =>
          matches.some(
            (match) =>
              match.course.code === courseCode && match.creditPoints !== null,
          ),
        ).length,
      });
      window.requestAnimationFrame(() => {
        document
          .getElementById("uc-credit-assessment-heading")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  function requestCreditAssessment() {
    if (shortlist.length !== 3) return;

    if (!isAuthenticated) {
      setAuthIntent("credit");
      setShowAuthModal(true);
      return;
    }
    if (!assessmentSessionId) {
      setAssessmentError(
        "Your pilot session is still being prepared. Wait a moment and try again.",
      );
      return;
    }

    setAssessmentError(null);
    setAssessmentStatus("upload");
  }

  async function runCreditAssessment() {
    if (
      !draft ||
      shortlist.length !== 3 ||
      !transcriptFile ||
      assessmentStatus === "processing"
    ) {
      return;
    }

    if (!isAuthenticated || !session?.access_token) {
      setAuthIntent("credit");
      setShowAuthModal(true);
      return;
    }

    setAssessmentError(null);
    setAssessmentStatus("processing");

    try {
      if (!assessmentSessionId || !selectedFile) {
        throw new AssessmentStorageError(
          "Your pilot session is not ready. Refresh the invitation and try again.",
          409,
        );
      }
      await Promise.all([
        assessmentStorageAdapter.saveSession(assessmentSessionId, {
          confirmedCv: draft,
          shortlistCourseCodes: shortlist.map((match) => match.course.code),
          status: "transcript",
        }),
        assessmentStorageAdapter.uploadDocument(
          assessmentSessionId,
          "cv",
          selectedFile,
        ),
      ]);
      const evaluated = await assessmentStorageAdapter.evaluateTranscript(
        assessmentSessionId,
        transcriptFile,
      );
      const results: UcCreditAssessmentResult[] = evaluated.results.map((result) => ({
        ...result,
        evidenceSummary:
          result.potentialCreditPoints === null
            ? result.manualReviewReasons[0] ?? "UC review is required."
            : `Based only on ${result.matchedTranscriptEvidence.length} mapped transcript units. UC must confirm any formal credit.`,
      }));
      setAssessmentResults(
        new Map(results.map((result) => [result.courseCode, result])),
      );
      setAssessmentStatus("complete");
      capturePostHogEvent("assessment_evaluation_completed", {
        manual_review_count: results.filter(
          (result) =>
            result.potentialCreditPoints === null || result.confidence === "low",
        ).length,
        numeric_guidance_count: results.filter(
          (result) => result.potentialCreditPoints !== null,
        ).length,
        result_count: results.length,
      });
      window.requestAnimationFrame(() => {
        document
          .getElementById(`course-card-title-${shortlist[0]?.course.code}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (assessmentFailure) {
      console.error("Failed to complete UC credit assessment", assessmentFailure);
      capturePostHogEvent("assessment_failed", {
        error_code:
          assessmentFailure instanceof AssessmentStorageError
            ? assessmentFailure.code ?? "ASSESSMENT_EVALUATION_FAILED"
            : "ASSESSMENT_EVALUATION_FAILED",
        stage: "evaluation",
      });
      if (
        assessmentFailure instanceof AssessmentStorageError &&
        assessmentFailure.status === 401
      ) {
        setAssessmentError("Your session expired. Sign in again to continue.");
        setAuthIntent("credit");
        setShowAuthModal(true);
      } else {
        setAssessmentError(
          assessmentFailure instanceof Error
            ? assessmentFailure.message
            : "We couldn’t complete the credit assessment right now. Please try again.",
        );
      }
      setAssessmentStatus("upload");
    }
  }

  const startApplication = useCallback(async (match: UcCourseMatch) => {
    if (!draft || !assessmentSessionId || startingCourseCode) return;
    if (!isAuthenticated) {
      setPendingStartMatch(match);
      setAuthIntent("application");
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
          assessmentSessionId,
          startFresh: true,
        },
      );
      capturePostHogEvent("assessment_application_started", {
        governed_course: match.creditPoints !== null,
      });
      navigate("/overview");
    } catch (startError) {
      console.error("Failed to start application from UC recognition assessment", startError);
      capturePostHogEvent("assessment_failed", {
        error_code:
          startError instanceof AssessmentStorageError
            ? startError.code ?? "ASSESSMENT_APPLICATION_START_FAILED"
            : "ASSESSMENT_APPLICATION_START_FAILED",
        stage: "application_start",
      });
      if (
        startError instanceof AssessmentStorageError &&
        startError.status === 401
      ) {
        setError("Your session expired. Sign in again to continue.");
        setPendingStartMatch(match);
        setAuthIntent("application");
        setShowAuthModal(true);
      } else if (startError instanceof TypeError) {
        setError(
          "We couldn't finish preparing your transcript. Check your connection and try Start application again.",
        );
      } else {
        setError("We couldn't start your application right now. Please try again.");
      }
      setStartingCourseCode(null);
      window.scrollTo({ behavior: "smooth", top: 0 });
    }
  }, [
    beginCourseApplication,
    assessmentSessionId,
    draft,
    isAuthenticated,
    navigate,
    startingCourseCode,
    userEmail,
  ]);

  useEffect(() => {
    if (
      !awaitingAuthenticatedStart ||
      !isAuthenticated ||
      !assessmentSessionId ||
      !pendingStartMatch
    ) {
      return;
    }

    setAwaitingAuthenticatedStart(false);
    const match = pendingStartMatch;
    setPendingStartMatch(null);
    void startApplication(match);
  }, [
    awaitingAuthenticatedStart,
    assessmentSessionId,
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
          onContinue={() => {
            capturePostHogEvent("assessment_cv_reviewed", {
              included_role_count: includedRoleCount,
              qualification_count:
                draft.tertiaryQualifications.length +
                draft.secondaryQualifications.length,
            });
            onStageChange("results");
          }}
          onStartOver={() => {
            setDraft(null);
            setSelectedFile(null);
            setShortlistedCourseCodes([]);
            setAssessmentResults(new Map());
            setAssessmentStatus("ready");
            setTranscriptFile(null);
            onStageChange("intro");
          }}
        />
      ) : null}
      {stage === "results" && admission ? (
        <ResultsState
          admission={admission}
          assessmentPanel={(
            <UcCreditAssessmentPanel
              error={assessmentError}
              isAuthenticated={isAuthenticated}
              shortlist={shortlist}
              status={assessmentStatus}
              transcriptFile={transcriptFile}
              onAssess={() => void runCreditAssessment()}
              onClearTranscript={() => {
                setAssessmentError(null);
                setTranscriptFile(null);
              }}
              onFileSelect={(file) => {
                setAssessmentError(null);
                setTranscriptFile(file);
              }}
              onRequestAssessment={requestCreditAssessment}
            />
          )}
          assessmentResults={assessmentResults}
          assessmentStatus={assessmentStatus}
          experienceSummary={experienceSummary}
          experienceGuidance={experienceGuidance}
          filter={filter}
          includedRoleCount={includedRoleCount}
          matches={matches}
          onEdit={() => onStageChange("review")}
          onFilter={setFilter}
          onStart={(match) => void startApplication(match)}
          onToggleShortlist={toggleShortlist}
          shortlistedCourseCodes={shortlistedCourseCodes}
          startingCourseCode={startingCourseCode}
        />
      ) : null}

      {showAuthModal ? (
        <AuthModal
          allowSignUp={false}
          context={authIntent === "credit" ? "eligibility" : "apply"}
          onAuthenticated={() => {
            setShowAuthModal(false);
            if (authIntent === "credit") {
              setAssessmentStatus("upload");
            } else if (pendingStartMatch) {
              setAwaitingAuthenticatedStart(true);
            }
            setAuthIntent(null);
          }}
          onClose={() => {
            setShowAuthModal(false);
            if (authIntent === "application") {
              setPendingStartMatch(null);
            }
            setAuthIntent(null);
          }}
        />
      ) : null}
    </>
  );
}
