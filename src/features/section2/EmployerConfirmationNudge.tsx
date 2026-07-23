import { Building2 } from "lucide-react";
import type { ApplicationData } from "../../lib/applicationData";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { isSubmissionReadyDocument } from "../../lib/documentAttachment";

export function EmployerConfirmationNudge({
  applicationData,
  course,
}: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry | null | undefined;
}) {
  const assessedRequirements = (course?.requirements ?? [])
    .filter((requirement) => requirement.kind === "work_experience")
    .map((requirement) => ({
      assessment: applicationData.workExperienceAssessments[requirement.id],
      requirement,
    }))
    .filter((item) => Boolean(item.assessment));

  if (assessedRequirements.length === 0) return null;

  const qualifyingRoleIds = new Set(
    assessedRequirements.flatMap(({ assessment }) =>
      (assessment?.roleAssessments ?? [])
        .filter((role) => role.countedMonthsMaximum > 0)
        .map((role) => role.employmentExperienceId),
    ),
  );
  const qualifyingRoles = applicationData.employmentExperiences.filter((role) =>
    qualifyingRoleIds.has(role.id),
  );
  const rolesWithoutLetters = qualifyingRoles.filter(
    (role) => !isSubmissionReadyDocument(role.employerLetterDocument),
  );

  if (rolesWithoutLetters.length === 0) return null;

  const requiredYears = Math.max(
    ...assessedRequirements.map(({ requirement }) => requirement.params.minYears),
  );
  const attachedCount = qualifyingRoles.length - rolesWithoutLetters.length;

  return (
    <aside
      aria-label="Employer confirmation reminder"
      className="content-block-compact mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:mb-8 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2 text-[var(--cta-secondary)] shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
              Collect employer confirmation
            </h2>
            <span className="text-xs font-medium text-gray-500">Optional for now</span>
          </div>
          <p className="mt-2 text-xs text-gray-700 sm:text-sm">
            Ask employers for signed letters on company letterhead covering at least {requiredYears}
            {requiredYears === 1 ? " year" : " years"} across the relevant roles in your application.
          </p>
          <p className="mt-1 text-xs text-gray-600 sm:text-sm">
            Each letter should confirm your job title, employment dates and main responsibilities.
            You can submit without these letters, but collecting them now may reduce follow-up from
            admissions.
          </p>
          {attachedCount > 0 ? (
            <p className="mt-2 text-xs font-medium text-[var(--success-text)] sm:text-sm">
              {attachedCount} employer letter{attachedCount === 1 ? " is" : "s are"} already attached.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
