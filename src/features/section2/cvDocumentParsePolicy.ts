import type { EmploymentExperience } from "../../lib/applicationData";
import {
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
  trackCvParserSaveContinueClicked,
} from "../../lib/analytics/documentParserAnalytics";
import {
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} from "../../lib/cvParserClient";
import type { UploadedDocument } from "../../lib/documentStorage";
import type { DocumentParsePolicy } from "./useSection2DocumentSaveWithParse";

export interface CvDocumentParseContext {
  currentDocument?: UploadedDocument;
  employmentExperiences: EmploymentExperience[];
  originalDocument?: UploadedDocument;
  selectedFile: File | null;
}

export type CvParseDraft = Awaited<
  ReturnType<typeof parseEmploymentExperiencesFromCv>
>;

export function createCvDocumentParsePolicy(deps: {
  replaceEmploymentExperiences: (
    experiences: EmploymentExperience[],
  ) => Promise<void>;
}): DocumentParsePolicy<CvParseDraft, CvDocumentParseContext> {
  return {
    documentKind: "cv",
    shouldParse: ({ selectedFile, employmentExperiences }) =>
      Boolean(selectedFile) && employmentExperiences.length === 0,
    parseFile: parseEmploymentExperiencesFromCv,
    applyDraft: async (draft) => {
      await deps.replaceEmploymentExperiences(draft.experiences);
    },
    isEmptyDraft: (draft) => draft.experiences.length === 0,
    progress: {
      saving: ({ selectedFile, employmentExperiences }) => ({
        detail:
          Boolean(selectedFile) && employmentExperiences.length === 0
            ? "Please keep this tab open while we save your CV and draft your employment history."
            : "Please keep this tab open while we save your CV.",
        title: "Saving your CV...",
      }),
      parsing: {
        detail: "This can take a little longer for larger files.",
        title: "Reading your CV and drafting employment history...",
      },
      applying: {
        detail: "Almost done.",
        title: "Applying employment draft...",
      },
      finalising: {
        detail: "Taking you to the next step.",
        title: "Finalising...",
      },
    },
    analytics: {
      onContinueClick: ({ selectedFile, employmentExperiences }) => {
        trackCvParserSaveContinueClicked({
          existingEmploymentCount: employmentExperiences.length,
          hasSelectedFile: Boolean(selectedFile),
        });
      },
      onParseSuccess: (draft, parseDurationMs) => {
        trackCvParserDraftSucceeded({
          draftedRolesCount: draft.experiences.length,
          parseDurationMs,
        });
      },
      onParseEmpty: (parseDurationMs) => {
        trackCvParserDraftEmpty({ parseDurationMs });
      },
      onParseFailure: (error, parseDurationMs) => {
        trackCvParserDraftFailed({
          errorCode: getCvParserErrorCode(error),
          parseDurationMs,
        });
      },
    },
    buildFlashMessage: ({ context, draft, parseError }) => {
      if (parseError) {
        return {
          message: getCvParserErrorMessage(parseError),
          type: "warning",
        };
      }

      if (draft && draft.experiences.length > 0) {
        const rolesLabel = draft.experiences.length === 1 ? "role" : "roles";
        return {
          message: `We drafted ${draft.experiences.length} employment ${rolesLabel} from your CV. Review the details and adjust anything that looks off.`,
          type: "success",
        };
      }

      if (draft && draft.experiences.length === 0) {
        return {
          message:
            "We saved your CV, but couldn't find clear employment history to auto-fill.",
          type: "warning",
        };
      }

      if (context.selectedFile && context.employmentExperiences.length > 0) {
        return {
          message:
            "We saved your CV. Existing employment history was left unchanged to avoid duplicate roles.",
          type: "status",
        };
      }

      return undefined;
    },
    errorFallbackMessage:
      "We couldn't save your CV right now. Please try again.",
    hasDocumentChanges: ({
      currentDocument,
      originalDocument,
      selectedFile,
    }) => Boolean(selectedFile) || currentDocument !== originalDocument,
    afterDocumentSave: async ({ savedDocument, uploadDocument, removeDocument }) => {
      if (savedDocument) {
        await uploadDocument(savedDocument);
      } else {
        await removeDocument();
      }
    },
  };
}
