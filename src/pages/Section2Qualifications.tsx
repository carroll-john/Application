import {
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  Languages,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  QualificationsAttachment,
  QualificationsListItem,
  QualificationsSectionCard,
  Section2QualificationsPage,
  Section2SaveProgressPanel,
  useSection2QualificationsFlow,
} from "../features/section2";
import { usePendingTranscriptEligibility } from "../features/section2/usePendingTranscriptEligibility";
import { EligibilityRowFeedback } from "../features/section2/EligibilityRowFeedback";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { getCourseByCode } from "../lib/courseCatalog";
import {
  buildProgramEvidenceRows,
  filterResolvedTranscriptMissingInformation,
  shouldShowTranscriptRecommendedNextStep,
} from "../lib/eligibility/programEvidence";
import type {
  EligibilityOutcome,
  TranscriptEligibilityAssessment,
} from "../lib/eligibility/types";
import {
  eligibilityOutcomeCopy,
  programEvidenceAdvisoryCopy,
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

function buildAssessmentEvidenceRows(assessment: TranscriptEligibilityAssessment) {
  const wam = readEvidenceValue(assessment, "academicPerformance", "gradeAverageOrWam");
  const gpa = readEvidenceValue(assessment, "academicPerformance", "gpa");
  const gpaScale = readEvidenceValue(assessment, "academicPerformance", "gpaScale");
  const completion = readEvidenceValue(assessment, "studyDetails", "completionStatus");
  const rows: Array<{
    explanation: string;
    id: string;
    sourceText: string;
  }> = [];

  if (completion) {
    rows.push({
      explanation: `Completion status: ${completion}.`,
      id: "completion-status",
      sourceText: "Qualification completion from transcript",
    });
  }

  const academicResults = [
    wam ? `WAM: ${wam}` : null,
    gpa ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : null,
  ].filter(Boolean);

  if (academicResults.length > 0) {
    rows.push({
      explanation: academicResults.join(" · "),
      id: "academic-result",
      sourceText: "Academic result from transcript",
    });
  }

  return rows;
}

function EvidenceReviewRow({
  action,
  explanation,
  heading,
}: {
  action?: ReactNode;
  explanation: string;
  heading: string;
}) {
  return (
    <li className="rounded-md border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-900 sm:text-sm">{heading}</p>
      <p className="mt-1 text-xs text-gray-700 sm:text-sm">{explanation}</p>
      {action}
    </li>
  );
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
    updateTertiaryQualification,
  } = useApplication();
  const {
    handleSaveAndContinue,
    handleSaveAndExit,
    handleSkipSection,
    isSaving,
    sectionStates,
    setStatusMessage,
    statusMessage,
  } = useSection2QualificationsFlow({ data });
  const { eligibilityProgress, isProcessingEligibility } =
    usePendingTranscriptEligibility({
      applicationData: data,
      setStatusMessage,
      updateTertiaryQualification,
    });
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
  const programEvidenceRows = buildProgramEvidenceRows({
    applicationData: data,
    course: selectedCourseEntry,
    transcriptAssessment: latestTranscriptAssessment,
  });
  const assessmentEvidenceRows = latestTranscriptAssessment
    ? buildAssessmentEvidenceRows(latestTranscriptAssessment)
    : [];
  const blockingProgramEvidenceRows = programEvidenceRows.filter((row) => row.isBlocking);
  const transcriptFeedbackRows = latestTranscriptAssessment
    ? programEvidenceRows.filter((row) => row.requirementStatus)
    : [];
  const visibleMissingInformation = latestTranscriptAssessment
    ? filterResolvedTranscriptMissingInformation(
        latestTranscriptAssessment.missingInformation,
        programEvidenceRows,
      )
    : [];
  const showRecommendedNextStep = latestTranscriptAssessment
    ? shouldShowTranscriptRecommendedNextStep(
        latestTranscriptAssessment.recommendedNextStep,
        visibleMissingInformation,
        programEvidenceRows,
      )
    : false;
  const programEvidenceSummary =
    blockingProgramEvidenceRows.length === 0
      ? "Evidence ready"
      : `${blockingProgramEvidenceRows.length} item${
          blockingProgramEvidenceRows.length === 1 ? "" : "s"
        } to add`;

  function section2AddPath(key: Parameters<typeof getSection2Step>[0]) {
    const step = getSection2Step(key);
    return `${step.addPath ?? ""}${reviewSuffix}`;
  }

  return (
    <Section2QualificationsPage
      continueDisabled={isSaving || isProcessingEligibility}
      continueLabel={
        isSaving
          ? fromReview
            ? "Opening Review..."
            : "Saving & Continuing..."
          : isProcessingEligibility
            ? "Reviewing evidence..."
            : fromReview
              ? "Return to Review"
              : "Save & Continue"
      }
      onContinue={() => void handleSaveAndContinue()}
      onPrevious={() => navigate(returnPath("/section1/family-support"))}
      onSaveAndExit={fromReview ? undefined : () => void handleSaveAndExit()}
      previousDisabled={isSaving || isProcessingEligibility}
      previousLabel={previousLabel}
      secondaryDisabled={isSaving || isProcessingEligibility}
      secondaryLabel={fromReview ? undefined : isSaving ? "Saving..." : "Save & Exit"}
    >
      {statusMessage ? (
        <div className="mb-6 sm:mb-8">
          <StatusMessage
            message={statusMessage.message}
            onDismiss={() => setStatusMessage(null)}
            type={statusMessage.type}
          />
        </div>
      ) : null}

      {eligibilityProgress ? (
        <div className="mb-6 sm:mb-8">
          <Section2SaveProgressPanel
            detail={eligibilityProgress.detail}
            title={eligibilityProgress.title}
          />
        </div>
      ) : null}

      {programEvidenceRows.length > 0 ? (
        <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4 sm:mb-8 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
              Eligibility Supporting Documentation
            </h2>
            <p
              className={`text-xs font-semibold sm:text-sm ${
                blockingProgramEvidenceRows.length === 0
                  ? "text-[var(--success-text)]"
                  : "text-[var(--warning-text)]"
              }`}
            >
              {programEvidenceSummary}
            </p>
          </div>
          {latestTranscriptAssessment ? (
            <p
              className={`mt-1 text-xs font-medium sm:text-sm ${getEligibilityOutcomeTone(
                latestTranscriptAssessment.outcome,
              )}`}
            >
              Transcript extraction: {eligibilityOutcomeCopy[latestTranscriptAssessment.outcome]} ·
              Confidence: {Math.round(latestTranscriptAssessment.confidence * 100)}%
            </p>
          ) : null}
          {showParsedTranscriptIntro ? (
            <p className="mt-2 text-xs text-gray-700 sm:text-sm">
              Based on your uploaded transcript
              {selectedCourseTitle ? ` for ${selectedCourseTitle}` : ""}. Review the
              qualification we drafted and add any missing program evidence below.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-gray-600 sm:text-sm">
            {programEvidenceAdvisoryCopy}
          </p>
          {assessmentEvidenceRows.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Transcript evidence extracted">
              {assessmentEvidenceRows.map((row) => (
                <EvidenceReviewRow
                  key={row.id}
                  explanation={row.explanation}
                  heading={row.sourceText}
                />
              ))}
            </ul>
          ) : null}
          {programEvidenceRows.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Program evidence requirements">
              {programEvidenceRows.map((row) => (
                <EvidenceReviewRow
                  key={row.id}
                  action={
                    row.actionPath && row.actionLabel ? (
                      <button
                        className="mt-2 text-xs font-semibold text-[var(--cta-secondary)] underline-offset-2 hover:underline sm:text-sm"
                        type="button"
                        onClick={() => navigate(row.actionPath!)}
                      >
                        {row.actionLabel}
                      </button>
                    ) : null
                  }
                  explanation={row.explanation}
                  heading={row.heading}
                />
              ))}
            </ul>
          ) : null}
          {latestTranscriptAssessment && transcriptFeedbackRows.length > 0 ? (
            <div className="mt-3 space-y-2" aria-label="Transcript feedback">
              {transcriptFeedbackRows.map((row) =>
                row.requirementStatus ? (
                  <EligibilityRowFeedback
                    key={row.requirementId}
                    requirementId={row.requirementId}
                    requirementSourceText={row.sourceText}
                    originalStatus={row.requirementStatus}
                    courseCode={data.applicationMeta?.selectedCourse?.code}
                    courseTitle={data.applicationMeta?.selectedCourse?.title}
                    rulesVersion={latestTranscriptAssessment.rulesVersion}
                    serviceVersion={latestTranscriptAssessment.serviceVersion}
                  />
                ) : null,
              )}
            </div>
          ) : null}
          {visibleMissingInformation.length > 0 ? (
            <div className="mt-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
              <p className="text-xs font-semibold text-[var(--warning-text)] sm:text-sm">
                Missing or unclear information
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--warning-text)] sm:text-sm">
                {visibleMissingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {latestTranscriptAssessment && showRecommendedNextStep ? (
            <p className="mt-3 text-xs text-gray-700 sm:text-sm">
              Recommended next step: {latestTranscriptAssessment.recommendedNextStep}
            </p>
          ) : null}
          {latestTranscriptAssessment?.manualReviewRequired ? (
            <p className="mt-2 text-xs font-medium text-[var(--warning-text)] sm:text-sm">
              Manual admissions review is required for one or more evidence checks.
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
