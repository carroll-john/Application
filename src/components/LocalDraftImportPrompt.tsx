import { Button } from "./ui/button";
import type { LocalDraftImportState } from "../features/application/hooks/useApplicationStorageOrchestration";

interface LocalDraftImportPromptProps {
  state: LocalDraftImportState;
  onDismiss: () => void;
  onImport: () => void;
}

export function LocalDraftImportPrompt({
  state,
  onDismiss,
  onImport,
}: LocalDraftImportPromptProps) {
  if (state.status === "idle") {
    return null;
  }

  const isImporting = state.status === "importing";
  const isCompleted = state.status === "completed";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-950">
              {isCompleted
                ? "Local draft import finished"
                : "Import drafts from this device?"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isCompleted
                ? `${state.importedCount} imported, ${state.skippedCount} skipped, ${state.failedCount} failed.`
                : `We found ${state.localDraftCount} draft application${
                    state.localDraftCount === 1 ? "" : "s"
                  } saved on this browser. Import them into your signed-in account.`}
            </p>
            {state.error ? (
              <p className="mt-2 text-sm font-medium text-[var(--error-text)]">
                {state.error}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
            {!isCompleted ? (
              <Button
                disabled={isImporting}
                size="sm"
                onClick={() => {
                  onImport();
                }}
              >
                {isImporting ? "Importing..." : "Import drafts"}
              </Button>
            ) : null}
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={onDismiss}
            >
              {isCompleted ? "Done" : "Not now"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
