import type { ApplicationData } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { isSubmissionReadyDocument } from "../documentAttachment";
import {
  buildRequirementCheckMap,
  classifyEnglishProficiencyEvidence,
  classifyTranscriptCheckEvidence,
  classifyWorkExperienceEvidence,
  type ProgramEvidenceClassification,
  type ProgramEvidenceStatus,
} from "./programEvidenceClassification";
import {
  ALL_REQUIREMENT_KINDS,
  formatAcademicThreshold,
  formatFieldOfStudyAreas,
  formatQualificationLevel,
  requirementKindLabel,
  type QualificationLevel,
  type RequirementInstance,
} from "./requirements";
import { requirementCheckDisplayCopy } from "./checkCopy";
import {
  findPairedQualificationLevel,
  formatMergedQualificationHeading,
  formatRequirementDetailText,
  shouldOmitPairedQualificationCompleted,
} from "./requirementPresentation";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  RequirementReasonCode,
  TranscriptEligibilityAssessment,
} from "./types";

export type { ProgramEvidenceStatus } from "./programEvidenceClassification";

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
  /** This row identifies the entry route used to start the application. */
  isEntryPathway?: boolean;
  kindLabel: string;
  /** This requirement already includes proof that the qualification was completed. */
  requiresCompletedQualification?: boolean;
  /** Durable machine reason behind `requirementStatus`, when a transcript check produced it. */
  reasonCode?: RequirementReasonCode;
  requirementId: string;
  requirementStatus?: EligibilityRequirementStatus;
  /** Verbatim published requirement sentence — kept for feedback/validation traceability. */
  sourceText: string;
  status: ProgramEvidenceStatus;
  statusLabel: string;
}

export const programEvidenceStatusCopy: Record<ProgramEvidenceStatus, string> = {
  met: "Met",
  provisionally_met: "Appears to meet",
  needs_details: "Add details",
  needs_evidence: "Add evidence",
  needs_review: "Needs review",
  possible_alternative: "Possible alternative",
};

const tertiaryPath = "/section2/add-tertiary?from=review";
const employmentPath = "/section2/add-employment?from=review";
const languagePath = "/section2/add-language-test?from=review";
const cvPath = "/section2/add-cv?from=review";

function shouldSkipPairedQualificationCompleted(
  requirements: readonly RequirementInstance[],
  instance: RequirementInstance,
) {
  return shouldOmitPairedQualificationCompleted(requirements, instance);
}

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

  if (instance.kind === "qualification_completed") {
    const levelPartner = findPairedQualificationLevel(requirements, instance);
    if (levelPartner) {
      return formatMergedQualificationHeading(levelPartner.params.level);
    }
    return requirementKindLabel("qualification_completed");
  }

  const level = findQualificationLevel(instance, requirements);
  return level ? formatQualificationLevel(level) : instance.sourceText;
}

function withEvidenceActions(
  classification: ProgramEvidenceClassification,
  actions: Pick<ProgramEvidenceRow, "actionLabel" | "actionPath">,
): Pick<
  ProgramEvidenceRow,
  "actionLabel" | "actionPath" | "explanation" | "isBlocking" | "reasonCode" | "requirementStatus" | "status"
> {
  return {
    ...classification,
    ...actions,
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
  const classification = classifyEnglishProficiencyEvidence({
    applicationData: data,
    course,
    instance,
  });

  if (classification.status === "met") {
    return classification;
  }

  const firstLanguageTest = data.languageTests[0];
  if (firstLanguageTest) {
    return withEvidenceActions(classification, {
      actionLabel: "Update English test",
      actionPath: `/section2/edit-language-test/${firstLanguageTest.id}?from=review`,
    });
  }

  const firstAhpraLikeAccreditation = data.professionalAccreditations.find((accreditation) =>
    /ahpra|registered/i.test(accreditation.name),
  );
  if (firstAhpraLikeAccreditation && classification.status === "needs_details") {
    return withEvidenceActions(classification, {
      actionLabel: "Update registration",
      actionPath: `/section2/edit-accreditation/${firstAhpraLikeAccreditation.id}?from=review`,
    });
  }

  return withEvidenceActions(classification, {
    actionLabel: "Add English evidence",
    actionPath: languagePath,
  });
}

function workExperienceRow(
  data: ApplicationData,
  instance: Extract<RequirementInstance, { kind: "work_experience" }>,
): Pick<
  ProgramEvidenceRow,
  "actionLabel" | "actionPath" | "explanation" | "isBlocking" | "status"
> {
  const classification = classifyWorkExperienceEvidence({ applicationData: data, instance });
  const assessment = data.workExperienceAssessments[instance.id];

  if (classification.status === "met" || classification.status === "provisionally_met") {
    return classification;
  }

  if (data.employmentExperiences.length > 0) {
    const roleId = assessment?.roleAssessments.find(
      (role) => role.relevanceStatus !== "not_demonstrated",
    )?.employmentExperienceId ?? data.employmentExperiences[0]?.id;
    return withEvidenceActions(classification, {
      actionLabel: "Review employment",
      actionPath: roleId ? `/section2/edit-employment/${roleId}?from=review` : employmentPath,
    });
  }

  if (data.cvUploaded && data.employmentExperiences.length === 0) {
    return withEvidenceActions(classification, {
      actionLabel: "Add employment experience",
      actionPath: employmentPath,
    });
  }

  return withEvidenceActions(classification, {
    actionLabel: "Add CV",
    actionPath: cvPath,
  });
}

function statusFromCheck(
  instance: RequirementInstance,
  check: EligibilityRequirementCheck | undefined,
  hasTranscriptEvidence: boolean,
): Pick<
  ProgramEvidenceRow,
  | "actionLabel"
  | "actionPath"
  | "explanation"
  | "isBlocking"
  | "reasonCode"
  | "requirementStatus"
  | "status"
> {
  const classification = classifyTranscriptCheckEvidence({
    check,
    hasTranscriptEvidence,
    instance,
  });

  if (classification.status === "met" || classification.status === "needs_review") {
    if (classification.isBlocking) {
      return withEvidenceActions(classification, {
        actionLabel: "Review qualification",
        actionPath: tertiaryPath,
      });
    }
    return classification;
  }

  if (classification.status === "possible_alternative") {
    return withEvidenceActions(classification, {
      actionLabel: "Add CV",
      actionPath: cvPath,
    });
  }

  return withEvidenceActions(classification, {
    actionLabel: classification.isBlocking ? "Add transcript" : "Review qualification",
    actionPath: tertiaryPath,
  });
}

export function buildProgramEvidenceRows(options: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry | null | undefined;
  transcriptAssessment?: TranscriptEligibilityAssessment;
}): ProgramEvidenceRow[] {
  const { applicationData, course, transcriptAssessment } = options;
  const allRequirements = course?.requirements ?? [];
  const selectedPathwayId = transcriptAssessment?.selectedPathwayId;
  const requirements = selectedPathwayId
    ? allRequirements.filter(
        (requirement) =>
          !requirement.pathwayBundleId || requirement.pathwayBundleId === selectedPathwayId,
      )
    : allRequirements;
  if (!course || requirements.length === 0) {
    return [];
  }

  const checkMap = buildRequirementCheckMap(transcriptAssessment?.requirementsChecked ?? []);
  const hasTranscriptEvidence = applicationData.tertiaryQualifications.some((qualification) =>
    isSubmissionReadyDocument(qualification.transcriptDocument),
  );

  const rows: Array<{ kind: RequirementInstance["kind"]; row: ProgramEvidenceRow }> = [];
  const emittedAlternativeGroups = new Set<string>();

  for (const instance of requirements) {
    if (shouldSkipPairedQualificationCompleted(requirements, instance)) {
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
      requiresCompletedQualification:
        instance.kind === "qualification_completed" ||
        (instance.kind === "qualification_level" && instance.params.completedRequired === true),
      requirementId: instance.id,
      sourceText: formatRequirementDetailText(instance, requirements),
    };

    const evidence =
      instance.kind === "english_proficiency"
        ? englishRequirementRow(applicationData, course, instance)
        : instance.kind === "work_experience"
          ? workExperienceRow(applicationData, instance)
          : statusFromCheck(instance, checkMap.get(instance.alternativeGroupId ?? instance.id), hasTranscriptEvidence);

    rows.push({
      kind: instance.kind,
      row: {
        ...base,
        ...evidence,
        statusLabel: programEvidenceStatusCopy[evidence.status],
      },
    });
  }

  const kindOrder = new Map(ALL_REQUIREMENT_KINDS.map((kind, index) => [kind, index]));
  return rows
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => (kindOrder.get(a.kind) ?? 0) - (kindOrder.get(b.kind) ?? 0) || a.index - b.index)
    .map((entry) => entry.row);
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
const ENGLISH_PROFICIENCY_KIND_LABEL = requirementKindLabel("english_proficiency");

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
  const explanationItems = phrases.map(
    (phrase) => phrase.charAt(0).toUpperCase() + phrase.slice(1),
  );

  // Fold an already-satisfied English proficiency row into the transcript card as an extra
  // bullet instead of rendering it as its own separate "met" card below.
  const satisfiedEnglishRow = rows.find(
    (row) => row.kindLabel === ENGLISH_PROFICIENCY_KIND_LABEL && row.status === "met",
  );
  if (satisfiedEnglishRow) {
    explanationItems.push("Your English language proficiency");
    groupableIds.add(satisfiedEnglishRow.id);
  }
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

/**
 * Alternative entry pathways (e.g. two different bachelor-level routes into a program) each
 * produce their own `qualification_level` requirement instance, so the same heading (e.g.
 * "Bachelor degree or higher") can appear more than once in `buildProgramEvidenceRows`'s output.
 * Collapse those to a single row/button per heading, keeping the first occurrence.
 */
export function dedupeProgramEvidenceRowsByHeading(
  rows: readonly ProgramEvidenceRow[],
): ProgramEvidenceRow[] {
  const seenHeadings = new Set<string>();
  const result: ProgramEvidenceRow[] = [];
  for (const row of rows) {
    if (seenHeadings.has(row.heading)) {
      continue;
    }
    seenHeadings.add(row.heading);
    result.push(row);
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

/**
 * Kind labels for the legacy deterministic engine's synthetic check ids, so check-derived rows
 * participate in the same kind-based rules as catalog rows (e.g. suppressing the extracted
 * "Academic result from transcript" row when a WAM/GPA threshold card is present).
 */
const deterministicCheckKindLabels: Record<string, string> = {
  "deterministic-completion": requirementKindLabel("qualification_completed"),
  "deterministic-english-proficiency": requirementKindLabel("english_proficiency"),
  "deterministic-qualification-level": requirementKindLabel("qualification_level"),
  "deterministic-wam-gpa-threshold": requirementKindLabel("academic_threshold"),
};

/**
 * Display rows for courses with no published matcher-safe requirements. Those courses are
 * evaluated by the legacy deterministic engine, whose checks carry synthetic ids
 * (`deterministic-*`) that match no catalog requirement instance — so `buildProgramEvidenceRows`
 * returns nothing for them and passing evidence would otherwise render no "Met" cards at all.
 * Build rows straight from the assessment's own checks instead, mirroring `statusFromCheck`'s
 * status mapping.
 */
export function buildAssessmentCheckEvidenceRows(
  assessment: TranscriptEligibilityAssessment,
): ProgramEvidenceRow[] {
  const completionCheck = assessment.requirementsChecked.find(
    (check) => check.id === "deterministic-completion",
  );
  const incompleteOrUnconfirmedQualification = Boolean(
    completionCheck && completionCheck.status !== "pass",
  );

  return assessment.requirementsChecked.flatMap((check): ProgramEvidenceRow[] => {
    // The legacy deterministic route emits qualification level and completion as separate checks.
    // A bachelor-level label is not a completed bachelor pathway, so do not show the level as met
    // when the paired completion check says the award is incomplete or cannot be confirmed.
    if (
      check.id === "deterministic-qualification-level" &&
      check.status === "pass" &&
      incompleteOrUnconfirmedQualification
    ) {
      return [];
    }

    const base = {
      explanation: requirementCheckDisplayCopy(check),
      heading: check.requirement,
      id: check.id,
      kindLabel: deterministicCheckKindLabels[check.id] ?? "",
      reasonCode: check.reasonCode,
      requirementId: check.id,
      requirementStatus: check.status,
      sourceText: check.requirement,
    };

    if (check.status === "pass") {
      return [{
        ...base,
        isBlocking: false,
        status: "met",
        statusLabel: programEvidenceStatusCopy.met,
      }];
    }

    // A service outage isn't something the applicant can fix by editing their qualification;
    // it falls through to the non-blocking manual-review row below.
    if (check.status === "unknown" && check.reasonCode !== "SERVICE_UNAVAILABLE") {
      return [{
        ...base,
        actionLabel: "Review qualification",
        actionPath: tertiaryPath,
        isBlocking: true,
        status: "needs_details",
        statusLabel: programEvidenceStatusCopy.needs_details,
      }];
    }

    return [{
      ...base,
      isBlocking: false,
      status: "needs_review",
      statusLabel: programEvidenceStatusCopy.needs_review,
    }];
  });
}

export interface TranscriptReviewSummary {
  headerLine: string;
  headerTone: "success" | "warning";
  manualReviewNeeded: boolean;
  /** Bullets for the "Missing or unclear information" box; one per blocking row. */
  missingItems: string[];
  /** Single sentence for the "Recommended next step" line; undefined when nothing is pending. */
  nextStep?: string;
}

/**
 * Derives the panel's summary surfaces (header line, missing-information bullets, recommended
 * next step, manual-review flag) from the same evidence rows that render the requirement cards.
 * Because everything is computed from one row list, the header can never disagree with the cards
 * and a "met" card can never produce a missing-information bullet — consistency by construction.
 *
 * Note this intentionally ignores the assessment's own `outcome`, `confidence`,
 * `missingInformation`, and `recommendedNextStep` fields: those describe only what the server saw,
 * while the rows also reconcile live application data (CV, English tests, AHPRA).
 */
export function buildTranscriptReviewSummary(
  displayRows: readonly ProgramEvidenceRow[],
): TranscriptReviewSummary {
  const blockingRows = displayRows.filter((row) => row.isBlocking);

  const headerLine =
    blockingRows.length === 0
      ? "Transcript reviewed — the program evidence requirements look satisfied."
      : `Transcript reviewed — ${blockingRows.length} item${
          blockingRows.length === 1 ? "" : "s"
        } still need${blockingRows.length === 1 ? "s" : ""} evidence or details.`;

  const missingItems = blockingRows.map((row) => `${row.heading} — ${row.statusLabel}`);

  const actionLabels = [
    ...new Set(
      blockingRows
        .map((row) => row.actionLabel)
        .filter((label): label is string => Boolean(label)),
    ),
  ];
  const nextStep =
    actionLabels.length > 0
      ? `${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
          actionLabels,
        )}.`
      : undefined;

  return {
    headerLine,
    headerTone: blockingRows.length === 0 ? "success" : "warning",
    manualReviewNeeded: displayRows.some((row) => row.status === "needs_review"),
    missingItems,
    nextStep,
  };
}
