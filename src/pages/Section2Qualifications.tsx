import {
  Award,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Edit2,
  FileText,
  GraduationCap,
  Languages,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { StatusPill } from "../components/StatusPill";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { meetsSection2SubmissionRequirement } from "../lib/section2Requirements";

type SectionStatus =
  | "locked"
  | "active"
  | "completed"
  | "skipped"
  | "needsAttention";

interface SectionState {
  tertiary: SectionStatus;
  cv: SectionStatus;
  employment: SectionStatus;
  accreditation: SectionStatus;
  secondary: SectionStatus;
  languageTest: SectionStatus;
}

const initialSections: SectionState = {
  tertiary: "active",
  cv: "locked",
  employment: "locked",
  accreditation: "locked",
  secondary: "locked",
  languageTest: "locked",
};

function isTertiaryQualificationComplete(
  qualification: (typeof useApplication extends () => infer T ? T : never)["data"]["tertiaryQualifications"][number],
) {
  const hasTranscript =
    Boolean(qualification.transcriptDocument) ||
    Boolean(qualification.transcriptDocumentName);
  const hasCertificate =
    Boolean(qualification.certificateDocument) ||
    Boolean(qualification.certificateDocumentName);

  if (!hasTranscript) {
    return false;
  }

  if (qualification.completed && !hasCertificate) {
    return false;
  }

  return true;
}

export default function Section2Qualifications() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath, reviewSuffix } = useReviewReturn();
  const {
    data,
    removeEmploymentExperience,
    removeLanguageTest,
    removeProfessionalAccreditation,
    removeSecondaryQualification,
    removeTertiaryQualification,
  } = useApplication();

  const [sectionStates, setSectionStates] =
    useState<SectionState>(initialSections);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "warning" | "error" | "status";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasTertiaryQualification = data.tertiaryQualifications.length > 0;
  const tertiaryRequirementsMet =
    hasTertiaryQualification &&
    data.tertiaryQualifications.every(isTertiaryQualificationComplete);
  const hasCv = data.cvUploaded;
  const hasEmploymentExperience = data.employmentExperiences.length > 0;
  const meetsSection2MinimumRequirement = meetsSection2SubmissionRequirement({
    cvUploaded: hasCv,
    employmentExperiencesCount: data.employmentExperiences.length,
    tertiaryQualificationsCount: data.tertiaryQualifications.length,
  });

  useEffect(() => {
    const next: SectionState = { ...initialSections };

    if (data.tertiaryQualifications.length > 0) {
      next.tertiary = tertiaryRequirementsMet ? "completed" : "needsAttention";
      next.cv = "active";
    }
    if (data.cvUploaded) {
      next.cv = "completed";
      next.employment = "active";
    }
    if (data.employmentExperiences.length > 0) {
      next.employment = "completed";
      next.accreditation = "active";
    }
    if (data.professionalAccreditations.length > 0) {
      next.accreditation = "completed";
      next.secondary = "active";
    }
    if (data.secondaryQualifications.length > 0) {
      next.secondary = "completed";
      next.languageTest = "active";
    }
    if (data.languageTests.length > 0) {
      next.languageTest = "completed";
    }

    setSectionStates((previous) => ({
      ...next,
      tertiary:
        previous.tertiary === "skipped" && next.tertiary === "active"
          ? "skipped"
          : next.tertiary,
      cv:
        previous.cv === "skipped" && next.cv === "active" ? "skipped" : next.cv,
      employment:
        previous.employment === "skipped" && next.employment === "active"
          ? "skipped"
          : next.employment,
      accreditation:
        previous.accreditation === "skipped" && next.accreditation === "active"
          ? "skipped"
          : next.accreditation,
      secondary:
        previous.secondary === "skipped" && next.secondary === "active"
          ? "skipped"
          : next.secondary,
      languageTest:
        previous.languageTest === "skipped" && next.languageTest === "active"
          ? "skipped"
          : next.languageTest,
    }));
  }, [data, tertiaryRequirementsMet]);

  function handlePrevious() {
    navigate(returnPath("/section1/family-support"));
  }

  async function handleSaveAndContinue() {
    setIsSaving(true);

    if (fromReview) {
      await import("./ReviewAndSubmit");
      navigate("/review");
      return;
    }

    await import("./ReviewAndSubmit");
    navigate("/review");
  }

  async function handleSaveAndExit() {
    setIsSaving(true);
    await import("./Dashboard");
    navigate("/dashboard");
  }

  function handleSkipSection(section: keyof SectionState) {
    const order: Array<keyof SectionState> = [
      "tertiary",
      "cv",
      "employment",
      "accreditation",
      "secondary",
      "languageTest",
    ];

    setSectionStates((previous) => {
      const next = { ...previous, [section]: "skipped" as SectionStatus };
      const currentIndex = order.indexOf(section);
      if (currentIndex < order.length - 1) {
        const nextSection = order[currentIndex + 1];
        if (next[nextSection] === "locked") {
          next[nextSection] = "active";
        }
      }
      return next;
    });

    setStatusMessage({
      type: "status",
      message: "Section skipped. You can always come back to add information later.",
    });
  }

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Work through each section to build your application."
          progress={66}
          sectionLabel="Section 2 of 3"
          title="Your qualifications"
        />
        <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3 sm:mb-8">
          <p className="text-xs text-[var(--info-text)] sm:text-sm">
            <strong>Tip:</strong> Complete as much as you can now. Skip any
            section that doesn&apos;t apply and come back later if needed.
          </p>
          {!meetsSection2MinimumRequirement ? (
            <p className="mt-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-text)] sm:text-sm">
              <strong>Before submit:</strong> Add either one tertiary
              qualification, or both a CV and employment experience.
            </p>
          ) : null}
        </div>

        {statusMessage ? (
          <div className="mb-6 sm:mb-8">
            <StatusMessage
              message={statusMessage.message}
              onDismiss={() => setStatusMessage(null)}
              type={statusMessage.type}
            />
          </div>
        ) : null}

        <div className="space-y-6">
          <SectionCard
            actionRoute={`/section2/add-tertiary${reviewSuffix}`}
            description="Add your university degrees and diplomas"
            emptyMessage="No qualifications added yet"
            icon={<GraduationCap className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.tertiaryQualifications}
            onSkip={() => handleSkipSection("tertiary")}
            renderItem={(qualification) => (
              <ListItemCard
                key={qualification.id}
                subtitle={qualification.institution}
                title={qualification.courseName || "Tertiary Qualification"}
                attachments={[
                  qualification.transcriptDocumentName,
                  qualification.certificateDocumentName,
                ].filter(Boolean) as string[]}
                onDelete={() => removeTertiaryQualification(qualification.id)}
                onEdit={() =>
                  navigate(
                    `/section2/edit-tertiary/${qualification.id}${reviewSuffix}`,
                  )
                }
              />
            )}
            status={sectionStates.tertiary}
            title="Tertiary Qualifications"
          />

          <SectionCard
            actionRoute={`/section2/add-cv${reviewSuffix}`}
            actionText={data.cvUploaded ? "Replace" : "Add"}
            description="Add your current CV or resume"
            emptyMessage="No CV uploaded yet"
            icon={<FileText className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.cvUploaded ? [{ id: "cv", name: data.cvFileName ?? "" }] : []}
            onSkip={() => handleSkipSection("cv")}
            renderItem={(item) => (
              <div
                key={item.id}
                className="rounded border border-gray-200 bg-white p-3 sm:p-4"
              >
                <Attachment fileName={item.name} />
              </div>
            )}
            status={sectionStates.cv}
            title="Curriculum Vitae (CV)"
          />

          <SectionCard
            actionRoute={`/section2/add-employment${reviewSuffix}`}
            description="Add your work history and experience"
            emptyMessage="No employment experience added yet"
            icon={<Briefcase className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.employmentExperiences}
            onSkip={() => handleSkipSection("employment")}
            renderItem={(experience) => (
              <ListItemCard
                key={experience.id}
                subtitle={experience.company}
                title={experience.position || "Position"}
                onDelete={() => removeEmploymentExperience(experience.id)}
                onEdit={() =>
                  navigate(
                    `/section2/edit-employment/${experience.id}${reviewSuffix}`,
                  )
                }
              />
            )}
            status={sectionStates.employment}
            title="Employment Experience"
          />

          <SectionCard
            actionRoute={`/section2/add-accreditation${reviewSuffix}`}
            description="Add certifications and professional memberships"
            emptyMessage="No accreditations added yet"
            icon={<Award className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.professionalAccreditations}
            onSkip={() => handleSkipSection("accreditation")}
            renderItem={(accreditation) => (
              <ListItemCard
                key={accreditation.id}
                subtitle={accreditation.status}
                title={accreditation.name || "Accreditation"}
                attachment={accreditation.documentName}
                onDelete={() => removeProfessionalAccreditation(accreditation.id)}
                onEdit={() =>
                  navigate(
                    `/section2/edit-accreditation/${accreditation.id}${reviewSuffix}`,
                  )
                }
              />
            )}
            status={sectionStates.accreditation}
            title="Professional Accreditations"
          />

          <SectionCard
            actionRoute={`/section2/add-secondary${reviewSuffix}`}
            description="Add your high school education details"
            emptyMessage="No secondary qualifications added yet"
            icon={<GraduationCap className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.secondaryQualifications}
            onSkip={() => handleSkipSection("secondary")}
            renderItem={(qualification) => (
              <ListItemCard
                key={qualification.id}
                subtitle={qualification.school}
                title={qualification.qualification || "Secondary Qualification"}
                onDelete={() => removeSecondaryQualification(qualification.id)}
                onEdit={() =>
                  navigate(
                    `/section2/edit-secondary/${qualification.id}${reviewSuffix}`,
                  )
                }
              />
            )}
            status={sectionStates.secondary}
            title="Secondary Qualifications"
          />

          <SectionCard
            actionRoute={`/section2/add-language-test${reviewSuffix}`}
            description="Add IELTS, TOEFL, or other English test results"
            emptyMessage="No language tests added yet"
            icon={<Languages className="h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            items={data.languageTests}
            onSkip={() => handleSkipSection("languageTest")}
            renderItem={(test) => (
              <ListItemCard
                key={test.id}
                subtitle={`${test.type} - ${test.year}`}
                title={test.name || "Language Test"}
                attachment={test.documentName}
                onDelete={() => removeLanguageTest(test.id)}
                onEdit={() =>
                  navigate(
                    `/section2/edit-language-test/${test.id}${reviewSuffix}`,
                  )
                }
              />
            )}
            status={sectionStates.languageTest}
            title="English Language Proficiency"
          />
        </div>

        <FormActionBar
          previousDisabled={isSaving}
          previousLabel={previousLabel}
          primaryDisabled={isSaving}
          primaryLabel={
            isSaving
              ? fromReview
                ? "Opening Review..."
                : "Saving & Continuing..."
              : fromReview
                ? "Return to Review"
                : "Save & Continue"
          }
          onPrevious={handlePrevious}
          onPrimary={handleSaveAndContinue}
          onSecondary={fromReview ? undefined : handleSaveAndExit}
          secondaryDisabled={isSaving}
          secondaryLabel={fromReview ? undefined : isSaving ? "Saving..." : "Save & Exit"}
        />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  status,
  items,
  renderItem,
  emptyMessage,
  actionRoute,
  actionText = "Add",
  onSkip,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  status: SectionStatus;
  items: Array<any>;
  renderItem: (item: any) => ReactNode;
  emptyMessage: string;
  actionRoute: string;
  actionText?: string;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  const isLocked = status === "locked";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const needsAttention = status === "needsAttention";

  function getSectionClasses() {
    switch (status) {
      case "locked":
        return "bg-gray-100 border-gray-300 opacity-60";
      case "active":
        return "bg-[var(--info-bg)] border-[var(--cta-secondary)] border-2 shadow-md";
      case "completed":
        return "bg-[var(--success-bg)] border-[var(--success-border)]";
      case "needsAttention":
        return "bg-[var(--warning-bg)] border-[var(--warning-border)]";
      case "skipped":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-white border-gray-200";
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm transition-all sm:p-6 ${getSectionClasses()}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative">
            {icon}
            {isCompleted ? (
              <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-green-600" />
            ) : null}
            {needsAttention ? (
              <AlertTriangle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-[var(--warning-text)]" />
            ) : null}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                {title}
              </h3>
              {isCompleted ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="success">
                  Completed
                </StatusPill>
              ) : null}
              {needsAttention ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="warning">
                  Incomplete
                </StatusPill>
              ) : null}
              {isSkipped ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="neutral">
                  Skipped
                </StatusPill>
              ) : null}
              {isActive ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="info">
                  Current
                </StatusPill>
              ) : null}
            </div>
            <p className="text-xs text-gray-600 sm:text-sm">{description}</p>
          </div>
        </div>

        {isLocked ? (
          <div className="text-xs italic text-gray-500 sm:text-sm">
            Complete previous sections to unlock
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              className={`h-10 rounded-lg text-sm font-medium shadow-none ${
                isActive && items.length === 0 ? "flex-1 sm:flex-initial" : "w-full sm:w-auto"
              }`}
              disabled={isLocked}
              onClick={() => navigate(actionRoute)}
              variant="soft"
            >
              <Plus className="mr-2 h-4 w-4" />
              {actionText}
            </Button>
            {isActive && items.length === 0 ? (
              <Button
                className="h-10 flex-1 rounded-lg text-sm font-medium shadow-none sm:flex-initial"
                onClick={onSkip}
                variant="outline"
              >
                Skip
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {isLocked ? null : items.length > 0 ? (
        <div className="mt-4 space-y-2">{items.map((item) => renderItem(item))}</div>
      ) : isSkipped ? (
        <p className="mt-2 text-xs italic text-gray-500 sm:text-sm">
          This section was skipped. You can still add information by clicking the
          Add button above.
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500 sm:text-sm">{emptyMessage}</p>
      )}
    </div>
  );
}

function ListItemCard({
  title,
  subtitle,
  attachment,
  attachments,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  attachment?: string;
  attachments?: string[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const attachmentList = attachments ?? (attachment ? [attachment] : []);

  return (
    <div className="rounded border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 sm:text-base">{title}</p>
          <p className="text-xs text-gray-600 sm:text-sm">{subtitle}</p>
          {attachmentList.length
            ? attachmentList.map((attachmentName) => (
                <Attachment key={attachmentName} fileName={attachmentName} />
              ))
            : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-9 flex-1 rounded-lg border-slate-300 px-3 py-2 text-xs text-slate-700 shadow-none hover:bg-slate-50 sm:flex-initial sm:text-sm"
            onClick={onEdit}
            variant="outline"
          >
            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            className="h-9 flex-1 rounded-lg border-red-200 px-3 py-2 text-xs text-red-600 shadow-none hover:bg-red-50 sm:flex-initial sm:text-sm"
            onClick={onDelete}
            variant="outline"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Attachment({ fileName }: { fileName: string }) {
  return (
    <div className="mt-2 flex min-w-0 items-start gap-1.5">
      <Paperclip className="h-3 w-3 shrink-0 text-green-600 sm:h-3.5 sm:w-3.5" />
      <span className="min-w-0 break-all text-xs font-medium text-green-600">
        {fileName}
      </span>
    </div>
  );
}
