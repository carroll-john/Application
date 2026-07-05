import {
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  Languages,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import {
  QualificationsAttachment,
  QualificationsListItem,
  QualificationsSectionCard,
  Section2EvidenceNextStepPanel,
  Section2QualificationsPage,
  Section2SaveProgressPanel,
  useSection2QualificationsFlow,
} from "../features/section2";
import {
  buildAssessmentEvidenceSummary,
  getLatestTranscriptAssessment,
  SupportingEvidencePanel,
} from "../features/section2/SupportingEvidencePanel";
import type { Section2EvidenceSectionKey } from "../features/section2/section2EvidencePlan";
import { usePendingTranscriptEligibility } from "../features/section2/usePendingTranscriptEligibility";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { getCourseByCode } from "../lib/courseCatalog";
import {
  buildProgramEvidenceRows,
  dedupeProgramEvidenceRowsByHeading,
  groupTranscriptVerifiableEvidenceRows,
} from "../lib/eligibility/programEvidence";
import { eligibilityOutcomeCopy } from "../lib/eligibility/uiCopy";
import { getSection2EditPath, getSection2Step } from "../lib/section2Steps";

const addMoreSections: Array<{
  key: Section2EvidenceSectionKey;
  label: string;
  stepKey: Parameters<typeof getSection2Step>[0];
}> = [
  { key: "tertiary", label: "Tertiary qualification", stepKey: "tertiary" },
  { key: "cv", label: "CV", stepKey: "cv" },
  { key: "employment", label: "Employment experience", stepKey: "employment" },
  { key: "accreditation", label: "Professional accreditation", stepKey: "accreditation" },
  { key: "secondary", label: "Secondary qualification", stepKey: "secondary" },
  { key: "languageTest", label: "English language test", stepKey: "language-test" },
];

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
  const latestTranscriptAssessment = getLatestTranscriptAssessment(
    data.tertiaryQualifications.map((qualification) => qualification.transcriptEligibility),
  );
  const selectedCourseEntry = getCourseByCode(data.applicationMeta?.selectedCourse?.code);
  const selectedCourseTitle =
    data.applicationMeta?.selectedCourse?.title ?? selectedCourseEntry?.title;
  const programEvidenceRows = buildProgramEvidenceRows({
    applicationData: data,
    course: selectedCourseEntry,
    transcriptAssessment: latestTranscriptAssessment,
  });
  const displayProgramEvidenceRows = dedupeProgramEvidenceRowsByHeading(
    groupTranscriptVerifiableEvidenceRows(programEvidenceRows),
  );
  const {
    evidencePlan,
    handleSaveAndContinue,
    handleSaveAndExit,
    handleSkipSection,
    handleUnskipSection,
    isSaving,
    sectionStates,
    setStatusMessage,
    statusMessage,
  } = useSection2QualificationsFlow({
    data,
    groupedEvidenceRows: displayProgramEvidenceRows,
    hasPublishedRequirements: programEvidenceRows.length > 0,
  });
  const { eligibilityProgress, isProcessingEligibility } =
    usePendingTranscriptEligibility({
      applicationData: data,
      setStatusMessage,
      updateTertiaryQualification,
    });
  const showParsedTranscriptIntro = Boolean(latestTranscriptAssessment);
  const isHeroState =
    !evidencePlan.hasAnyEvidence && !latestTranscriptAssessment && !evidencePlan.hasSkips;
  const showSection = (key: Section2EvidenceSectionKey) =>
    !isHeroState && evidencePlan.visibleSections.has(key);
  const hiddenAddMoreSections = addMoreSections.filter(
    (section) => !evidencePlan.visibleSections.has(section.key),
  );

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

      <SupportingEvidencePanel
        assessment={latestTranscriptAssessment}
        courseCode={data.applicationMeta?.selectedCourse?.code}
        courseTitle={selectedCourseTitle}
        isHero={isHeroState}
        isProcessing={isProcessingEligibility}
        onNavigate={(path) => navigate(`${path}${reviewSuffix}`)}
        onSkipPrompt={handleSkipSection}
        onUnskipPrompt={handleUnskipSection}
        plan={evidencePlan}
        showParsedTranscriptIntro={showParsedTranscriptIntro}
        ungroupedRows={programEvidenceRows}
      />

      {showSection("tertiary") ? (
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
      ) : null}

      {!isHeroState ? (
        <Section2EvidenceNextStepPanel
          isProcessing={isProcessingEligibility}
          onNavigate={(path) => navigate(`${path}${reviewSuffix}`)}
          onSkipPrompt={handleSkipSection}
          plan={evidencePlan}
        />
      ) : null}

      <div className="space-y-6">
        {showSection("cv") ? (
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
        ) : null}

        {showSection("employment") ? (
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
        ) : null}

        {showSection("accreditation") ? (
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
        ) : null}

        {showSection("secondary") ? (
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
        ) : null}

        {showSection("languageTest") ? (
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
        ) : null}

        {!isHeroState && hiddenAddMoreSections.length > 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 sm:p-5">
            <p className="text-xs font-semibold text-gray-700 sm:text-sm">
              Add another document
            </p>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Optional — you&apos;ve covered what we ask for, but you can add anything else
              that strengthens your application.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenAddMoreSections.map((section) => (
                <Button
                  key={section.key}
                  className="h-9 rounded-lg text-xs font-medium shadow-none sm:text-sm"
                  onClick={() => navigate(section2AddPath(section.stepKey))}
                  variant="outline"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {section.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section2QualificationsPage>
  );
}
