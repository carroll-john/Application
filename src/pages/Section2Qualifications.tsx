import {
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  Languages,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  QualificationsAttachment,
  QualificationsListItem,
  QualificationsSectionCard,
  Section2QualificationsPage,
  useSection2QualificationsFlow,
} from "../features/section2";
import { EligibilityRowFeedback } from "../features/section2/EligibilityRowFeedback";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { getCourseByCode } from "../lib/courseCatalog";
import { buildEligibilityDisplayRows } from "../lib/eligibility/displayRows";
import type {
  EligibilityOutcome,
  TranscriptEligibilityAssessment,
} from "../lib/eligibility/types";
import {
  eligibilityOutcomeCopy,
  eligibilityAdvisoryCopy,
  eligibilityRequirementStatusCopy,
} from "../lib/eligibility/uiCopy";
import { getSection2EditPath, getSection2Step } from "../lib/section2Steps";

function getEligibilityOutcomeTone(outcome: EligibilityOutcome) {
  if (outcome === "eligible") {
    return "text-[var(--success-text)]";
  }

  if (outcome === "ineligible") {
    return "text-[var(--warning-text)]";
  }

  return "text-[var(--info-text)]";
}

function getLatestTranscriptAssessment(
  assessments: Array<TranscriptEligibilityAssessment | undefined>,
) {
  const available = assessments.filter(Boolean) as TranscriptEligibilityAssessment[];
  if (available.length === 0) {
    return undefined;
  }

  return [...available].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

function readEvidenceValue(
  assessment: TranscriptEligibilityAssessment,
  group: keyof TranscriptEligibilityAssessment["extractedData"],
  field: string,
) {
  const source = assessment.extractedData[group] as Record<string, unknown> | undefined;
  if (!source) {
    return undefined;
  }

  const item = source[field] as
    | { normalizedValue?: string; originalValue?: string }
    | undefined;
  if (!item || typeof item !== "object") {
    return undefined;
  }

  return item.normalizedValue ?? item.originalValue;
}

function buildAssessmentEvidenceSummary(assessment: TranscriptEligibilityAssessment) {
  const wam = readEvidenceValue(assessment, "academicPerformance", "gradeAverageOrWam");
  const gpa = readEvidenceValue(assessment, "academicPerformance", "gpa");
  const gpaScale = readEvidenceValue(assessment, "academicPerformance", "gpaScale");
  const completion = readEvidenceValue(assessment, "studyDetails", "completionStatus");

  const parts: string[] = [];
  if (completion) {
    parts.push(`Completion: ${completion}`);
  }
  if (wam) {
    parts.push(`WAM: ${wam}`);
  }
  if (gpa) {
    parts.push(`GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}`);
  }
  return parts.join(" · ");
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
  const {
    handleSaveAndContinue,
    handleSaveAndExit,
    handleSkipSection,
    isSaving,
    meetsSection2MinimumRequirement,
    section2WarningCopy,
    sectionStates,
    setStatusMessage,
    statusMessage,
  } = useSection2QualificationsFlow({ data });
  const latestTranscriptAssessment = getLatestTranscriptAssessment(
    data.tertiaryQualifications.map((qualification) => qualification.transcriptEligibility),
  );
  const selectedCourseEntry = getCourseByCode(data.applicationMeta?.selectedCourse?.code);
  const selectedCourseTitle =
    data.applicationMeta?.selectedCourse?.title ?? selectedCourseEntry?.title;
  const showParsedTranscriptIntro =
    statusMessage?.type === "success" &&
    statusMessage.message.toLowerCase().includes("qualification") &&
    statusMessage.message.toLowerCase().includes("transcript");
  const eligibilityDisplayRows = latestTranscriptAssessment
    ? buildEligibilityDisplayRows(
        selectedCourseEntry?.requirements,
        latestTranscriptAssessment.requirementsChecked,
      )
    : [];

  function section2AddPath(key: Parameters<typeof getSection2Step>[0]) {
    const step = getSection2Step(key);
    return `${step.addPath ?? ""}${reviewSuffix}`;
  }

  return (
    <Section2QualificationsPage
      continueDisabled={isSaving}
      continueLabel={
        isSaving
          ? fromReview
            ? "Opening Review..."
            : "Saving & Continuing..."
          : fromReview
            ? "Return to Review"
            : "Save & Continue"
      }
      onContinue={() => void handleSaveAndContinue()}
      onPrevious={() => navigate(returnPath("/section1/family-support"))}
      onSaveAndExit={fromReview ? undefined : () => void handleSaveAndExit()}
      previousDisabled={isSaving}
      previousLabel={previousLabel}
      secondaryDisabled={isSaving}
      secondaryLabel={fromReview ? undefined : isSaving ? "Saving..." : "Save & Exit"}
    >
      <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3 sm:mb-8">
        <p className="text-xs text-[var(--info-text)] sm:text-sm">
          <strong>Tip:</strong> Complete as much as you can now. Skip any section that
          doesn&apos;t apply and come back later if needed.
        </p>
        {!meetsSection2MinimumRequirement ? (
          <p className="mt-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning-text)] sm:text-sm">
            <strong>Before submit:</strong> {section2WarningCopy}
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

      {latestTranscriptAssessment ? (
        <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4 sm:mb-8 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
              Transcript eligibility check
            </h2>
            <p
              className={`text-xs font-semibold sm:text-sm ${getEligibilityOutcomeTone(
                latestTranscriptAssessment.outcome,
              )}`}
            >
              {eligibilityOutcomeCopy[latestTranscriptAssessment.outcome]}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-600 sm:text-sm">
            Confidence: {Math.round(latestTranscriptAssessment.confidence * 100)}%
          </p>
          {showParsedTranscriptIntro ? (
            <p className="mt-2 text-xs text-gray-700 sm:text-sm">
              Based on your uploaded transcript
              {selectedCourseTitle ? ` for ${selectedCourseTitle}` : ""}. Review the
              qualification we drafted and check your eligibility results below.
            </p>
          ) : null}
          {buildAssessmentEvidenceSummary(latestTranscriptAssessment) ? (
            <p className="mt-1 text-xs text-gray-700 sm:text-sm">
              Evidence: {buildAssessmentEvidenceSummary(latestTranscriptAssessment)}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-gray-600 sm:text-sm">{eligibilityAdvisoryCopy}</p>
          {eligibilityDisplayRows.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Eligibility requirements">
              {eligibilityDisplayRows.map((row) => (
                <li key={row.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                      {row.sourceText}
                    </p>
                    <p
                      className={`text-xs font-semibold sm:text-sm ${
                        row.status === "pass"
                          ? "text-[var(--success-text)]"
                          : row.status === "fail"
                            ? "text-[var(--warning-text)]"
                            : "text-[var(--info-text)]"
                      }`}
                    >
                      {eligibilityRequirementStatusCopy[row.status]}
                    </p>
                  </div>
                  {row.kindLabel ? (
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500 sm:text-xs">
                      {row.kindLabel}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-700 sm:text-sm">{row.explanation}</p>
                  <EligibilityRowFeedback
                    requirementId={row.id}
                    requirementSourceText={row.sourceText}
                    originalStatus={row.status}
                    courseCode={data.applicationMeta?.selectedCourse?.code}
                    courseTitle={data.applicationMeta?.selectedCourse?.title}
                    rulesVersion={latestTranscriptAssessment.rulesVersion}
                    serviceVersion={latestTranscriptAssessment.serviceVersion}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {latestTranscriptAssessment.missingInformation.length > 0 ? (
            <div className="mt-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
              <p className="text-xs font-semibold text-[var(--warning-text)] sm:text-sm">
                Missing or unclear information
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--warning-text)] sm:text-sm">
                {latestTranscriptAssessment.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-gray-700 sm:text-sm">
            Recommended next step: {latestTranscriptAssessment.recommendedNextStep}
          </p>
          {latestTranscriptAssessment.manualReviewRequired ? (
            <p className="mt-2 text-xs font-medium text-[var(--warning-text)] sm:text-sm">
              Manual admissions review is required for one or more checks.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-6">
        <QualificationsSectionCard
          actionRoute={section2AddPath("tertiary")}
          description="Add your university degrees and diplomas"
          emptyMessage="No qualifications added yet"
          icon={
            <GraduationCap className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />
          }
          items={data.tertiaryQualifications}
          onSkip={() => handleSkipSection("tertiary")}
          renderItem={(qualification) => (
            <QualificationsListItem
              key={qualification.id}
              subtitle={
                qualification.transcriptEligibility
                  ? `${qualification.institution || "Institution pending"} · ${eligibilityOutcomeCopy[qualification.transcriptEligibility.outcome]}${buildAssessmentEvidenceSummary(
                      qualification.transcriptEligibility,
                    )
                      ? ` · ${buildAssessmentEvidenceSummary(qualification.transcriptEligibility)}`
                      : ""}`
                  : qualification.institution || "Complete qualification details"
              }
              title={qualification.courseName || "Tertiary Qualification"}
              attachments={[
                qualification.transcriptDocumentName,
                qualification.certificateDocumentName,
              ].filter(Boolean) as string[]}
              onDelete={() => removeTertiaryQualification(qualification.id)}
              onEdit={() =>
                navigate(`${getSection2EditPath("tertiary", qualification.id)}${reviewSuffix}`)
              }
            />
          )}
          status={sectionStates.tertiary}
          title="Tertiary Qualifications"
        />

        <QualificationsSectionCard
          actionRoute={section2AddPath("cv")}
          actionText={data.cvUploaded ? "Replace" : "Add"}
          description="Add your current CV or resume"
          emptyMessage="No CV uploaded yet"
          icon={
            <FileText className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />
          }
          items={data.cvUploaded ? [{ id: "cv", name: data.cvFileName ?? "" }] : []}
          onSkip={() => handleSkipSection("cv")}
          renderItem={(item) => (
            <div
              key={item.id}
              className="rounded border border-gray-200 bg-white p-3 sm:p-4"
            >
              <QualificationsAttachment fileName={item.name} />
            </div>
          )}
          status={sectionStates.cv}
          title="Curriculum Vitae (CV)"
        />

        <QualificationsSectionCard
          actionRoute={section2AddPath("employment")}
          description="Add your work history and experience"
          emptyMessage="No employment experience added yet"
          icon={
            <Briefcase className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />
          }
          items={data.employmentExperiences}
          onSkip={() => handleSkipSection("employment")}
          renderItem={(experience) => (
            <QualificationsListItem
              key={experience.id}
              subtitle={experience.company}
              title={experience.position || "Position"}
              onDelete={() => removeEmploymentExperience(experience.id)}
              onEdit={() =>
                navigate(
                  `${getSection2EditPath("employment", experience.id)}${reviewSuffix}`,
                )
              }
            />
          )}
          status={sectionStates.employment}
          title="Employment Experience"
        />

        <QualificationsSectionCard
          actionRoute={section2AddPath("accreditation")}
          description="Add certifications and professional memberships"
          emptyMessage="No accreditations added yet"
          icon={<Award className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />}
          items={data.professionalAccreditations}
          onSkip={() => handleSkipSection("accreditation")}
          renderItem={(accreditation) => (
            <QualificationsListItem
              key={accreditation.id}
              subtitle={accreditation.status}
              title={accreditation.name || "Accreditation"}
              attachment={accreditation.documentName}
              onDelete={() => removeProfessionalAccreditation(accreditation.id)}
              onEdit={() =>
                navigate(
                  `${getSection2EditPath("accreditation", accreditation.id)}${reviewSuffix}`,
                )
              }
            />
          )}
          status={sectionStates.accreditation}
          title="Professional Accreditations"
        />

        <QualificationsSectionCard
          actionRoute={section2AddPath("secondary")}
          description="Add your high school education details"
          emptyMessage="No secondary qualifications added yet"
          icon={
            <GraduationCap className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />
          }
          items={data.secondaryQualifications}
          onSkip={() => handleSkipSection("secondary")}
          renderItem={(qualification) => (
            <QualificationsListItem
              key={qualification.id}
              subtitle={qualification.school}
              title={qualification.qualification || "Secondary Qualification"}
              onDelete={() => removeSecondaryQualification(qualification.id)}
              onEdit={() =>
                navigate(
                  `${getSection2EditPath("secondary", qualification.id)}${reviewSuffix}`,
                )
              }
            />
          )}
          status={sectionStates.secondary}
          title="Secondary Qualifications"
        />

        <QualificationsSectionCard
          actionRoute={section2AddPath("language-test")}
          description="Add IELTS, TOEFL, or other English test results"
          emptyMessage="No language tests added yet"
          icon={
            <Languages className="h-5 w-5 shrink-0 text-[var(--cta-secondary)] sm:h-6 sm:w-6" />
          }
          items={data.languageTests}
          onSkip={() => handleSkipSection("languageTest")}
          renderItem={(test) => (
            <QualificationsListItem
              key={test.id}
              subtitle={`${test.type} - ${test.year}`}
              title={test.name || "Language Test"}
              attachment={test.documentName}
              onDelete={() => removeLanguageTest(test.id)}
              onEdit={() =>
                navigate(`${getSection2EditPath("language-test", test.id)}${reviewSuffix}`)
              }
            />
          )}
          status={sectionStates.languageTest}
          title="English Language Proficiency"
        />
      </div>
    </Section2QualificationsPage>
  );
}
