import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { DocumentUploadField } from "../../components/DocumentUploadField";
import { Button } from "../../components/ui/button";
import type { UcCourseMatch } from "../../lib/ucRplAssessment";

export type UcCreditAssessmentStatus =
  | "ready"
  | "upload"
  | "processing"
  | "complete";

interface UcCreditAssessmentPanelProps {
  error: string | null;
  isAuthenticated: boolean;
  onAssess: () => void;
  onClearTranscript: () => void;
  onFileSelect: (file: File) => void;
  onRequestAssessment: () => void;
  shortlist: UcCourseMatch[];
  status: UcCreditAssessmentStatus;
  transcriptFile: File | null;
}

export function UcCreditAssessmentPanel({
  error,
  isAuthenticated,
  onAssess,
  onClearTranscript,
  onFileSelect,
  onRequestAssessment,
  shortlist,
  status,
  transcriptFile,
}: UcCreditAssessmentPanelProps) {
  if (shortlist.length !== 3) return null;

  const isComplete = status === "complete";
  const isProcessing = status === "processing";
  const showUpload = isAuthenticated && status === "upload";

  return (
    <section
      aria-labelledby="uc-credit-assessment-heading"
      className="content-block overflow-hidden border border-slate-200 bg-white shadow-[0_18px_48px_rgba(31,42,58,0.08)]"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(21rem,0.9fr)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--sn-mint-soft)]/60 text-[var(--sn-navy)] sm:h-14 sm:w-14">
              {isComplete ? (
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              ) : (
                <FileSearch className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2
                id="uc-credit-assessment-heading"
                className="text-3xl font-bold tracking-tight text-slate-950"
              >
                {isComplete
                  ? "Your credit assessment is ready"
                  : "Your three-course shortlist is ready"}
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                {isComplete
                  ? "We’ve added indicative, transcript-based credit guidance to each shortlisted course below."
                  : "Upload a transcript to check whether your previous study maps to published credit guidance for each course."}
              </p>
            </div>
          </div>
        </div>

        <div
          className="m-4 flex flex-col justify-center rounded-[24px] bg-[linear-gradient(145deg,#edf9f6_0%,#f7fbfb_100%)] p-6 ring-1 ring-[var(--sn-mint)]/20 sm:m-6 sm:p-8 lg:ml-0 lg:p-8"
          aria-live="polite"
        >
          {!isAuthenticated && status === "ready" ? (
            <div>
              <div className="flex items-start gap-3 rounded-[20px] bg-white/90 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                <LockKeyhole
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
                  aria-hidden="true"
                />
                <p>
                  Sign in with the account prepared for your pilot invitation
                  before uploading your transcript. Your assessment won’t create
                  an application.
                </p>
              </div>
              <Button
                className="mt-6 h-14 w-full justify-between px-6 text-base"
                onClick={onRequestAssessment}
              >
                <span>Sign in for credit assessment</span>
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {isAuthenticated && status === "ready" ? (
            <div>
              <p className="text-base font-medium leading-7 text-slate-800">
                You’re signed in. Continue to upload the transcript you want assessed
                alongside your CV.
              </p>
              <Button
                className="mt-6 h-14 w-full justify-between px-6 text-base"
                onClick={onRequestAssessment}
              >
                <span>Complete credit assessment</span>
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {showUpload ? (
            <div>
              <DocumentUploadField
                attachedDescription="This transcript is ready for assessment and will be added if you start an application."
                attachedStatus="Transcript ready to assess"
                description="Upload the transcript you want assessed against your three shortlisted courses."
                label="Academic transcript"
                missingStatus="Add a transcript to continue"
                missingTone="info"
                onClearDocument={onClearTranscript}
                onClearSelectedFile={onClearTranscript}
                onFileSelect={onFileSelect}
                required
                selectedFile={transcriptFile}
                showStatusIcon
              />

              {error ? (
                <p className="mt-4 text-sm leading-6 text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                className="mt-5"
                disabled={!transcriptFile || isProcessing}
                onClick={onAssess}
              >
                {isProcessing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isProcessing ? "Assessing your credit…" : "Assess my credit"}
              </Button>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                The transcript is processed for this comparison without creating an
                application. If you start an application, it will be securely added to
                your qualification so you do not need to upload it again. The course
                provider will confirm any formal credit after reviewing supporting
                evidence and unit learning outcomes.
              </p>
            </div>
          ) : null}

          {isProcessing ? (
            <div className="py-6 text-center">
              <LoaderCircle
                className="mx-auto h-9 w-9 animate-spin text-[var(--cta-secondary)]"
                aria-hidden="true"
              />
              <p className="mt-4 text-lg font-semibold text-slate-950">
                Assessing your credit
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                We’re comparing the study in your transcript with the published
                guidance for your three shortlisted courses. CV experience cannot
                add credit points.
              </p>
            </div>
          ) : null}

          {isComplete ? (
            <div className="rounded-[20px] border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-900">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Assessment added to your course cards
              </p>
              <p className="mt-2">
                Review the evidence and indicative credit guidance below. Your
                CV can help rank courses, but it cannot add credit points.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <ol className="grid gap-3 border-t border-slate-100 bg-slate-50/80 p-5 text-sm text-slate-700 sm:grid-cols-3 sm:p-6">
        {shortlist.map((match, index) => (
          <li
            key={match.course.code}
            className="flex min-h-20 items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sn-mint-soft)]/60 font-semibold text-[var(--sn-navy)]">
              {index + 1}
            </span>
            <span className="font-medium leading-5 text-slate-800">
              {match.course.title}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
