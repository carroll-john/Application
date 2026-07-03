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
  formatQualificationLevel,
  requirementKindLabel,
  type QualificationLevel,
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
  /** Bullet points to render instead of `explanation` when set (e.g. the merged transcript card). */
  explanationItems?: string[];
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
const cvPath = "/section2/add-cv?from=review";

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
 * The qualification level to summarize for a `qualification_completed`/`qualification_level`
 * card. `qualification_completed` params never carry a level (see `QualificationCompletedParams`),
 * so when the rendered instance is the "completed" side of a deduped pair
 * (`shouldSkipPairedQualificationLevel`), look up the level from its sibling
 * `qualification_level` instance in the same course's requirement list.
 */
function findQualificationLevel(
  instance: RequirementInstance,
  requirements: readonly RequirementInstance[],
): QualificationLevel | undefined {
  if (instance.kind === "qualification_level") {
    return instance.params.level;
  }

  if (instance.kind === "qualification_completed") {
    return requirements.find((candidate) => candidate.kind === "qualification_level")?.params
      .level;
  }

  return undefined;
}

/**
 * Short, non-duplicated card title. Requirement sourceText is the verbatim published sentence,
 * which is often a compound clause that restates another requirement's wording (e.g. a GPA
 * requirement repeating the qualification-level sentence just to append the GPA figure, or
 * several requirements sharing one un-split published sentence) — build a heading from each
 * requirement's structured params instead.
 */
function formatRequirementHeading(
  instance: RequirementInstance,
  requirements: readonly RequirementInstance[],
): string {
  if (instance.kind === "academic_threshold") {
    return `Minimum ${formatAcademicThreshold(instance.params)}`;
  }

  if (instance.kind === "field_of_study") {
    return `Accepted fields: ${formatFieldOfStudyAreas(instance.params)}`;
  }

  if (instance.kind === "work_experience") {
    return "Relevant Work Experience";
  }

  if (instance.kind === "english_proficiency") {
    return requirementKindLabel("english_proficiency");
  }

  const level = findQualificationLevel(instance, requirements);
  return level ? formatQualificationLevel(level) : instance.sourceText;
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
    actionLabel: "Add CV",
    actionPath: cvPath,
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
      heading: formatRequirementHeading(instance, requirements),
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

const TRANSCRIPT_VERIFIABLE_KIND_LABELS = new Set([
  requirementKindLabel("qualification_completed"),
  requirementKindLabel("qualification_level"),
  requirementKindLabel("academic_threshold"),
  requirementKindLabel("english_proficiency"),
  requirementKindLabel("field_of_study"),
]);

const transcriptGroupPhrases: Record<string, string> = {
  [requirementKindLabel("qualification_completed")]: "your qualification",
  [requirementKindLabel("qualification_level")]: "your qualification",
  [requirementKindLabel("academic_threshold")]: "your academic result",
  [requirementKindLabel("english_proficiency")]: "your English language proficiency",
  [requirementKindLabel("field_of_study")]: "your field of study",
};

const FIELD_OF_STUDY_KIND_LABEL = requirementKindLabel("field_of_study");

/**
 * Qualification, academic threshold, English proficiency, and field of study can all be verified
 * from the same uploaded transcript, so when two or more of them still need evidence, collapse
 * them into a single "Add transcript" card instead of one card per requirement. Rows that are
 * already met, or that aren't transcript-verifiable (work experience), pass through unchanged.
 *
 * This only changes what's rendered as cards -- callers that need the true per-requirement
 * breakdown (transcript feedback, Review & Submit's missing-field list) should keep using
 * `buildProgramEvidenceRows`'s ungrouped output directly.
 */
export function groupTranscriptVerifiableEvidenceRows(
  rows: readonly ProgramEvidenceRow[],
): ProgramEvidenceRow[] {
  const groupable = rows.filter(
    (row) => row.isBlocking && TRANSCRIPT_VERIFIABLE_KIND_LABELS.has(row.kindLabel),
  );

  if (groupable.length < 2) {
    return [...rows];
  }

  const groupableIds = new Set(groupable.map((row) => row.id));
  const phrases = [
    ...new Set(
      groupable
        .map((row) => transcriptGroupPhrases[row.kindLabel])
        .filter((phrase): phrase is string => Boolean(phrase)),
    ),
  ];
  const acceptedFieldsRow = groupable.find((row) => row.kindLabel === FIELD_OF_STUDY_KIND_LABEL);
  const acceptedFieldsSuffix = acceptedFieldsRow
    ? ` (${acceptedFieldsRow.heading.replace(/^Accepted fields:\s*/, "Accepted: ")})`
    : "";
  const explanationItems = phrases.map((phrase) => {
    const capitalized = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return phrase === "your field of study" ? `${capitalized}${acceptedFieldsSuffix}` : capitalized;
  });
  const explanation = `Add your transcript to verify ${new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(phrases)}.${acceptedFieldsRow ? ` ${acceptedFieldsRow.heading}.` : ""}`;
  const mergedRow: ProgramEvidenceRow = {
    actionLabel: "Add transcript",
    actionPath: groupable.find((row) => row.actionPath)?.actionPath ?? tertiaryPath,
    explanation,
    explanationItems,
    heading: "Academic transcript",
    id: "transcript-group",
    isBlocking: true,
    kindLabel: "",
    requirementId: "transcript-group",
    sourceText: "Academic transcript",
    status: "needs_evidence",
    statusLabel: programEvidenceStatusCopy.needs_evidence,
  };

  const result: ProgramEvidenceRow[] = [];
  let mergedInserted = false;
  for (const row of rows) {
    if (!groupableIds.has(row.id)) {
      result.push(row);
      continue;
    }
    if (!mergedInserted) {
      result.push(mergedRow);
      mergedInserted = true;
    }
  }
  return result;
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
