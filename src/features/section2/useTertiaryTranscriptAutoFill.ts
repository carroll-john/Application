import { useCallback, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { ApplicationData, TertiaryQualification } from "../../lib/applicationData";
import {
  getTertiaryTranscriptParserErrorCode,
  trackTertiaryTranscriptParserDraftEmpty,
  trackTertiaryTranscriptParserDraftFailed,
  trackTertiaryTranscriptParserDraftSucceeded,
} from "../../lib/posthog";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import {
  getDraftedFieldCountFromParseResult,
  parseTranscriptForQualification,
  shouldReplaceQualificationFromTranscript,
  tertiaryTranscriptParseCopy,
} from "./tertiaryTranscriptParsePolicy";

export function getTranscriptFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

interface UseTertiaryTranscriptAutoFillOptions {
  applicationData: ApplicationData;
  formData: TertiaryQualification;
  setFormData: (record: TertiaryQualification) => void;
}

export function useTertiaryTranscriptAutoFill({
  applicationData,
  formData,
  setFormData,
}: UseTertiaryTranscriptAutoFillOptions) {
  const { session } = useAuth();
  const [isParsingTranscript, setIsParsingTranscript] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    detail: string;
    title: string;
  } | null>(null);
  const [parseStatusMessage, setParseStatusMessage] =
    useState<Section2RecordStatusMessage | null>(null);
  const lastParsedFileKeyRef = useRef<string | null>(null);
  const parseRequestIdRef = useRef(0);

  const clearParseStatusMessage = useCallback(() => {
    setParseStatusMessage(null);
  }, []);

  const handleSelectTranscriptFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        lastParsedFileKeyRef.current = null;
        setParseProgress(null);
        setParseStatusMessage(null);
        return;
      }

      const fileKey = getTranscriptFileKey(file);
      if (lastParsedFileKeyRef.current === fileKey) {
        return;
      }

      const parseContext = {
        applicationData,
        formData,
        selectedTranscriptFile: file,
      };
      const isReplacement = shouldReplaceQualificationFromTranscript(parseContext);

      const requestId = parseRequestIdRef.current + 1;
      parseRequestIdRef.current = requestId;
      setIsParsingTranscript(true);
      setParseStatusMessage(null);
      setFormData({
        ...formData,
        transcriptEligibility: undefined,
      });
      setParseProgress({
        detail: "This can take a little longer for larger files.",
        title: tertiaryTranscriptParseCopy.parsingTitle,
      });

      const parseStartedAt = Date.now();

      try {
        const parseResult = await parseTranscriptForQualification(
          file,
          parseContext,
          session?.access_token ?? "",
        );

        if (parseRequestIdRef.current !== requestId) {
          return;
        }

        lastParsedFileKeyRef.current = fileKey;
        setFormData({
          ...parseResult.mergedRecord,
          transcriptEligibility: parseResult.assessment,
        });

        const draftedFieldCount = getDraftedFieldCountFromParseResult(
          parseResult,
          formData,
        );
        const parseDurationMs = Date.now() - parseStartedAt;

        if (draftedFieldCount > 0 || isReplacement) {
          trackTertiaryTranscriptParserDraftSucceeded({
            draftedFieldCount,
            eligibilityOutcome: parseResult.assessment.outcome,
            parseDurationMs,
          });
          setParseStatusMessage({
            message: isReplacement
              ? tertiaryTranscriptParseCopy.draftUpdated
              : tertiaryTranscriptParseCopy.draftSuccess,
            type: "success",
          });
        } else {
          trackTertiaryTranscriptParserDraftEmpty({ parseDurationMs });
          setParseStatusMessage({
            message: tertiaryTranscriptParseCopy.draftEmpty,
            type: "warning",
          });
        }
      } catch (error) {
        if (parseRequestIdRef.current !== requestId) {
          return;
        }

        trackTertiaryTranscriptParserDraftFailed({
          errorCode: getTertiaryTranscriptParserErrorCode(error),
          parseDurationMs: Date.now() - parseStartedAt,
        });
        setParseStatusMessage({
          message:
            "We couldn't read this transcript right now. You can still enter the details manually and save.",
          type: "warning",
        });
      } finally {
        if (parseRequestIdRef.current === requestId) {
          setIsParsingTranscript(false);
          setParseProgress(null);
        }
      }
    },
    [applicationData, formData, session?.access_token, setFormData],
  );

  const markTranscriptParsed = useCallback((file: File | null) => {
    lastParsedFileKeyRef.current = file ? getTranscriptFileKey(file) : null;
  }, []);

  const hasParsedTranscriptFile = useCallback((file: File | null) => {
    if (!file) {
      return false;
    }

    return lastParsedFileKeyRef.current === getTranscriptFileKey(file);
  }, []);

  return {
    clearParseStatusMessage,
    handleSelectTranscriptFile,
    hasParsedTranscriptFile,
    isParsingTranscript,
    markTranscriptParsed,
    parseProgress,
    parseStatusMessage,
  };
}
