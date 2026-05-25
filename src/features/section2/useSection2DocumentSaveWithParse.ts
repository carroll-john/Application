import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import { useSection2Navigation } from "../../hooks/useSection2Navigation";
import { getDocumentUploadErrorMessage } from "../../lib/documentStorage";
import type { DocumentKind, UploadedDocument } from "../../lib/documentStorage";
import { saveSection2DocumentRecord } from "./section2DocumentSave";
import { confirmDocumentRemoval } from "./documentRemovalCopy";
import { isSection2DocumentRemoved } from "./section2DocumentRemoval";

export interface DocumentParsePolicy<TDraft, TContext> {
  documentKind: DocumentKind;
  shouldParse: (context: TContext) => boolean;
  parseFile: (file: File) => Promise<TDraft>;
  applyDraft: (draft: TDraft) => Promise<void>;
  isEmptyDraft?: (draft: TDraft) => boolean;
  progress: {
    saving: (context: TContext) => { title: string; detail: string };
    parsing: { title: string; detail: string };
    applying: { title: string; detail: string };
    finalising: { title: string; detail: string };
  };
  analytics: {
    onContinueClick: (context: TContext) => void;
    onParseSuccess: (draft: TDraft, parseDurationMs?: number) => void;
    onParseEmpty: (parseDurationMs?: number) => void;
    onParseFailure: (error: unknown, parseDurationMs?: number) => void;
  };
  buildFlashMessage: (outcome: {
    context: TContext;
    draft?: TDraft;
    parseError?: unknown;
  }) => Section2RecordStatusMessage | undefined;
  errorFallbackMessage: string;
  hasDocumentChanges: (context: TContext) => boolean;
  getDocumentRemovalImpact?: (context: TContext) => {
    confirmMessage: string;
  } | null;
  clearDerivedDataOnRemoval?: (context: TContext) => Promise<void>;
  afterDocumentSave?: (args: {
    context: TContext;
    savedDocument?: UploadedDocument;
    uploadDocument: (document: UploadedDocument) => Promise<void>;
    removeDocument: () => Promise<void>;
  }) => Promise<void>;
}

interface UseSection2DocumentSaveWithParseOptions<TDraft, TContext> {
  context: TContext;
  ensureApplicationRow: () => Promise<string>;
  getCurrentDocument: (context: TContext) => UploadedDocument | undefined;
  getOriginalDocument: (context: TContext) => UploadedDocument | undefined;
  getSelectedFile: (context: TContext) => File | null;
  policy: DocumentParsePolicy<TDraft, TContext>;
  removeDocument?: () => Promise<void>;
  uploadDocument?: (document: UploadedDocument) => Promise<void>;
}

export function useSection2DocumentSaveWithParse<TDraft, TContext>({
  context,
  ensureApplicationRow,
  getCurrentDocument,
  getOriginalDocument,
  getSelectedFile,
  policy,
  removeDocument,
  uploadDocument,
}: UseSection2DocumentSaveWithParseOptions<TDraft, TContext>) {
  const navigate = useNavigate();
  const { qualificationsPath } = useSection2Navigation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{
    detail: string;
    title: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] =
    useState<Section2RecordStatusMessage | null>(null);

  const clearStatusMessage = useCallback(() => {
    setStatusMessage(null);
  }, []);

  const handleSaveAndContinue = useCallback(async () => {
    const selectedFile = getSelectedFile(context);
    const shouldParse = policy.shouldParse(context) && Boolean(selectedFile);
    let parseStartedAt: number | null = null;
    let parsePromise:
      | Promise<{ ok: true; draft: TDraft } | { error: unknown; ok: false }>
      | null = null;

    policy.analytics.onContinueClick(context);

    const removalImpact = policy.getDocumentRemovalImpact?.(context);
    if (removalImpact && !confirmDocumentRemoval(removalImpact.confirmMessage)) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress(policy.progress.saving(context));

    if (shouldParse && selectedFile) {
      parseStartedAt = Date.now();
      parsePromise = policy
        .parseFile(selectedFile)
        .then((draft) => ({ draft, ok: true as const }))
        .catch((error: unknown) => ({ error, ok: false as const }));
    }

    try {
      let savedDocument: UploadedDocument | undefined;
      let draft: TDraft | undefined;
      let parseError: unknown;

      if (policy.hasDocumentChanges(context)) {
        const { document } = await saveSection2DocumentRecord({
          currentDocument: getCurrentDocument(context),
          ensureApplicationRow,
          kind: policy.documentKind,
          originalDocument: getOriginalDocument(context),
          selectedFile,
        });
        savedDocument = document;

        if (policy.afterDocumentSave && uploadDocument && removeDocument) {
          await policy.afterDocumentSave({
            context,
            removeDocument,
            savedDocument,
            uploadDocument,
          });
        }
      }

      const documentRemoved = isSection2DocumentRemoved({
        currentDocument: getCurrentDocument(context),
        originalDocument: getOriginalDocument(context),
        selectedFile,
      });

      if (documentRemoved && policy.clearDerivedDataOnRemoval) {
        await policy.clearDerivedDataOnRemoval(context);
      }

      if (shouldParse && parsePromise) {
        setSaveProgress(policy.progress.parsing);
        const parseResult = await parsePromise;
        const parseDurationMs =
          parseStartedAt === null ? undefined : Date.now() - parseStartedAt;

        if (!parseResult.ok) {
          parseError = parseResult.error;
          policy.analytics.onParseFailure(parseResult.error, parseDurationMs);
        } else {
          draft = parseResult.draft;

          if (policy.isEmptyDraft?.(draft)) {
            policy.analytics.onParseEmpty(parseDurationMs);
          } else {
            setSaveProgress(policy.progress.applying);
            await policy.applyDraft(draft);
            policy.analytics.onParseSuccess(draft, parseDurationMs);
          }
        }
      }

      const flashMessage = policy.buildFlashMessage({
        context,
        draft,
        parseError,
      });

      setSaveProgress(policy.progress.finalising);
      navigate(qualificationsPath, {
        state: flashMessage ? { section2StatusMessage: flashMessage } : undefined,
      });
    } catch (error) {
      setSaveProgress(null);
      setStatusMessage({
        message:
          getDocumentUploadErrorMessage(error) ?? policy.errorFallbackMessage,
        type: "error",
      });
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  }, [
    context,
    ensureApplicationRow,
    getCurrentDocument,
    getOriginalDocument,
    getSelectedFile,
    navigate,
    policy,
    qualificationsPath,
    removeDocument,
    uploadDocument,
  ]);

  return {
    clearStatusMessage,
    handleSaveAndContinue,
    isSaving,
    saveProgress,
    statusMessage,
  };
}
