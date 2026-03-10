import { AlertTriangle, CheckCircle2, Edit, Paperclip } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CopiedApplicationNotice } from "../components/CopiedApplicationNotice";
import { FormActionBar } from "../components/FormActionBar";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Button } from "../components/ui/button";
import { formatIsoDateForDisplay } from "../components/ui/date-controls";
import { useApplication } from "../context/ApplicationContext";
import { formatStructuredAddress, type StructuredAddress } from "../lib/address";
import {
  captureApplicationStepEvent,
  capturePostHogEvent,
  getCourseAnalyticsProperties,
} from "../lib/posthog";
import {
  validateApplication,
  type ValidationError,
} from "../lib/applicationValidation";
import { captureSentryException } from "../lib/sentry";
import { sleep } from "../lib/utils";

const REVIEW_VALIDATION_FLAG = "review:auto-validate";

function getAddressReviewItems(
  label: string,
  address: StructuredAddress,
): [string, string][] {
  return [[label, formatStructuredAddress(address) || "Not provided"]];
}

export default function ReviewAndSubmit() {
  const navigate = useNavigate();
  const { data, markApplicationSubmitted } = useApplication();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationErrors = useMemo(() => validateApplication(data), [data]);
  const parentCount = Number(data.contactDetails.parentsCount || 0);
  const prefilledFrom = data.applicationMeta.prefilledFrom;

  useEffect(() => {
    const shouldValidate = window.sessionStorage.getItem(REVIEW_VALIDATION_FLAG) === "1";
    if (!shouldValidate) return;

    window.sessionStorage.removeItem(REVIEW_VALIDATION_FLAG);
    if (validationErrors.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [validationErrors]);

  const groupedErrors = useMemo(
    () =>
      validationErrors.reduce<Record<string, Record<string, ValidationError[]>>>(
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
    window.sessionStorage.setItem(REVIEW_VALIDATION_FLAG, "1");
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
            <div className="h-2 w-full rounded-full bg-[#084E74] transition-all duration-300" />
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
                  data.contactDetails.hasDisability ? "Yes" : "No",
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
              <div className="space-y-3">
                {data.tertiaryQualifications.map((qualification, index) => (
                  <div
                    key={qualification.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 rounded bg-[#084E74] px-2 py-0.5 text-xs text-white">
                          #{index + 1}
                        </span>
                        {qualification.courseName}
                      </p>
                      <Button
                        className="ml-2 rounded-lg"
                        onClick={() =>
                          navigateToReviewEdit(
                            `/section2/edit-tertiary/${qualification.id}?from=review`,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-gray-600">Institution</p>
                        <p className="font-medium text-gray-900">
                          {qualification.institution}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Country</p>
                        <p className="font-medium text-gray-900">
                          {qualification.country}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Level</p>
                        <p className="font-medium text-gray-900">
                          {qualification.level}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Duration</p>
                        <p className="font-medium text-gray-900">
                          {qualification.startMonth} {qualification.startYear} -{" "}
                          {qualification.endMonth} {qualification.endYear}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Completed qualification</p>
                        <p className="font-medium text-gray-900">
                          {qualification.completed ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                    <ReviewAttachments
                      attachments={[
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
                      ].filter(Boolean) as Array<{ fileName: string; label?: string }>}
                    />
                  </div>
                ))}
              </div>
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
              <div className="space-y-3">
                {data.employmentExperiences.map((experience, index) => (
                  <div
                    key={experience.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 rounded bg-[#084E74] px-2 py-0.5 text-xs text-white">
                          #{index + 1}
                        </span>
                        {experience.position || "Employment Experience"}
                      </p>
                      <Button
                        className="ml-2 rounded-lg"
                        onClick={() =>
                          navigateToReviewEdit(
                            `/section2/edit-employment/${experience.id}?from=review`,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <ReviewField label="Company" value={experience.company} />
                      <ReviewField label="Employment type" value={experience.type} />
                      <ReviewField
                        label="Duration"
                        value={`${experience.startMonth} ${experience.startYear} - ${
                          experience.currentRole
                            ? "Current"
                            : `${experience.endMonth} ${experience.endYear}`
                        }`}
                      />
                      <ReviewField
                        label="Current role"
                        value={experience.currentRole ? "Yes" : "No"}
                      />
                    </div>
                    {experience.duties ? (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="text-gray-600">Key responsibilities</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {experience.duties}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </ReviewCard>
          ) : null}

          {data.professionalAccreditations.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Professional accreditations"
            >
              <div className="space-y-3">
                {data.professionalAccreditations.map((accreditation, index) => (
                  <div
                    key={accreditation.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 rounded bg-[#084E74] px-2 py-0.5 text-xs text-white">
                          #{index + 1}
                        </span>
                        {accreditation.name || "Professional Accreditation"}
                      </p>
                      <Button
                        className="ml-2 rounded-lg"
                        onClick={() =>
                          navigateToReviewEdit(
                            `/section2/edit-accreditation/${accreditation.id}?from=review`,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <ReviewField label="Name" value={accreditation.name} />
                      <ReviewField label="Status" value={accreditation.status} />
                    </div>
                    <ReviewAttachments
                      attachments={
                        accreditation.documentName
                          ? [{ fileName: accreditation.documentName }]
                          : []
                      }
                    />
                  </div>
                ))}
              </div>
            </ReviewCard>
          ) : null}

          {data.secondaryQualifications.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="Secondary qualifications"
            >
              <div className="space-y-3">
                {data.secondaryQualifications.map((qualification, index) => (
                  <div
                    key={qualification.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 rounded bg-[#084E74] px-2 py-0.5 text-xs text-white">
                          #{index + 1}
                        </span>
                        {qualification.qualification || "Secondary Qualification"}
                      </p>
                      <Button
                        className="ml-2 rounded-lg"
                        onClick={() =>
                          navigateToReviewEdit(
                            `/section2/edit-secondary/${qualification.id}?from=review`,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <ReviewField label="Type" value={qualification.type} />
                      <ReviewField label="Country" value={qualification.country} />
                      <ReviewField label="State" value={qualification.state} />
                      <ReviewField label="School" value={qualification.school} />
                      <ReviewField
                        label="Qualification obtained"
                        value={qualification.qualification}
                      />
                      <ReviewField label="Completion year" value={qualification.year} />
                    </div>
                  </div>
                ))}
              </div>
            </ReviewCard>
          ) : null}

          {data.languageTests.length > 0 ? (
            <ReviewCard
              onEdit={() =>
                navigateToReviewEdit("/section2/qualifications?from=review")
              }
              title="English language proficiency"
            >
              <div className="space-y-3">
                {data.languageTests.map((test, index) => (
                  <div
                    key={test.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 rounded bg-[#084E74] px-2 py-0.5 text-xs text-white">
                          #{index + 1}
                        </span>
                        {test.name || "Language Test"}
                      </p>
                      <Button
                        className="ml-2 rounded-lg"
                        onClick={() =>
                          navigateToReviewEdit(
                            `/section2/edit-language-test/${test.id}?from=review`,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <ReviewField label="Test type" value={test.type} />
                      <ReviewField label="Test name" value={test.name} />
                      <ReviewField label="Test year" value={test.year} />
                    </div>
                    <ReviewAttachments
                      attachments={
                        test.documentName ? [{ fileName: test.documentName }] : []
                      }
                    />
                  </div>
                ))}
              </div>
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

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 border-l-4 border-l-[#084E74] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h3>
        <Button
          className="h-11 w-full rounded-lg text-sm font-medium shadow-none sm:h-9 sm:w-auto"
          onClick={onEdit}
          size="sm"
          variant="outline"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>
      </div>
      {children}
    </div>
  );
}

function ReviewGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <ReviewField key={`${label}-${value}`} label={label} value={value} />
      ))}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className={`font-medium ${value ? "text-gray-900" : "text-gray-500"}`}>
        {value || "Not provided"}
      </p>
    </div>
  );
}

function ReviewAttachments({
  attachments,
}: {
  attachments: Array<{ fileName: string; label?: string }>;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
      {attachments.map((attachment) => (
        <div key={`${attachment.label ?? "attachment"}-${attachment.fileName}`} className="flex min-w-0 items-start gap-2">
          <Paperclip className="h-4 w-4 text-green-600" />
          <span className="min-w-0 break-all text-sm font-medium text-green-600">
            {attachment.label ? `${attachment.label}: ` : ""}
            {attachment.fileName}
          </span>
        </div>
      ))}
    </div>
  );
}
