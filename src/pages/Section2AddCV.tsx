import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  CvParserInfoPanel,
  CvSaveProgressPanel,
  CvUploadPanel,
  Section2FormCard,
  Section2RecordPage,
} from "../features/section2";
import { useAiExperiment } from "../hooks/useAiExperiment";
import { useSection2Navigation } from "../hooks/useSection2Navigation";
import {
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} from "../lib/cvParserClient";
import { CV_PARSER_FEATURE_FLAG_KEY } from "../lib/posthog";
import {
  deleteStoredDocument,
  getDocumentUploadErrorMessage,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";

export default function Section2AddCV() {
  const navigate = useNavigate();
  const { qualificationsPath } = useSection2Navigation();
  const {
    data,
    ensureRemoteRecordId,
    removeCV,
    replaceEmploymentExperiences,
    uploadCV,
  } = useApplication();
  const originalDocument = data.cvDocument;
  const [currentDocument, setCurrentDocument] = useState(data.cvDocument);
  const [currentFileName, setCurrentFileName] = useState(data.cvFileName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{
    detail: string;
    title: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "status";
  } | null>(null);
  const cvParserExperiment = useAiExperiment({
    flagKey: CV_PARSER_FEATURE_FLAG_KEY,
    eventPrefix: "cv_parser",
    cohortPropertyName: "parser_enabled_for_cohort",
  });
  const hasDocument =
    Boolean(selectedFile) || Boolean(currentDocument) || Boolean(currentFileName);

  async function handleSaveAndContinue() {
    const hasNewCvForAutoDraft =
      Boolean(selectedFile) && data.employmentExperiences.length === 0;
    const isDraftingEmploymentFromCv =
      hasNewCvForAutoDraft && cvParserExperiment.state.enabled;
    const parseFile = selectedFile;
    let parseStartedAt: number | null = null;
    let parseEmploymentPromise:
      | Promise<
          | {
              ok: true;
              parsedEmployment: Awaited<
                ReturnType<typeof parseEmploymentExperiencesFromCv>
              >;
            }
          | { error: unknown; ok: false }
        >
      | null = null;

    cvParserExperiment.recordEvent("save_continue_clicked", {
      existing_employment_count: data.employmentExperiences.length,
      has_selected_file: Boolean(selectedFile),
    });

    if (hasNewCvForAutoDraft) {
      cvParserExperiment.recordExposure();
    }

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress({
      detail: isDraftingEmploymentFromCv
        ? "Please keep this tab open while we save your CV and draft your employment history."
        : "Please keep this tab open while we save your CV.",
      title: "Saving your CV...",
    });

    if (isDraftingEmploymentFromCv && parseFile) {
      parseStartedAt = Date.now();
      parseEmploymentPromise = parseEmploymentExperiencesFromCv(parseFile)
        .then((parsedEmployment) => ({ ok: true as const, parsedEmployment }))
        .catch((error: unknown) => ({ error, ok: false as const }));
    }

    try {
      let savedDocument = currentDocument;
      let flashMessage:
        | {
            message: string;
            type: "success" | "warning" | "error" | "status";
          }
        | undefined;

      if (selectedFile || currentDocument !== originalDocument) {
        const applicationId = await ensureRemoteRecordId();

        if (selectedFile) {
          savedDocument = await replaceStoredDocument(
            selectedFile,
            currentDocument ?? originalDocument,
            {
              applicationId,
              kind: "cv",
            },
          );
        } else if (!currentDocument && originalDocument) {
          await deleteStoredDocument(originalDocument);
        }

        if (savedDocument) {
          await uploadCV(savedDocument);
        } else {
          await removeCV();
        }
      }

      if (isDraftingEmploymentFromCv && parseEmploymentPromise) {
        setSaveProgress({
          detail: "This can take a little longer for larger files.",
          title: "Reading your CV and drafting employment history...",
        });

        const parseResult = await parseEmploymentPromise;

        const parseDurationMs =
          parseStartedAt === null ? undefined : Date.now() - parseStartedAt;

        if (!parseResult.ok) {
          cvParserExperiment.recordEvent("autofill_failed", {
            parse_duration_ms: parseDurationMs,
          });
          flashMessage = {
            message: getCvParserErrorMessage(parseResult.error),
            type: "warning",
          };
        } else if (parseResult.parsedEmployment.experiences.length > 0) {
          setSaveProgress({
            detail: "Almost done.",
            title: "Applying employment draft...",
          });
          await replaceEmploymentExperiences(
            parseResult.parsedEmployment.experiences,
          );

          const rolesLabel =
            parseResult.parsedEmployment.experiences.length === 1
              ? "role"
              : "roles";
          cvParserExperiment.recordEvent("autofill_succeeded", {
            drafted_roles_count: parseResult.parsedEmployment.experiences.length,
            parse_duration_ms: parseDurationMs,
          });
          flashMessage = {
            message: `We drafted ${parseResult.parsedEmployment.experiences.length} employment ${rolesLabel} from your CV. Review the details and adjust anything that looks off.`,
            type: "success",
          };
        } else {
          cvParserExperiment.recordEvent("autofill_empty", {
            drafted_roles_count: 0,
            parse_duration_ms: parseDurationMs,
          });
          flashMessage = {
            message:
              "We saved your CV, but couldn't find clear employment history to auto-fill.",
            type: "warning",
          };
        }
      } else if (hasNewCvForAutoDraft && !cvParserExperiment.state.enabled) {
        cvParserExperiment.recordEvent("autofill_skipped_control");
        flashMessage = {
          message:
            "We saved your CV. Employment auto-draft is off for your current test group, so you can add roles manually.",
          type: "status",
        };
      } else if (selectedFile && data.employmentExperiences.length > 0) {
        flashMessage = {
          message:
            "We saved your CV. Existing employment history was left unchanged to avoid duplicate roles.",
          type: "status",
        };
      }

      setSaveProgress({
        detail: "Taking you to the next step.",
        title: "Finalising...",
      });
      navigate(qualificationsPath, {
        state: flashMessage ? { section2StatusMessage: flashMessage } : undefined,
      });
    } catch (error) {
      setSaveProgress(null);
      setStatusMessage({
        message:
          getDocumentUploadErrorMessage(error) ??
          "We couldn't save your CV right now. Please try again.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  }

  return (
    <Section2RecordPage
      addTitle="Upload your CV"
      continueDisabled={isSaving}
      continueLabel={isSaving ? "Saving..." : "Save & Continue"}
      description="Add your current CV or resume."
      editTitle="Upload your CV"
      isEditing={false}
      onContinue={handleSaveAndContinue}
      previousDisabled={isSaving}
    >
      <Section2FormCard className="lg:p-8">
        <div className="space-y-6">
          {statusMessage ? (
            <StatusMessage
              message={statusMessage.message}
              type={statusMessage.type}
              onDismiss={() => setStatusMessage(null)}
            />
          ) : null}
          {isSaving && saveProgress ? (
            <CvSaveProgressPanel
              detail={saveProgress.detail}
              title={saveProgress.title}
            />
          ) : null}
          <CvUploadPanel
            currentDocument={currentDocument}
            currentFileName={currentFileName}
            hasDocument={hasDocument}
            selectedFile={selectedFile}
            onClearDocument={() => {
              setCurrentDocument(undefined);
              setCurrentFileName(undefined);
            }}
            onClearSelectedFile={() => setSelectedFile(null)}
            onFileSelect={(file) => {
              setSelectedFile(file);
              setCurrentFileName(file.name);
            }}
            onViewDocument={() => {
              if (currentDocument) {
                void viewStoredDocument(currentDocument);
              }
            }}
            onViewSelectedFile={() => {
              if (selectedFile) {
                viewLocalDocument(selectedFile);
              }
            }}
          />
          <CvParserInfoPanel
            hasExistingEmployment={data.employmentExperiences.length > 0}
          />
        </div>
      </Section2FormCard>
    </Section2RecordPage>
  );
}
