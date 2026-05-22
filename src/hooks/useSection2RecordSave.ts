import { useCallback, useState } from "react";
import { getDocumentUploadErrorMessage } from "../lib/documentStorage";
import { useSection2Navigation } from "./useSection2Navigation";

export type Section2RecordStatusMessage = {
  message: string;
  type: "success" | "warning" | "error" | "status";
};

interface CreateSection2RecordSaveHandlerOptions {
  beforeContinue?: () => boolean;
  errorFallbackMessage?: string;
  returnToQualifications: () => void;
  saveRecord: () => void | Promise<void>;
  setStatusMessage: (message: Section2RecordStatusMessage | null) => void;
}

export async function createSection2RecordSaveHandler({
  beforeContinue,
  errorFallbackMessage = "We couldn't save this record right now. Please try again.",
  returnToQualifications,
  saveRecord,
  setStatusMessage,
}: CreateSection2RecordSaveHandlerOptions) {
  setStatusMessage(null);

  if (beforeContinue && !beforeContinue()) {
    return;
  }

  try {
    await saveRecord();
    returnToQualifications();
  } catch (error) {
    setStatusMessage({
      message:
        getDocumentUploadErrorMessage(error) ?? errorFallbackMessage,
      type: "error",
    });
  }
}

interface UseSection2RecordSaveOptions {
  beforeContinue?: () => boolean;
  errorFallbackMessage?: string;
  saveRecord: () => void | Promise<void>;
}

export function useSection2RecordSave({
  saveRecord,
  beforeContinue,
  errorFallbackMessage,
}: UseSection2RecordSaveOptions) {
  const { returnToQualifications } = useSection2Navigation();
  const [statusMessage, setStatusMessage] =
    useState<Section2RecordStatusMessage | null>(null);

  const clearStatusMessage = useCallback(() => {
    setStatusMessage(null);
  }, []);

  const handleSaveAndReturn = useCallback(async () => {
    await createSection2RecordSaveHandler({
      beforeContinue,
      errorFallbackMessage,
      returnToQualifications,
      saveRecord,
      setStatusMessage,
    });
  }, [
    beforeContinue,
    errorFallbackMessage,
    returnToQualifications,
    saveRecord,
  ]);

  return {
    statusMessage,
    clearStatusMessage,
    handleSaveAndReturn,
  };
}
