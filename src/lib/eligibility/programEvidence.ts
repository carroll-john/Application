import type { ApplicationData } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { isSubmissionReadyDocument } from "../documentAttachment";
import {
  getAcceptedEnglishCompletionCountries,
  hasCurrentAhpraRegistrationEvidence,
  isEnglishMediumQualification,
  languageTestSatisfiesEnglishRequirement,
} from "./englishProficiencyEvidence";
import {
  formatAcademicThreshold,
  formatFieldOfStudyAreas,
  requirementKindLabel,
  type RequirementInstance,
} from "./requirements";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  TranscriptEligibilityAssessment,
} from "./types";

export type ProgramEvidenceStatus =
  | "met"
  | "needs_evidence"
  | "needs_details"
  | "needs_review"
  | "possible_alternative";

export interface ProgramEvidenceRow {
  actionLabel?: string;
  actionPath?: string;
  explanation: string;
  /** Short, non-duplicated display title for the card. Falls back to `sourceText` verbatim. */
  heading: string;
  id: string;
  isBlocking: boolean;
  kindLabel: string;
  requirementId: string;
  requirementStatus?: EligibilityRequirementStatus;
  /** Verbatim published requirement sentence — kept for feedback/validation traceability. */
  sourceText: string;
  status: ProgramEvidenceStatus;
  statusLabel: string;
}

export const programEvidenceStatusCopy: Record<ProgramEvidenceStatus, string> = {
  met: "Met",
  needs_details: "Add details",
  needs_evidence: "Add evidence",
  needs_review: "Needs review",
  possible_alternative: "Possible alternative",
};

const ENGLISH_MISSING_INFORMATION_PATTERN =
  /\b(english|ielts|toefl|pte|proficiency|instruction|language)\b/i;

const tertiaryPath = "/section2/add-tertiary?from=review";
const employmentPath = "/section2/add-employment?from=review";
const languagePath = "/section2/add-language-test?from=review";

function getCheckMap(checks: readonly EligibilityRequirementCheck[]) {
  const out = new Map<string, EligibilityRequirementCheck>();
  for (const check of checks) {
    out.set(check.id, check);
    const groupDelimiter = check.id.indexOf(":");
    if (groupDelimiter > 0) {
      out.set(check.id.slice(0, groupDelimiter), check);
    }
  }
  return out;
}

function shouldSkipPairedQualificationLevel(
  requirements: readonly RequirementInstance[],
  instance: RequirementInstance,
) {
  return (
    instance.kind === "qualification_level" &&
    requirements.some(
      (candidate) =>
        candidate.kind === "qualification_completed" &&
        !candidate.alternativeGroupId &&
        !instance.alternativeGroupId &&
        candidate.weight === instance.weight &&
        candidate.sourceText === instance.sourceText,
    )
  );
}

/**
 * Short, non-duplicated card title. `academic_threshold`, `field_of_study`, and `work_experience`
 * sourceText is often a compound sentence that restates another requirement's clause (e.g. a GPA
 * requirement repeating the qualification-level sentence just to append the GPA figure, or all
 * three sharing one un-split published sentence) — for those kinds, build a heading from the
 * structured params instead of the verbatim sentence. Other kinds don't have this duplication
 * problem, so they keep the verbatim sourceText as their heading.
 */
function formatRequirementHeading(instance: RequirementInstance): string {
  if (instance.kind === "academic_threshold") {
    return `Minimum ${formatAcademicThreshold(instance.params)}`;
  }

  if (instance.kind === "field_of_study") {
    return `Accepted fields: ${formatFieldOfStudyAreas(instance.params)}`;
  }

  if (instance.kind === "work_experience") {
    return `${instance.params.minYears}+ years' relevant experience`;
  }

  return instance.sourceText;
}

function statusFromCheck(
  instance: RequirementInstance,
  check: EligibilityRequirementCheck | undefined,
  hasTranscriptEvidence: boolean,
): Pick<
  ProgramEvidenceRow,
  "actionLabel" | "actionPath" | "explanation" | "isBlocking" | "requirementStatus" | "status"
> {
  if (!check) {
    return {
      actionLabel: "Add transcript",
      actionPath: tertiaryPath,
      explanation: "Add your transcript to verify this requirement.",
      isBlocking: true,
      status: hasTranscriptEvidence ? "needs_review" : "needs_evidence",
    };
  }

  if (check.status === "pass") {
    return {
      explanation: check.explanation,
      isBlocking: false,
      requirementStatus: check.status,
      status: "met",
    };
  }

  if (check.status === "unknown") {
    return {
      actionLabel: "Review qualification",
      actionPath: tertiaryPath,
      explanation: check.explanation,
      isBlocking: true,
      requirementStatus: check.status,
      status: hasTranscriptEvidence ? "needs_details" : "needs_evidence",
    };
  }

  if (instance.kind === "academic_threshold") {
    return {
      actionLabel: "Add work evidence",
      actionPath: employmentPath,
      explanation:
        "Your result is below this requirement. Add work experience for admissions to consider an alternate pathway.",
      isBlocking: false,
      requirementStatus: check.status,
      status: "possible_alternative",
    };
  }

  return {
    explanation: check.explanation,
    isBlocking: false,
    requirementStatus: check.status,
    status: "needs_review",
  };
}

function englishRequirementRow(
  data: ApplicationData,
  course: CourseCatalogEntry,
  instance: Extract<RequirementInstance, { kind: "english_proficiency" }>,
): Pick<
  ProgramEvidenceRow,
  "actionLabel" | "actionPath" | "explanation" | "isBlocking" | "status"
> {
  const englishQualification = data.tertiaryQualifications.find((qualification) =>
    isEnglishMediumQualification(qualification, course),
  );
  if (englishQualification) {
    return {
      explanation: `English evidence is satisfied by study in ${englishQualification.country}.`,
      isBlocking: false,
      status: "met",
    };
  }

  const matchingTest = data.languageTests.find((test) =>
    languageTestSatisfiesEnglishRequirement(test, instance),
  );
  if (matchingTest) {
    return {
      explanation: `${matchingTest.type} evidence meets the score and document requirements for this program.`,
      isBlocking: false,
      status: "met",
    };
  }

  if (hasCurrentAhpraRegistrationEvidence(data.professionalAccreditations)) {
    return {
      explanation: "English evidence is satisfied by current documented AHPRA registration.",
      isBlocking: false,
      status: "met",
    };
  }

  const firstLanguageTest = data.languageTests[0];
  if (firstLanguageTest) {
    const hasDocument = isSubmissionReadyDocument(firstLanguageTest.document);
    const hasOverallScore = Boolean(firstLanguageTest.overallScore?.trim());
    return {
      actionLabel: "Update English test",
      actionPath: `/section2/edit-language-test/${firstLanguageTest.id}?from=review`,
      explanation: hasDocument && hasOverallScore
        ? "Your English test doesn't meet this program's required scores. Add another approved test or AHPRA registration."
        : "Add your official score report so this requirement can be checked.",
      isBlocking: true,
      status: hasDocument && hasOverallScore ? "needs_evidence" : "needs_details",
    };
  }

  const firstAhpraLikeAccreditation = data.professionalAccreditations.find((accreditation) =>
    /ahpra|registered/i.test(accreditation.name),
  );
  if (firstAhpraLikeAccreditation) {
    return {
      actionLabel: "Update registration",
      actionPath: `/section2/edit-accreditation/${firstAhpraLikeAccreditation.id}?from=review`,
      explanation:
        "Mark your AHPRA registration active and attach the supporting document.",
      isBlocking: true,
      status: "needs_details",
    };
  }

  const acceptedCountries = getAcceptedEnglishCompletionCountries(course).join(", ");
  return {
    actionLabel: "Add English evidence",
    actionPath: languagePath,
    explanation: `Add an approved English test, AHPRA registration, or a qualification from an accepted English-speaking country (${acceptedCountries}).`,
    isBlocking: true,
    status: "needs_evidence",
  };
}

function workExperienceRow(
  data: ApplicationData,
  instance: Extract<RequirementInstance, { kind: "work_experience" }>,
): Pick<
  ProgramEvidenceRow,
  "actionLabel" | "actionPath" | "explanation" | "isBlocking" | "status"
> {
  if (data.employmentExperiences.length > 0) {
    return {
      explanation:
        data.cvUploaded
          ? "Work experience and CV added for admissions review."
          : "Work experience added. A CV can strengthen your case.",
      isBlocking: false,
      status: "met",
    };
  }

  return {
    actionLabel: "Add work experience",
    actionPath: employmentPath,
    explanation: `Add evidence of ${instance.params.minYears}+ years' relevant experience.`,
    isBlocking: true,
    status: "needs_evidence",
  };
}

export function buildProgramEvidenceRows(options: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry | null | undefined;
  transcriptAssessment?: TranscriptEligibilityAssessment;
}): ProgramEvidenceRow[] {
  const { applicationData, course, transcriptAssessment } = options;
  const requirements = course?.requirements ?? [];
  if (!course || requirements.length === 0) {
    return [];
  }

  const checkMap = getCheckMap(transcriptAssessment?.requirementsChecked ?? []);
  const hasTranscriptEvidence = applicationData.tertiaryQualifications.some((qualification) =>
    isSubmissionReadyDocument(qualification.transcriptDocument),
  );

  const rows: ProgramEvidenceRow[] = [];
  const emittedAlternativeGroups = new Set<string>();

  for (const instance of requirements) {
    if (shouldSkipPairedQualificationLevel(requirements, instance)) {
      continue;
    }

    if (instance.alternativeGroupId && instance.weight === "alternative") {
      if (emittedAlternativeGroups.has(instance.alternativeGroupId)) {
        continue;
      }
      emittedAlternativeGroups.add(instance.alternativeGroupId);
    }

    const base = {
      heading: formatRequirementHeading(instance),
      id: instance.alternativeGroupId ?? instance.id,
      kindLabel: requirementKindLabel(instance.kind),
      requirementId: instance.id,
      sourceText: instance.sourceText,
    };

    const evidence =
      instance.kind === "english_proficiency"
        ? englishRequirementRow(applicationData, course, instance)
        : instance.kind === "work_experience"
          ? workExperienceRow(applicationData, instance)
          : statusFromCheck(instance, checkMap.get(instance.alternativeGroupId ?? instance.id), hasTranscriptEvidence);

    rows.push({
      ...base,
      ...evidence,
      statusLabel: programEvidenceStatusCopy[evidence.status],
    });
  }

  return rows;
}

export function getBlockingProgramEvidenceRows(options: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry | null | undefined;
  transcriptAssessment?: TranscriptEligibilityAssessment;
}) {
  return buildProgramEvidenceRows(options).filter((row) => row.isBlocking);
}

function hasMetEnglishRequirement(rows: readonly ProgramEvidenceRow[]) {
  const englishKindLabel = requirementKindLabel("english_proficiency");
  return rows.some((row) => row.kindLabel === englishKindLabel && row.status === "met");
}

function isEnglishMissingInformation(item: string) {
  return ENGLISH_MISSING_INFORMATION_PATTERN.test(item);
}

export function filterResolvedTranscriptMissingInformation(
  missingInformation: readonly string[],
  programEvidenceRows: readonly ProgramEvidenceRow[],
) {
  if (!hasMetEnglishRequirement(programEvidenceRows)) {
    return [...missingInformation];
  }

  return missingInformation.filter((item) => !isEnglishMissingInformation(item));
}

export function shouldShowTranscriptRecommendedNextStep(
  recommendedNextStep: string | undefined,
  visibleMissingInformation: readonly string[],
  programEvidenceRows: readonly ProgramEvidenceRow[],
) {
  const recommendation = recommendedNextStep?.trim();
  if (!recommendation) {
    return false;
  }

  if (
    visibleMissingInformation.length === 0 &&
    hasMetEnglishRequirement(programEvidenceRows) &&
    isEnglishMissingInformation(recommendation)
  ) {
    return false;
  }

  return true;
}
