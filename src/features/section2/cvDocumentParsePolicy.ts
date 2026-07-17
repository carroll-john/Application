import type { EmploymentExperience } from "../../lib/applicationData";
import { employmentExperiencesDiffer } from "../../lib/documentParsers/cv";
import {
  getCvParserErrorCode,
  trackCvParserDraftEmpty,
  trackCvParserDraftFailed,
  trackCvParserDraftSucceeded,
  trackCvParserSaveContinueClicked,
} from "../../lib/posthog";
import {
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} from "../../lib/cvParserClient";
import { deleteStoredDocument, type UploadedDocument } from "../../lib/documentStorage";
import { documentRemovalCopy } from "./documentRemovalCopy";
import { isSection2DocumentRemoved } from "./section2DocumentRemoval";
import type { DocumentParsePolicy } from "./useSection2DocumentSaveWithParse";

export const cvEmploymentParseCopy = {
  draftSuccess:
    "We drafted employment history from your CV. Review the roles below or on the qualifications page.",
  draftUpdated:
    "We updated your employment history from your new CV. Review the roles and adjust anything that looks off.",
  draftEmpty:
    "We couldn't find clear employment history in this CV. You can add roles manually.",
} as const;

export interface CvDocumentParseContext {
  currentDocument?: UploadedDocument;
  employmentExperiences: EmploymentExperience[];
  hasParsedCvFile?: (file: File) => boolean;
  originalDocument?: UploadedDocument;
  selectedFile: File | null;
}

export type CvParseDraft = Awaited<
  ReturnType<typeof parseEmploymentExperiencesFromCv>
>;

export function createCvDocumentParsePolicy(deps: {
  employmentExperiences: EmploymentExperience[];
  replaceEmploymentExperiences: (
    experiences: EmploymentExperience[],
  ) => Promise<void>;
}): DocumentParsePolicy<CvParseDraft, CvDocumentParseContext> {
  const removeEmployerLetters = async () => {
    await Promise.all(
      deps.employmentExperiences
        .map((experience) => experience.employerLetterDocument)
        .filter((document): document is UploadedDocument => Boolean(document))
        .map((document) => deleteStoredDocument(document)),
    );
  };
  return {
    documentKind: "cv",
    shouldParse: ({ selectedFile, hasParsedCvFile }) =>
      Boolean(selectedFile) && !(hasParsedCvFile?.(selectedFile!) ?? false),
    parseFile: parseEmploymentExperiencesFromCv,
    applyDraft: async (draft) => {
      await deps.replaceEmploymentExperiences(draft.experiences);
      await removeEmployerLetters();
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
        const isReplacement = context.employmentExperiences.length > 0;
        const experiencesChanged = employmentExperiencesDiffer(
          context.employmentExperiences,
          draft.experiences,
        );
        const rolesLabel = draft.experiences.length === 1 ? "role" : "roles";

        if (isReplacement && experiencesChanged) {
          return {
            message: `We updated ${draft.experiences.length} employment ${rolesLabel} from your new CV. Review the details and adjust anything that looks off.`,
            type: "success",
          };
        }

        return {
          message: `We drafted ${draft.experiences.length} employment ${rolesLabel} from your CV. Review the details and adjust anything that looks off.`,
          type: "success",
        };
      }

      if (draft && draft.experiences.length === 0) {
        return {
          message: cvEmploymentParseCopy.draftEmpty,
          type: "warning",
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
    getDocumentRemovalImpact: (context) => {
      if (
        !isSection2DocumentRemoved({
          currentDocument: context.currentDocument,
          originalDocument: context.originalDocument,
          selectedFile: context.selectedFile,
        }) ||
        context.employmentExperiences.length === 0
      ) {
        return null;
      }

      return {
        confirmMessage: documentRemovalCopy.cvConfirm,
      };
    },
    clearDerivedDataOnRemoval: async () => {
      await deps.replaceEmploymentExperiences([]);
      await removeEmployerLetters();
    },
    afterDocumentSave: async ({ savedDocument, uploadDocument, removeDocument }) => {
      if (savedDocument) {
        await uploadDocument(savedDocument);
      } else {
        await removeDocument();
      }
    },
  };
}
