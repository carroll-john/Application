import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { MonthYearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import {
  deleteStoredDocument,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";
import { countries, months, years } from "../lib/formOptions";

export default function Section2AddTertiary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const {
    data,
    ensureRemoteRecordId,
    addTertiaryQualification,
    updateTertiaryQualification,
  } = useApplication();
  const existing = useMemo(
    () => data.tertiaryQualifications.find((qualification) => qualification.id === id),
    [data.tertiaryQualifications, id],
  );
  const originalTranscriptDocument = existing?.transcriptDocument;
  const originalCertificateDocument = existing?.certificateDocument;

  const [formData, setFormData] = useState({
    id: existing?.id ?? crypto.randomUUID(),
    institution: existing?.institution ?? "",
    country: existing?.country ?? "Australia",
    level: existing?.level ?? "",
    courseName: existing?.courseName ?? "",
    startMonth: existing?.startMonth ?? "",
    startYear: existing?.startYear ?? "",
    completed: existing?.completed ?? true,
    endMonth: existing?.endMonth ?? "",
    endYear: existing?.endYear ?? "",
    transcriptDocument: existing?.transcriptDocument,
    transcriptDocumentName: existing?.transcriptDocumentName,
    certificateDocument: existing?.certificateDocument,
    certificateDocumentName: existing?.certificateDocumentName,
  });
  const [selectedTranscriptFile, setSelectedTranscriptFile] = useState<File | null>(
    null,
  );
  const [selectedCertificateFile, setSelectedCertificateFile] =
    useState<File | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const hasTranscript =
    Boolean(selectedTranscriptFile) ||
    Boolean(formData.transcriptDocument) ||
    Boolean(formData.transcriptDocumentName);
  const hasCertificate =
    Boolean(selectedCertificateFile) ||
    Boolean(formData.certificateDocument) ||
    Boolean(formData.certificateDocumentName);

  const missingRequiredFields = [
    !formData.institution.trim() && "Institution Name",
    !formData.country && "Country",
    !formData.level && "Qualification Level",
    !formData.courseName.trim() && "Course Name",
    (!formData.startMonth || !formData.startYear) && "Start date",
    (!formData.endMonth || !formData.endYear) && "End date",
  ].filter(Boolean) as string[];

  const saveRecord = async () => {
    const transcriptRemoved =
      !selectedTranscriptFile &&
      !formData.transcriptDocument &&
      Boolean(originalTranscriptDocument);
    const certificateRemoved =
      !selectedCertificateFile &&
      !formData.certificateDocument &&
      Boolean(originalCertificateDocument);

    let transcriptDocument = formData.transcriptDocument;
    let certificateDocument = formData.certificateDocument;
    const applicationId = await ensureRemoteRecordId();

    if (selectedTranscriptFile) {
      transcriptDocument = await replaceStoredDocument(
        selectedTranscriptFile,
        originalTranscriptDocument,
        {
          applicationId,
          kind: "tertiary_transcript",
        },
      );
    } else if (transcriptRemoved && originalTranscriptDocument) {
      await deleteStoredDocument(originalTranscriptDocument);
      transcriptDocument = undefined;
    }

    if (selectedCertificateFile) {
      certificateDocument = await replaceStoredDocument(
        selectedCertificateFile,
        originalCertificateDocument,
        {
          applicationId,
          kind: "tertiary_certificate",
        },
      );
    } else if (certificateRemoved && originalCertificateDocument) {
      await deleteStoredDocument(originalCertificateDocument);
      certificateDocument = undefined;
    }

    const nextRecord = {
      ...formData,
      transcriptDocument,
      transcriptDocumentName:
        transcriptDocument?.name ?? formData.transcriptDocumentName,
      certificateDocument: formData.completed ? certificateDocument : undefined,
      certificateDocumentName: formData.completed
        ? certificateDocument?.name ?? formData.certificateDocumentName
        : undefined,
    };

    if (existing) {
      updateTertiaryQualification(existing.id, nextRecord);
    } else {
      addTertiaryQualification(nextRecord);
    }
  };

  return (
    <div className="overflow-x-hidden bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add the details of your university degree or diploma."
          progress={66}
          sectionLabel="Section 2 of 3"
          title={existing ? "Edit Tertiary Qualification" : "Add Tertiary Qualification"}
        />

        <div className="space-y-6">
          <FormSectionCard
            description="Where did you study?"
            icon={<Building2 className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
            title="Institution Details"
          >
            <div className="space-y-5">
              <div>
                <Label>Institution Name <span className="text-red-500">*</span></Label>
                <Input
                  className="h-12 text-base"
                  placeholder="Enter institution name"
                  value={formData.institution}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      institution: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Country <span className="text-red-500">*</span></Label>
                <NativeSelect
                  className="h-12 text-base"
                  value={formData.country}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      country: event.target.value,
                    }))
                  }
                >
                  <option value="">Select country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </FormSectionCard>

          <FormSectionCard
            description="What did you study?"
            icon={<GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
            title="Qualification Details"
          >
            <div className="space-y-5">
              <div>
                <Label>Qualification Level <span className="text-red-500">*</span></Label>
                <NativeSelect
                  value={formData.level}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      level: event.target.value,
                    }))
                  }
                >
                  <option value="">Select level</option>
                  <option value="Bachelor">Bachelor Degree</option>
                  <option value="Honours">Honours Degree</option>
                  <option value="Graduate Certificate">Graduate Certificate</option>
                  <option value="Graduate Diploma">Graduate Diploma</option>
                  <option value="Masters">Masters Degree</option>
                  <option value="PhD">PhD/Doctorate</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Course Name <span className="text-red-500">*</span></Label>
                <Input
                  className="h-12 text-base"
                  placeholder="e.g. Bachelor of Science"
                  value={formData.courseName}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      courseName: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </FormSectionCard>

          <FormSectionCard
            description="When did you study?"
            icon={<Calendar className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
            title="Study Period"
          >
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Start date <span className="text-red-500">*</span></Label>
                  <MonthYearPickerField
                    description="Choose the month and year you started this qualification."
                    label="Start"
                    month={formData.startMonth}
                    months={months}
                    title="Select start date"
                    year={formData.startYear}
                    years={years}
                    onChange={(startMonth, startYear) =>
                      setFormData((previous) => ({
                        ...previous,
                        startMonth,
                        startYear,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    checked={formData.completed}
                    type="checkbox"
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        completed: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      I have completed this qualification
                    </span>
                    <span className="mt-1 block text-xs text-gray-600">
                      Check this if you've graduated or finished the course.
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid gap-5 animate-in fade-in duration-300 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>End date <span className="text-red-500">*</span></Label>
                  <MonthYearPickerField
                    description={
                      formData.completed
                        ? "Choose the month and year you completed this qualification."
                        : "Choose the month and year you stopped studying."
                    }
                    label="End"
                    month={formData.endMonth}
                    months={months}
                    title="Select end date"
                    year={formData.endYear}
                    years={years}
                    onChange={(endMonth, endYear) =>
                      setFormData((previous) => ({
                        ...previous,
                        endMonth,
                        endYear,
                      }))
                    }
                  />
                </div>
              </div>
              {showValidation && missingRequiredFields.includes("End date") ? (
                <p className="text-sm text-red-600">Select an end date.</p>
              ) : null}
            </div>
          </FormSectionCard>

          <FormSectionCard
            description="Attach supporting documents now or later before submit. PDF, DOC, DOCX or TXT, up to 5 MB."
            icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
            title="Supporting Documents"
          >
            <div className="space-y-5">
              <div>
                <FileUpload
                  attachedDescription="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
                  className={
                    hasTranscript
                      ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                      : "border-[var(--warning-border)] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] shadow-[0_18px_40px_rgba(122,90,0,0.08)]"
                  }
                  description="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
                  fileName={
                    selectedTranscriptFile?.name ||
                    formData.transcriptDocument?.name ||
                    formData.transcriptDocumentName
                  }
                  fileSize={
                    selectedTranscriptFile?.size || formData.transcriptDocument?.size
                  }
                  helperText=""
                  label="Academic Transcript"
                  onRemove={
                    selectedTranscriptFile || formData.transcriptDocument
                      ? () => {
                          if (selectedTranscriptFile) {
                            setSelectedTranscriptFile(null);
                            return;
                          }

                          setFormData((previous) => ({
                            ...previous,
                            transcriptDocument: undefined,
                            transcriptDocumentName: undefined,
                          }));
                        }
                      : undefined
                  }
                  onView={
                    selectedTranscriptFile
                      ? () => {
                          viewLocalDocument(selectedTranscriptFile);
                        }
                      : formData.transcriptDocument
                        ? () => {
                            void viewStoredDocument(formData.transcriptDocument);
                          }
                        : undefined
                  }
                  onFileSelect={(file) => setSelectedTranscriptFile(file)}
                  required={!hasTranscript}
                />
                <div className="mt-3 flex items-center gap-2">
                  {hasTranscript ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" />
                      <p className="text-sm font-medium text-[var(--success-text)]">
                        Transcript attached
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-[var(--warning-text)]" />
                      <p className="text-sm font-medium text-[var(--warning-text)]">
                        Transcript required before submit
                      </p>
                    </>
                  )}
                </div>
              </div>

              {formData.completed ? (
                <div className="animate-in fade-in duration-300">
                  <FileUpload
                    attachedDescription="Your certificate of completion confirms that you finished and were awarded this qualification."
                    className={
                      hasCertificate
                        ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                        : "border-[var(--warning-border)] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] shadow-[0_18px_40px_rgba(122,90,0,0.08)]"
                    }
                    description="Your certificate of completion confirms that you finished and were awarded this qualification."
                    fileName={
                      selectedCertificateFile?.name ||
                      formData.certificateDocument?.name ||
                      formData.certificateDocumentName
                    }
                    fileSize={
                      selectedCertificateFile?.size ||
                      formData.certificateDocument?.size
                    }
                    helperText=""
                    label="Certificate of Completion"
                    onRemove={
                      selectedCertificateFile || formData.certificateDocument
                        ? () => {
                            if (selectedCertificateFile) {
                              setSelectedCertificateFile(null);
                              return;
                            }

                            setFormData((previous) => ({
                              ...previous,
                              certificateDocument: undefined,
                              certificateDocumentName: undefined,
                            }));
                          }
                        : undefined
                    }
                    onView={
                      selectedCertificateFile
                        ? () => {
                            viewLocalDocument(selectedCertificateFile);
                          }
                        : formData.certificateDocument
                          ? () => {
                              void viewStoredDocument(formData.certificateDocument);
                            }
                          : undefined
                    }
                    onFileSelect={(file) => setSelectedCertificateFile(file)}
                    required={!hasCertificate}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    {hasCertificate ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" />
                        <p className="text-sm font-medium text-[var(--success-text)]">
                          Certificate of completion attached
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-[var(--warning-text)]" />
                        <p className="text-sm font-medium text-[var(--warning-text)]">
                          Certificate required before submit
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </FormSectionCard>
        </div>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={() => navigate(returnPath("/section2/qualifications"))}
          onPrimary={async () => {
            setShowValidation(true);

            if (missingRequiredFields.length > 0) {
              return;
            }

            await saveRecord();
            navigate(returnPath("/section2/qualifications"));
          }}
        />
      </div>
    </div>
  );
}
