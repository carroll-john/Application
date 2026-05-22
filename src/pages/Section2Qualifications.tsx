import {
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  Languages,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  QualificationsAttachment,
  QualificationsListItem,
  QualificationsSectionCard,
  useSection2QualificationsFlow,
} from "../features/section2";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { getSection2EditPath, getSection2Step, SECTION2_SECTION_LABEL } from "../lib/section2Steps";

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

  function section2AddPath(key: Parameters<typeof getSection2Step>[0]) {
    const step = getSection2Step(key);
    return `${step.addPath ?? ""}${reviewSuffix}`;
  }

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Work through each section to build your application."
          progress={66}
          sectionLabel={SECTION2_SECTION_LABEL}
          title="Your qualifications"
        />
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
                subtitle={qualification.institution}
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
          onPrevious={() => navigate(returnPath("/section1/family-support"))}
          onPrimary={() => void handleSaveAndContinue()}
          onSecondary={fromReview ? undefined : () => void handleSaveAndExit()}
          secondaryDisabled={isSaving}
          secondaryLabel={fromReview ? undefined : isSaving ? "Saving..." : "Save & Exit"}
        />
      </div>
    </div>
  );
}
