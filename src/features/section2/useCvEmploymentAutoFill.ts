import { useCallback, useRef, useState } from "react";
import type { EmploymentExperience } from "../../lib/applicationData";
import {
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
} from "../../lib/posthog";
import { employmentExperiencesDiffer } from "../../lib/documentParsers/cv";
import {
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} from "../../lib/cvParserClient";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import { getTranscriptFileKey } from "./useTertiaryTranscriptAutoFill";
import { cvEmploymentParseCopy } from "./cvDocumentParsePolicy";

function getCvFileKey(file: File) {
  return getTranscriptFileKey(file);
}

interface UseCvEmploymentAutoFillOptions {
  employmentExperiences: EmploymentExperience[];
  replaceEmploymentExperiences: (
    experiences: EmploymentExperience[],
  ) => Promise<void>;
}

export function useCvEmploymentAutoFill({
  employmentExperiences,
  replaceEmploymentExperiences,
}: UseCvEmploymentAutoFillOptions) {
  const [isParsingCv, setIsParsingCv] = useState(false);
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

  const handleSelectCvFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        lastParsedFileKeyRef.current = null;
        setParseProgress(null);
        setParseStatusMessage(null);
        return;
      }

      const fileKey = getCvFileKey(file);
      if (lastParsedFileKeyRef.current === fileKey) {
        return;
      }

      const isReplacement = employmentExperiences.length > 0;
      const requestId = parseRequestIdRef.current + 1;
      parseRequestIdRef.current = requestId;
      setIsParsingCv(true);
      setParseStatusMessage(null);
      setParseProgress({
        detail: "This can take a little longer for larger files.",
        title: "Reading your CV and drafting employment history...",
      });

      const parseStartedAt = Date.now();
      const previousExperiences = employmentExperiences;

      try {
        const draft = await parseEmploymentExperiencesFromCv(file);

        if (parseRequestIdRef.current !== requestId) {
          return;
        }

        lastParsedFileKeyRef.current = fileKey;
        await replaceEmploymentExperiences(draft.experiences);

        const parseDurationMs = Date.now() - parseStartedAt;
        const experiencesChanged = employmentExperiencesDiffer(
          previousExperiences,
          draft.experiences,
        );

        if (draft.experiences.length > 0) {
          trackCvParserDraftSucceeded({
            draftedRolesCount: draft.experiences.length,
            parseDurationMs,
          });
          setParseStatusMessage({
            message:
              isReplacement && experiencesChanged
                ? cvEmploymentParseCopy.draftUpdated
                : cvEmploymentParseCopy.draftSuccess,
            type: "success",
          });
        } else {
          trackCvParserDraftEmpty({ parseDurationMs });
          setParseStatusMessage({
            message: cvEmploymentParseCopy.draftEmpty,
            type: "warning",
          });
        }
      } catch (error) {
        if (parseRequestIdRef.current !== requestId) {
          return;
        }

        trackCvParserDraftFailed({
          errorCode: getCvParserErrorCode(error),
          parseDurationMs: Date.now() - parseStartedAt,
        });
        setParseStatusMessage({
          message: getCvParserErrorMessage(error),
          type: "warning",
        });
      } finally {
        if (parseRequestIdRef.current === requestId) {
          setIsParsingCv(false);
          setParseProgress(null);
        }
      }
    },
    [employmentExperiences, replaceEmploymentExperiences],
  );

  const hasParsedCvFile = useCallback((file: File | null) => {
    if (!file) {
      return false;
    }

    return lastParsedFileKeyRef.current === getCvFileKey(file);
  }, []);

  return {
    clearParseStatusMessage,
    handleSelectCvFile,
    hasParsedCvFile,
    isParsingCv,
    parseProgress,
    parseStatusMessage,
  };
}
