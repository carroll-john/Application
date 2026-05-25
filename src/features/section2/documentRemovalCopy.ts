export const documentRemovalCopy = {
  cvConfirm:
    "Removing your CV will also clear the employment history drafted from it. Do you want to continue?",
  cvPendingWarning:
    "If you save without a CV, employment history drafted from your previous CV will be cleared.",
  transcriptConfirm:
    "Removing your transcript will clear the qualification details drafted from it. Do you want to continue?",
  transcriptPendingWarning:
    "If you save without a transcript, qualification details drafted from your previous transcript will be cleared.",
} as const;

export function confirmDocumentRemoval(message: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(message);
}
