import { AlertTriangle, Edit } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopiedApplicationNotice } from "../components/CopiedApplicationNotice";
import { FormActionBar } from "../components/FormActionBar";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  ReviewAttachments,
  ReviewCard,
  ReviewGrid,
  ReviewList,
} from "../features/review/ReviewSections";
import { Button } from "../components/ui/button";
import { formatIsoDateForDisplay } from "../components/ui/date-controls";
import { useApplication } from "../context/ApplicationContext";
import {
  getSubmissionValidationIssues,
  type ValidationIssue,
} from "../lib/applicationValidationSchema";
import {
  captureApplicationStepEvent,
  capturePostHogEvent,
  getCourseAnalyticsProperties,
} from "../lib/posthog";
import {
  consumeReviewValidationFlag,
  getAddressReviewItems,
  setReviewValidationFlag,
} from "../lib/reviewFormatters";
import { captureSentryException } from "../lib/sentry";
import { sleep } from "../lib/utils";

export default function ReviewAndSubmit() {
  const navigate = useNavigate();
  const { data, markApplicationSubmitted } = useApplication();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationErrors = useMemo(() => getSubmissionValidationIssues(data), [data]);
  const parentCount = Number(data.contactDetails.parentsCount || 0);
  const prefilledFrom = data.applicationMeta.prefilledFrom;

  useEffect(() => {
    if (!consumeReviewValidationFlag()) return;

    if (validationErrors.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [validationErrors]);

  const groupedErrors = useMemo(
    () =>
      validationErrors.reduce<Record<string, Record<string, ValidationIssue[]>>>(
        (accumulator, error) => {
          accumulator[error.section] ??= {};
          accumulator[error.section][error.subsection] ??= [];
          accumulator[error.section][error.subsection].push(error);
          return accumulator;
        },
        {},
      ),
    [validationErrors],
  );

  async function handleSubmit() {
    setSubmitError(null);

    if (validationErrors.length > 0) {
      capturePostHogEvent("application_submit_blocked", {
        ...getCourseAnalyticsProperties(data.applicationMeta.selectedCourse),
        application_id: data.applicationMeta.recordId ?? null,
        validation_error_count: validationErrors.length,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      captureApplicationStepEvent("application_submit_started", {
        application: data,
        pathname: "/review",
        properties: {
          validation_error_count: 0,
        },
      });
      await sleep(300);
      await markApplicationSubmitted();
      navigate("/submitted");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't submit the application right now. Please try again.";
      capturePostHogEvent("application_submit_failed", {
        ...getCourseAnalyticsProperties(data.applicationMeta.selectedCourse),
        application_id: data.applicationMeta.recordId ?? null,
        error_message: message,
      });
      captureSentryException(error, {
        extras: {
          activeApplicationId: data.applicationMeta.recordId ?? null,
          courseCode: data.applicationMeta.selectedCourse?.code ?? null,
          courseTitle: data.applicationMeta.selectedCourse?.title ?? null,
        },
        tags: {
          flow: "application_submit",
          screen: "review_and_submit",
        },
      });
      setSubmitError(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveAndExit() {
    setIsSubmitting(true);
    await sleep(600);
    navigate("/dashboard");
  }

  function navigateToReviewEdit(path: string) {
    setReviewValidationFlag();
    navigate(path);
  }

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 sm:text-sm">
              Section 3 of 3
            </span>
            <span className="text-xs font-medium text-gray-700 sm:text-sm">
              100%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 w-full rounded-full bg-[var(--cta-secondary)] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Review and submit
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Please review all information carefully before submitting your
            application
          </p>
          {prefilledFrom ? (
            <CopiedApplicationNotice
              className="mt-4"
              prefilledFrom={prefilledFrom}
              readyToSubmit={validationErrors.length === 0}
            />
          ) : validationErrors.length === 0 ? (
            <div className="mt-4 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3">
              <p className="text-sm font-medium text-[var(--info-text)]">
                Review before submitting
              </p>
              <p className="mt-1 text-xs text-[var(--info-text)]">
                All required fields are complete. Review your details and
                attachments one more time before you submit the application.
              </p>
            </div>
          ) : null}
        </div>

        {validationErrors.length > 0 ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex-1">
              <p className="mb-2 font-semibold text-red-800">
                Required fields missing
              </p>
              <p className="mb-4 text-sm text-red-700">
                Please complete the following fields to submit your application:
              </p>
              <div className="mt-4 space-y-4">
                {Object.entries(groupedErrors).map(([section, subsections]) => (
                  <div
                    key={section}
                    className="rounded border border-red-200 bg-white p-4"
                  >
                    <h3 className="text-base font-bold text-gray-900">{section}</h3>
                    <div className="mt-3 space-y-3">
                      {Object.entries(subsections).map(([subsection, errors]) => (
                        <div key={subsection} className="border-l-2 border-gray-200 pl-3">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-gray-900">
                              {subsection}
                            </p>
                            <Button
                              className="h-8 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 shadow-none hover:bg-gray-50"
                              onClick={() => navigateToReviewEdit(errors[0].path)}
                              size="sm"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                          <div className="grid gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
                            {errors.map((error) => (
                              <div key={`${subsection}-${error.field}`}>
                                <span className="font-medium text-red-600">Required:</span>{" "}
                                {error.field}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {submitError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Submission failed</p>
            <p className="mt-1 text-sm text-red-700">{submitError}</p>
          </div>
        ) : null}

        <div className="space-y-4 sm:space-y-6">
          <ReviewCard
            onEdit={() => navigateToReviewEdit("/section1/basic-info?from=review")}
            title="Basic Information"
          >
            <ReviewGrid
              items={[
                ["Title", data.personalDetails.title],
                ["First name", data.personalDetails.firstName],
                ["Middle name", data.personalDetails.middleName || "Not provided"],
                ["Last name", data.personalDetails.lastName],
                ["Preferred name", data.personalDetails.preferredName || "Not provided"],
              ]}
            />
          </ReviewCard>

          <ReviewCard
            onEdit={() =>
              navigateToReviewEdit("/section1/personal-contact?from=review")
            }
            title="Personal Contact Details"
          >
            <ReviewGrid
              items={[
                ["Gender", data.personalDetails.gender],
                [
                  "Date of birth",
                  formatIsoDateForDisplay(data.personalDetails.dateOfBirth),
                ],
                ["Email address", data.personalDetails.email],
                ["Phone number", data.personalDetails.phone],
              ]}
            />
          </ReviewCard>

          <ReviewCard
            onEdit={() => navigateToReviewEdit("/section1/contact-info?from=review")}
            title="Citizenship Information"
          >
            <ReviewGrid
              items={[
                ["Citizen country", data.contactDetails.citizenCountry],
                ["Birth country", data.contactDetails.birthCountry],
                [
                  "Australian citizenship status",
                  data.contactDetails.citizenshipStatus,
                ],
              ]}
            />
          </ReviewCard>

          <ReviewCard
            onEdit={() => navigateToReviewEdit("/section1/address?from=review")}
            title="Address Details"
          >
            <ReviewGrid
              items={[
                ...getAddressReviewItems(
                  "Permanent residential address",
                  data.contactDetails.residentialAddress,
                ),
                ...(data.contactDetails.postalDifferent
                  ? getAddressReviewItems(
                      "Postal address",
                      data.contactDetails.postalAddress,
                    )
                  : []),
              ]}
            />
          </ReviewCard>

          <ReviewCard
            onEdit={() =>
              navigateToReviewEdit("/section1/cultural-background?from=review")
            }
            title="Cultural & Education Background"
          >
            <ReviewGrid
              items={[
                ["Language spoken at home", data.contactDetails.language],
                [
                  "Aboriginal or Torres Strait Islander status",
                  data.contactDetails.aboriginal,
                ],
                ["Highest school level completed", data.contactDetails.schoolLevel],
              ]}
            />
          </ReviewCard>

          <ReviewCard
            onEdit={() =>
              navigateToReviewEdit("/section1/family-support?from=review")
            }
            title="Family & Support Information"
          >
            <ReviewGrid
              items={[
                [
                  "How many parents/guardians do you have?",
                  data.contactDetails.parentsCount || "Not provided",
                ],
                ...([
                  data.contactDetails.parent1Details,
                  data.contactDetails.parent2Details,
                  data.contactDetails.parent3Details,
                  data.contactDetails.parent4Details,
                  data.contactDetails.parent5Details,
                ]
                  .slice(0, parentCount)
                  .map(
                    (value, index) =>
                      [
                        `Parent/Guardian ${index + 1} Education Level`,
                        value || "Not provided",
                      ] as [string, string],
                  )),
                [
                  "Do you have a disability, impairment or long-term condition?",
                  data.contactDetails.hasDisability === null
                    ? "Not provided"
                    : data.contactDetails.hasDisability
                      ? "Yes"
                      : "No",
                ],
                ...(data.contactDetails.hasDisability
                  ? [[
                      "Please provide details",
                      data.contactDetails.disabilityDetails || "Not provided",
                    ] as [string, string]]
                  : []),
              ]}
            />
          </ReviewCard>

          {data.tertiaryQualifications.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Tertiary qualifications"
            >
              <ReviewList
                items={data.tertiaryQualifications.map((qualification) => ({
                  attachments: [
                    qualification.transcriptDocumentName
                      ? {
                          fileName: qualification.transcriptDocumentName,
                          label: "Transcript",
                        }
                      : null,
                    qualification.certificateDocumentName
                      ? {
                          fileName: qualification.certificateDocumentName,
                          label: "Certificate",
                        }
                      : null,
                  ].filter(Boolean) as Array<{ fileName: string; label?: string }>,
                  editPath: `/section2/edit-tertiary/${qualification.id}?from=review`,
                  fallbackTitle: "Tertiary Qualification",
                  fields: [
                    ["Institution", qualification.institution],
                    ["Country", qualification.country],
                    ["Level", qualification.level],
                    [
                      "Duration",
                      `${qualification.startMonth} ${qualification.startYear} - ${qualification.endMonth} ${qualification.endYear}`,
                    ],
                    [
                      "Completed qualification",
                      qualification.completed ? "Yes" : "No",
                    ],
                  ],
                  id: qualification.id,
                  title: qualification.courseName,
                }))}
                onEdit={navigateToReviewEdit}
              />
            </ReviewCard>
          ) : null}

          {data.cvUploaded ? (
            <ReviewCard
              onEdit={() => navigateToReviewEdit("/section2/add-cv?from=review")}
              title="Curriculum Vitae (CV)"
            >
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <ReviewAttachments
                  attachments={
                    data.cvFileName ? [{ fileName: data.cvFileName }] : []
                  }
                />
              </div>
            </ReviewCard>
          ) : null}

          {data.employmentExperiences.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Employment experience"
            >
              <ReviewList
                items={data.employmentExperiences.map((experience) => ({
                  detail: experience.duties ? (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <p className="text-gray-600">Key responsibilities</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {experience.duties}
                      </p>
                    </div>
                  ) : null,
                  editPath: `/section2/edit-employment/${experience.id}?from=review`,
                  fallbackTitle: "Employment Experience",
                  fields: [
                    ["Company", experience.company],
                    ["Employment type", experience.type],
                    [
                      "Duration",
                      `${experience.startMonth} ${experience.startYear} - ${
                        experience.currentRole
                          ? "Current"
                          : `${experience.endMonth} ${experience.endYear}`
                      }`,
                    ],
                    ["Current role", experience.currentRole ? "Yes" : "No"],
                  ],
                  id: experience.id,
                  title: experience.position,
                }))}
                onEdit={navigateToReviewEdit}
              />
            </ReviewCard>
          ) : null}

          {data.professionalAccreditations.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Professional accreditations"
            >
              <ReviewList
                items={data.professionalAccreditations.map((accreditation) => ({
                  attachments: accreditation.documentName
                    ? [{ fileName: accreditation.documentName }]
                    : [],
                  editPath: `/section2/edit-accreditation/${accreditation.id}?from=review`,
                  fallbackTitle: "Professional Accreditation",
                  fields: [
                    ["Name", accreditation.name],
                    ["Status", accreditation.status],
                  ],
                  id: accreditation.id,
                  title: accreditation.name,
                }))}
                onEdit={navigateToReviewEdit}
              />
            </ReviewCard>
          ) : null}

          {data.secondaryQualifications.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Secondary qualifications"
            >
              <ReviewList
                items={data.secondaryQualifications.map((qualification) => ({
                  editPath: `/section2/edit-secondary/${qualification.id}?from=review`,
                  fallbackTitle: "Secondary Qualification",
                  fields: [
                    ["Type", qualification.type],
                    ["Country", qualification.country],
                    ["State", qualification.state],
                    ["School", qualification.school],
                    ["Qualification obtained", qualification.qualification],
                    ["Completion year", qualification.year],
                  ],
                  id: qualification.id,
                  title: qualification.qualification,
                }))}
                onEdit={navigateToReviewEdit}
              />
            </ReviewCard>
          ) : null}

          {data.languageTests.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="English language proficiency"
            >
              <ReviewList
                items={data.languageTests.map((test) => ({
                  attachments: test.documentName ? [{ fileName: test.documentName }] : [],
                  editPath: `/section2/edit-language-test/${test.id}?from=review`,
                  fallbackTitle: "Language Test",
                  fields: [
                    ["Test type", test.type],
                    ["Test name", test.name],
                    ["Test year", test.year],
                  ],
                  id: test.id,
                  title: test.name,
                }))}
                onEdit={navigateToReviewEdit}
              />
            </ReviewCard>
          ) : null}

          <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--info-text)]" />
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--info-text)]">
                  Declaration
                </p>
                <p className="text-xs leading-relaxed text-[var(--info-text)]">
                  By submitting this application, you declare that all information
                  provided is true and accurate. You agree to the terms and
                  conditions and understand that providing false information may
                  result in your application being rejected.
                </p>
              </div>
            </div>
          </div>
        </div>

        <FormActionBar
          previousDisabled={isSubmitting}
          previousLabel="Previous"
          primaryDisabled={isSubmitting}
          primaryLabel="Submit application"
          onPrevious={() => navigate("/section2/qualifications")}
          onPrimary={handleSubmit}
          onSecondary={handleSaveAndExit}
          secondaryDisabled={isSubmitting}
          secondaryLabel="Save & Exit"
        />
      </div>

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50">
          <div className="rounded-lg bg-white p-6 text-center shadow-2xl">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm font-medium text-slate-700">
              Submitting your application...
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
