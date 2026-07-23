import {
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
      className="content-block border border-[var(--border)] bg-white"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-[var(--border)] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[var(--cta-secondary)]">
            {isComplete ? (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            ) : (
              <FileSearch className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <h2
            id="uc-credit-assessment-heading"
            className="mt-5 text-3xl font-bold tracking-tight text-slate-950"
          >
            {isComplete
              ? "Your credit assessment is ready"
              : "Your three-course shortlist is ready"}
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            {isComplete
              ? "We’ve added indicative time and tuition comparisons to each shortlisted course below."
              : "Complete one RPL and credit transfer assessment to compare how your previous study and professional experience could reduce each course."}
          </p>

          <ol className="mt-6 space-y-2 text-sm text-slate-700">
            {shortlist.map((match, index) => (
              <li key={match.course.code} className="flex gap-3">
                <span className="font-semibold text-[var(--cta-secondary)]">
                  {index + 1}.
                </span>
                <span>{match.course.title}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-6 sm:p-8" aria-live="polite">
          {!isAuthenticated && status === "ready" ? (
            <div>
              <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
                <LockKeyhole
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
                  aria-hidden="true"
                />
                <p>
                  Sign in or create an account before uploading your transcript.
                  Your assessment won’t create an application.
                </p>
              </div>
              <Button className="mt-5" onClick={onRequestAssessment}>
                Complete credit assessment
              </Button>
            </div>
          ) : null}

          {isAuthenticated && status === "ready" ? (
            <div>
              <p className="text-base leading-7 text-slate-700">
                You’re signed in. Continue to upload the transcript you want UC to
                consider alongside your CV.
              </p>
              <Button className="mt-5" onClick={onRequestAssessment}>
                Complete credit assessment
              </Button>
            </div>
          ) : null}

          {showUpload ? (
            <div>
              <DocumentUploadField
                attachedDescription="This transcript is ready for this assessment only."
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
                The transcript is processed for this comparison and is not saved to
                an application. UC will confirm any formal credit after reviewing
                supporting evidence and unit learning outcomes.
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
                We’re comparing the study in your transcript and the experience in
                your CV with your three shortlisted courses.
              </p>
            </div>
          ) : null}

          {isComplete ? (
            <div className="border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-900">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Assessment added to your course cards
              </p>
              <p className="mt-2">
                Compare the original and after-credit estimates below. These are
                guides only, not a formal UC RPL or credit transfer decision.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
