import {
  Building2,
  Calendar,
  FileText,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { DocumentUploadField } from "../components/DocumentUploadField";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { MonthYearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { InstitutionAutocomplete } from "../components/ui/institution-autocomplete";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useSection2Navigation } from "../hooks/useSection2Navigation";
import { saveDocumentAttachment } from "../lib/documentAttachment";
import { getDocumentUploadErrorMessage } from "../lib/documentStorage";
import { countries, months, years } from "../lib/formOptions";
import { isMonthYearRangeOutOfOrder } from "../lib/monthYearValidation";

export default function Section2AddTertiary() {
  const { returnToQualifications } = useSection2Navigation();
  const {
    data,
    ensureRemoteRecordId,
    addTertiaryQualification,
    updateTertiaryQualification,
  } = useApplication();
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.tertiaryQualifications,
    () => ({
      id: crypto.randomUUID(),
      institution: "",
      country: "Australia",
      level: "",
      courseName: "",
      startMonth: "",
      startYear: "",
      completed: true,
      endMonth: "",
      endYear: "",
      transcriptDocument: undefined,
      transcriptDocumentName: undefined,
      certificateDocument: undefined,
      certificateDocumentName: undefined,
    }),
  );
  const originalTranscriptDocument = existing?.transcriptDocument;
  const originalCertificateDocument = existing?.certificateDocument;

  const [formData, setFormData] = useState(initialRecord);
  const [selectedTranscriptFile, setSelectedTranscriptFile] = useState<File | null>(
    null,
  );
  const [selectedCertificateFile, setSelectedCertificateFile] =
    useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "status";
  } | null>(null);
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
  const dateRangeError = isMonthYearRangeOutOfOrder(
    formData.startMonth,
    formData.startYear,
    formData.endMonth,
    formData.endYear,
  )
    ? "Start date must be before or the same as end date."
    : null;

  const saveRecord = async () => {
    const transcriptRemoved =
      !selectedTranscriptFile &&
      !formData.transcriptDocument &&
      Boolean(originalTranscriptDocument);
    const certificateRemoved =
      !selectedCertificateFile &&
      !formData.certificateDocument &&
      Boolean(originalCertificateDocument);

    const applicationId = await ensureRemoteRecordId();
    const transcriptDocument = await saveDocumentAttachment({
      applicationId,
      currentDocument: transcriptRemoved ? undefined : formData.transcriptDocument,
      kind: "tertiary_transcript",
      originalDocument: originalTranscriptDocument,
      selectedFile: selectedTranscriptFile,
    });
    const certificateDocument = await saveDocumentAttachment({
      applicationId,
      currentDocument: certificateRemoved ? undefined : formData.certificateDocument,
      kind: "tertiary_certificate",
      originalDocument: originalCertificateDocument,
      selectedFile: selectedCertificateFile,
    });

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
          title={isEditing ? "Edit Tertiary Qualification" : "Add Tertiary Qualification"}
        />

        {statusMessage ? (
          <div className="mt-4">
            <StatusMessage
              message={statusMessage.message}
              type={statusMessage.type}
              onDismiss={() => setStatusMessage(null)}
            />
          </div>
        ) : null}

        <div className="space-y-6">
          <FormSectionCard
            description="Where did you study?"
            icon={<Building2 className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Institution Details"
          >
            <div className="space-y-5">
              <div>
                <Label>Institution Name <span className="text-red-500">*</span></Label>
                <InstitutionAutocomplete
                  className="h-12 text-base"
                  placeholder="Start typing institution name"
                  value={formData.institution}
                  onValueChange={(institution) =>
                    setFormData((previous) => ({
                      ...previous,
                      institution,
                    }))
                  }
                />
                <p className="mt-2 text-xs text-slate-500">
                  Suggestions help keep institution names consistent. If yours
                  is not listed, keep typing to enter it manually.
                </p>
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
            icon={<GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
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
                  <option value="Associate Degree">Associate Degree</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Advanced Diploma">Advanced Diploma</option>
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
            icon={<Calendar className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
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
              {showValidation && dateRangeError ? (
                <p className="text-sm text-red-600">{dateRangeError}</p>
              ) : null}
            </div>
          </FormSectionCard>

          <FormSectionCard
            description="Attach supporting documents now or later before submit. PDF, DOC, DOCX or TXT, up to 5 MB."
            icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Supporting Documents"
          >
            <div className="space-y-5">
              <DocumentUploadField
                attachedDescription="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
                attachedStatus="Transcript attached"
                description="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
                document={formData.transcriptDocument}
                documentName={formData.transcriptDocumentName}
                label="Academic Transcript"
                missingStatus="Transcript required before submit"
                missingTone="warning"
                onClearDocument={() =>
                  setFormData((previous) => ({
                    ...previous,
                    transcriptDocument: undefined,
                    transcriptDocumentName: undefined,
                  }))
                }
                onClearSelectedFile={() => setSelectedTranscriptFile(null)}
                onFileSelect={setSelectedTranscriptFile}
                required={!hasTranscript}
                selectedFile={selectedTranscriptFile}
                showStatusIcon
              />

              {formData.completed ? (
                <div className="animate-in fade-in duration-300">
                  <DocumentUploadField
                    attachedDescription="Your certificate of completion confirms that you finished and were awarded this qualification."
                    attachedStatus="Certificate of completion attached"
                    description="Your certificate of completion confirms that you finished and were awarded this qualification."
                    document={formData.certificateDocument}
                    documentName={formData.certificateDocumentName}
                    label="Certificate of Completion"
                    missingStatus="Certificate required before submit"
                    missingTone="warning"
                    onClearDocument={() =>
                      setFormData((previous) => ({
                        ...previous,
                        certificateDocument: undefined,
                        certificateDocumentName: undefined,
                      }))
                    }
                    onClearSelectedFile={() => setSelectedCertificateFile(null)}
                    onFileSelect={setSelectedCertificateFile}
                    required={!hasCertificate}
                    selectedFile={selectedCertificateFile}
                    showStatusIcon
                  />
                </div>
              ) : null}
            </div>
          </FormSectionCard>
        </div>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={returnToQualifications}
          onPrimary={async () => {
            setShowValidation(true);
            setStatusMessage(null);

            if (missingRequiredFields.length > 0 || dateRangeError) {
              return;
            }

            try {
              await saveRecord();
              returnToQualifications();
            } catch (error) {
              setStatusMessage({
                message:
                  getDocumentUploadErrorMessage(error) ??
                  "We couldn't save this qualification right now. Please try again.",
                type: "error",
              });
            }
          }}
        />
      </div>
    </div>
  );
}
