import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { FileUpload } from "../components/FileUpload";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import {
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} from "../lib/cvParserClient";
import {
  capturePostHogEvent,
  CV_PARSER_FEATURE_FLAG_KEY,
  getCvParserExperimentState,
  onPostHogFeatureFlags,
} from "../lib/posthog";
import {
  deleteStoredDocument,
  getDocumentUploadErrorMessage,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";

export default function Section2AddCV() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
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
  const [cvParserExperiment, setCvParserExperiment] = useState(() =>
    getCvParserExperimentState(),
  );
  const hasDocument =
    Boolean(selectedFile) || Boolean(currentDocument) || Boolean(currentFileName);

  useEffect(() => {
    const syncExperiment = () => {
      setCvParserExperiment(getCvParserExperimentState());
    };

    syncExperiment();

    const stopListening = onPostHogFeatureFlags(syncExperiment);

    return () => {
      stopListening();
    };
  }, []);

  async function handleSaveAndContinue() {
    const hasNewCvForAutoDraft =
      Boolean(selectedFile) && data.employmentExperiences.length === 0;
    const isDraftingEmploymentFromCv =
      hasNewCvForAutoDraft && cvParserExperiment.enabled;
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

    capturePostHogEvent("cv_parser_save_continue_clicked", {
      existing_employment_count: data.employmentExperiences.length,
      has_selected_file: Boolean(selectedFile),
      parser_enabled_for_cohort: cvParserExperiment.enabled,
    });

    if (hasNewCvForAutoDraft) {
      capturePostHogEvent("cv_parser_experiment_exposure", {
        experiment_source: cvParserExperiment.source,
        feature_flag_key: CV_PARSER_FEATURE_FLAG_KEY,
        parser_enabled_for_cohort: cvParserExperiment.enabled,
        variant: cvParserExperiment.variant ?? "none",
      });
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

        if (!parseResult.ok) {
          capturePostHogEvent("cv_parser_autofill_failed", {
            feature_flag_key: CV_PARSER_FEATURE_FLAG_KEY,
            parse_duration_ms:
              parseStartedAt === null ? undefined : Date.now() - parseStartedAt,
            parser_enabled_for_cohort: cvParserExperiment.enabled,
            variant: cvParserExperiment.variant ?? "none",
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
          capturePostHogEvent("cv_parser_autofill_succeeded", {
            drafted_roles_count: parseResult.parsedEmployment.experiences.length,
            feature_flag_key: CV_PARSER_FEATURE_FLAG_KEY,
            parse_duration_ms:
              parseStartedAt === null ? undefined : Date.now() - parseStartedAt,
            parser_enabled_for_cohort: cvParserExperiment.enabled,
            variant: cvParserExperiment.variant ?? "none",
          });
          flashMessage = {
            message: `We drafted ${parseResult.parsedEmployment.experiences.length} employment ${rolesLabel} from your CV. Review the details and adjust anything that looks off.`,
            type: "success",
          };
        } else {
          capturePostHogEvent("cv_parser_autofill_empty", {
            drafted_roles_count: 0,
            feature_flag_key: CV_PARSER_FEATURE_FLAG_KEY,
            parse_duration_ms:
              parseStartedAt === null ? undefined : Date.now() - parseStartedAt,
            parser_enabled_for_cohort: cvParserExperiment.enabled,
            variant: cvParserExperiment.variant ?? "none",
          });
          flashMessage = {
            message:
              "We saved your CV, but couldn't find clear employment history to auto-fill.",
            type: "warning",
          };
        }
      } else if (hasNewCvForAutoDraft && !cvParserExperiment.enabled) {
        capturePostHogEvent("cv_parser_autofill_skipped_control", {
          feature_flag_key: CV_PARSER_FEATURE_FLAG_KEY,
          parser_enabled_for_cohort: cvParserExperiment.enabled,
          variant: cvParserExperiment.variant ?? "none",
        });
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
      navigate(returnPath("/section2/qualifications"), {
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

  const handlePrevious = () => navigate(returnPath("/section2/qualifications"));

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add your current CV or resume."
          progress={66}
          sectionLabel="Section 2 of 3"
          title="Upload your CV"
        />

        <FormSectionCard className="lg:p-8">
          <div className="space-y-6">
            {statusMessage ? (
              <StatusMessage
                message={statusMessage.message}
                type={statusMessage.type}
                onDismiss={() => setStatusMessage(null)}
              />
            ) : null}
            {isSaving && saveProgress ? (
              <div
                aria-live="polite"
                className="rounded-2xl border border-[var(--info-border)] bg-[linear-gradient(140deg,#f4fbff_0%,#eef7fc_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(8,78,116,0.08)]"
                role="status"
              >
                <div className="flex items-start gap-3">
                  <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[var(--info-text)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--info-text)]">
                      {saveProgress.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--info-text)]/80">
                      {saveProgress.detail}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--cta-secondary)]" />
                </div>
              </div>
            ) : null}
            <FileUpload
              attachedDescription="Your CV or resume is attached. You can view or remove it below."
              className={
                hasDocument
                  ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                  : "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]"
              }
              description="Include your recent experience, skills, and achievements."
              fileName={selectedFile?.name || currentDocument?.name || currentFileName}
              fileSize={selectedFile?.size || currentDocument?.size}
              helperText=""
              label="CV or Resume"
              required
              onRemove={
                selectedFile || currentDocument
                  ? () => {
                      if (selectedFile) {
                        setSelectedFile(null);
                        return;
                      }

                      setCurrentDocument(undefined);
                      setCurrentFileName(undefined);
                    }
                  : undefined
              }
              onView={
                selectedFile
                  ? () => {
                      viewLocalDocument(selectedFile);
                    }
                  : currentDocument
                    ? () => {
                        void viewStoredDocument(currentDocument);
                      }
                  : undefined
              }
              onFileSelect={(file) => {
                setSelectedFile(file);
                setCurrentFileName(file.name);
              }}
            />
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-medium ${
                  hasDocument
                    ? "text-[var(--success-text)]"
                    : "text-[var(--info-text)]"
                }`}
              >
                {hasDocument
                  ? "CV attached"
                  : "Add your CV now, or come back to it later."}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
              <p className="mb-2 text-sm font-medium text-[var(--info-text)]">
                Keep your CV:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--info-text)]">
                <li>current and accurate</li>
                <li>focused on recent experience</li>
                <li>clearly named</li>
              </ul>
            </div>

            <div className="rounded-lg border border-[var(--info-border)] bg-white p-4">
              <p className="text-sm font-medium text-slate-900">
                AI employment draft
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {data.employmentExperiences.length === 0
                  ? "When you save a new CV, we'll try to draft your employment history so you can review it instead of entering every role manually."
                  : "Employment history already exists on this application, so saving a new CV will not overwrite those rows automatically."}
              </p>
            </div>
          </div>
        </FormSectionCard>

        <FormActionBar
          previousDisabled={isSaving}
          previousLabel="Cancel"
          primaryDisabled={isSaving}
          primaryLabel={isSaving ? "Saving..." : "Save & Continue"}
          onPrevious={handlePrevious}
          onPrimary={handleSaveAndContinue}
        />
      </div>
    </div>
  );
}
