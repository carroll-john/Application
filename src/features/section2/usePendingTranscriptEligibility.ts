import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ApplicationData, TertiaryQualification } from "../../lib/applicationData";
import { loadStoredDocumentFile } from "../../lib/documentStorage";
import { mapExtractedDataToQualification, mergeQualificationFromTranscriptParse } from "../../lib/eligibility/mapToTertiaryQualification";
import {
  getTertiaryTranscriptParserErrorCode,
  trackTertiaryTranscriptParserDraftEmpty,
  trackTertiaryTranscriptParserDraftFailed,
  trackTertiaryTranscriptParserDraftSucceeded,
} from "../../lib/analytics/tertiaryTranscriptParserAnalytics";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import {
  buildTertiaryTranscriptFlashMessage,
  getDraftedFieldCountFromParseResult,
  parseTranscriptForQualification,
  shouldUseCachedTranscriptAssessment,
  tertiaryTranscriptParseCopy,
} from "./tertiaryTranscriptParsePolicy";
import {
  readSection2NavigationState,
  type PendingTranscriptEligibilityJob,
} from "./section2NavigationState";

const CACHED_ASSESSMENT_MIN_PROGRESS_MS = 400;

interface UsePendingTranscriptEligibilityOptions {
  applicationData: ApplicationData;
  hasParsedTranscriptFile?: (file: File) => boolean;
  setStatusMessage: (message: Section2RecordStatusMessage | null) => void;
  updateTertiaryQualification: (
    id: string,
    qualification: TertiaryQualification,
  ) => Promise<void>;
}

export function usePendingTranscriptEligibility({
  applicationData,
  hasParsedTranscriptFile,
  setStatusMessage,
  updateTertiaryQualification,
}: UsePendingTranscriptEligibilityOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [eligibilityProgress, setEligibilityProgress] = useState<{
    detail: string;
    title: string;
  } | null>(null);
  const [isProcessingEligibility, setIsProcessingEligibility] = useState(false);
  const activeJobRef = useRef<string | null>(null);

  const clearNavigationState = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, navigate]);

  const runPendingJob = useCallback(
    async (job: PendingTranscriptEligibilityJob) => {
      const qualification =
        applicationData.tertiaryQualifications.find(
          (record) => record.id === job.qualificationId,
        ) ?? job.savedQualification;

      if (!qualification) {
        setStatusMessage({
          message:
            "We saved your qualification, but couldn't find it to review program evidence. Try editing the qualification again.",
          type: "warning",
        });
        return;
      }

      setIsProcessingEligibility(true);
      setEligibilityProgress({
        detail: tertiaryTranscriptParseCopy.eligibilityDetail,
        title: tertiaryTranscriptParseCopy.eligibilityTitle,
      });

      const parseStartedAt = Date.now();
      let parseError: unknown;
      let parseResult: Awaited<ReturnType<typeof parseTranscriptForQualification>> | undefined;
      let workingRecord = qualification;

      try {
        const useCachedAssessment = shouldUseCachedTranscriptAssessment({
          cachedAssessment: job.cachedAssessment,
          hasParsedTranscriptFile,
          transcriptFile: job.transcriptFile,
        });

        if (useCachedAssessment && job.cachedAssessment) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, CACHED_ASSESSMENT_MIN_PROGRESS_MS),
          );
          const fieldDraft = mapExtractedDataToQualification(
            job.cachedAssessment.extractedData,
          );
          workingRecord = {
            ...mergeQualificationFromTranscriptParse(qualification, fieldDraft),
            transcriptEligibility: job.cachedAssessment,
          };
        } else {
          const transcriptFile =
            job.transcriptFile ??
            (qualification.transcriptDocument
              ? await loadStoredDocumentFile(qualification.transcriptDocument)
              : null);

          if (!transcriptFile) {
            throw new Error("Unable to load the saved transcript for evidence review.");
          }

          try {
            parseResult = await parseTranscriptForQualification(transcriptFile, {
              applicationData,
              formData: qualification,
              selectedTranscriptFile: transcriptFile,
            });
          } catch (error) {
            parseError = error;
            trackTertiaryTranscriptParserDraftFailed({
              errorCode: getTertiaryTranscriptParserErrorCode(error),
              parseDurationMs: Date.now() - parseStartedAt,
            });
          }

          if (parseResult) {
            workingRecord = {
              ...parseResult.mergedRecord,
              transcriptDocument: qualification.transcriptDocument,
              transcriptDocumentName: qualification.transcriptDocumentName,
              certificateDocument: qualification.certificateDocument,
              certificateDocumentName: qualification.certificateDocumentName,
              transcriptEligibility: parseResult.assessment,
            };

            const parseDurationMs = Date.now() - parseStartedAt;
            const draftedFieldCount = getDraftedFieldCountFromParseResult(
              parseResult,
              qualification,
            );

            if (draftedFieldCount > 0) {
              trackTertiaryTranscriptParserDraftSucceeded({
                draftedFieldCount,
                eligibilityOutcome: parseResult.assessment.outcome,
                parseDurationMs,
              });
            } else if (parseResult.shouldAutoFill) {
              trackTertiaryTranscriptParserDraftEmpty({ parseDurationMs });
            }
          }
        }

        await updateTertiaryQualification(job.qualificationId, workingRecord);

        const flashMessage = buildTertiaryTranscriptFlashMessage({
          assessment: workingRecord.transcriptEligibility,
          draftedFieldCount: parseResult
            ? getDraftedFieldCountFromParseResult(parseResult, qualification)
            : 0,
          parseError,
          preservedExistingFields: Boolean(
            parseResult &&
              !parseResult.shouldAutoFill &&
              job.transcriptFile,
          ),
          validationFailed: false,
        });

        if (flashMessage) {
          setStatusMessage(flashMessage);
        }
      } catch (error) {
        setStatusMessage({
          message:
            error instanceof Error
              ? error.message
              : "We couldn't complete the transcript evidence review right now.",
          type: "warning",
        });
      } finally {
        setIsProcessingEligibility(false);
        setEligibilityProgress(null);
      }
    },
    [
      applicationData,
      hasParsedTranscriptFile,
      setStatusMessage,
      updateTertiaryQualification,
    ],
  );

  useEffect(() => {
    const navigationState = readSection2NavigationState(location.state);
    const pendingJob = navigationState?.pendingTranscriptEligibility;

    if (navigationState?.section2StatusMessage && !pendingJob) {
      setStatusMessage(navigationState.section2StatusMessage);
    }

    if (!pendingJob) {
      return;
    }

    if (activeJobRef.current === pendingJob.qualificationId) {
      return;
    }

    activeJobRef.current = pendingJob.qualificationId;
    clearNavigationState();
    void runPendingJob(pendingJob);
  }, [
    clearNavigationState,
    location.state,
    runPendingJob,
    setStatusMessage,
  ]);

  return {
    eligibilityProgress,
    isProcessingEligibility,
  };
}
