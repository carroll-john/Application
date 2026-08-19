import type { ApplicationData } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { requirementKindLabel } from "./requirements";
import type { ProgramEvidenceRow } from "./programEvidence";

const MAYA_MBA_COURSE_CODE = "MGM104";

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function isMayaUcDemoApplication(
  applicationData: ApplicationData,
  course: CourseCatalogEntry | null | undefined,
) {
  if (course?.officialCourseCode !== MAYA_MBA_COURSE_CODE || !applicationData.cvUploaded) {
    return false;
  }

  const cvName = normalize(applicationData.cvFileName);
  const hasMayaCv = cvName.includes("maya patel cv");
  const hasRmitIncompleteBusinessStudy = applicationData.tertiaryQualifications.some(
    (qualification) =>
      normalize(qualification.institution) === "rmit university" &&
      normalize(qualification.courseName).includes("bachelor of business") &&
      normalize(qualification.courseName).includes("management") &&
      qualification.completed === false,
  );
  const hasReviewedLeadRole = applicationData.employmentExperiences.some(
    (experience) =>
      normalize(experience.position) === "learning and development lead" &&
      normalize(experience.company) === "brightpath learning",
  );

  return hasMayaCv && hasRmitIncompleteBusinessStudy && hasReviewedLeadRole;
}

/**
 * The UC COO demo starts Maya's MBA application from the pre-application matcher, where her
 * reviewed senior work experience is the indicative entry route. The current application schema
 * does not persist that matcher result, so keep this as an exact synthetic-fixture bridge rather
 * than inferring a work pathway for real applicants from a CV filename or role title alone.
 */
export function buildUcDemoWorkEntryEvidenceRow(options: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry | null | undefined;
}): ProgramEvidenceRow | null {
  if (!isMayaUcDemoApplication(options.applicationData, options.course)) {
    return null;
  }

  return {
    explanation:
      "Your reviewed CV shows senior or highly specialised experience that may support UC's work-experience entry pathway. UC Admissions will confirm relevance and eligibility.",
    heading: "Work experience entry pathway",
    id: "uc-demo-maya-work-entry",
    isBlocking: false,
    isEntryPathway: true,
    kindLabel: requirementKindLabel("work_experience"),
    requirementId: "uc-demo-maya-work-entry",
    sourceText: "UC work-experience entry pathway",
    status: "provisionally_met",
    statusLabel: "Appears to meet",
  };
}
