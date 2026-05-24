import { isCountryInAcceptedList } from "./englishMediumCountries";
import {
  buildRequirementCheck,
  type AcademicThresholdParams,
  type EnglishProficiencyParams,
  type FieldOfStudyParams,
  type QualificationLevel,
  type RequirementInstance,
  type WorkExperienceParams,
} from "./requirements";
import type {
  EligibilityExtractedField,
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types";

interface EvaluationContext {
  context: TranscriptEligibilityRequestContext;
  evidence: TranscriptExtractedData;
}

const QUALIFICATION_LEVEL_RANK: Record<QualificationLevel, number> = {
  high_school: 1,
  diploma: 2,
  bachelor: 3,
  honours: 3,
  masters: 4,
  doctorate: 5,
};

function readFieldText(field: EligibilityExtractedField | undefined): string | undefined {
  if (!field) {
    return undefined;
  }
  const value = field.normalizedValue ?? field.originalValue;
  return value?.trim() || undefined;
}

function parseNumberFromText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function classifyQualificationText(value: string | undefined): QualificationLevel | undefined {
  if (!value) {
    return undefined;
  }
  const text = value.toLowerCase();
  if (text.includes("doctor") || text.includes("phd")) {
    return "doctorate";
  }
  if (text.includes("master")) {
    return "masters";
  }
  if (text.includes("honour") || text.includes("honor")) {
    return "honours";
  }
  if (text.includes("bachelor")) {
    return "bachelor";
  }
  if (text.includes("diploma")) {
    return "diploma";
  }
  if (text.includes("secondary") || text.includes("high school") || text.includes("year 12")) {
    return "high_school";
  }
  return undefined;
}

// ---------- Per-kind evaluators ----------

function evaluateQualificationCompleted(
  instance: Extract<RequirementInstance, { kind: "qualification_completed" }>,
  { context, evidence }: EvaluationContext,
): EligibilityRequirementCheck {
  const completionText = readFieldText(evidence.studyDetails?.completionStatus)?.toLowerCase();
  const completionFromForm = context.completed;

  const indicatesNotCompleted =
    completionText?.includes("in progress") ||
    completionText?.includes("not completed") ||
    completionText?.includes("withdrawn");
  const indicatesCompleted =
    completionText?.includes("completed") || completionText?.includes("conferred");

  if (indicatesNotCompleted || completionFromForm === false) {
    return buildRequirementCheck(
      instance,
      "fail",
      "Qualification appears incomplete or withdrawn based on supplied evidence.",
    );
  }

  if (indicatesCompleted || completionFromForm === true) {
    return buildRequirementCheck(
      instance,
      "pass",
      "Qualification appears completed based on supplied evidence.",
    );
  }

  return buildRequirementCheck(
    instance,
    "unknown",
    "Completion status is unclear or not confirmed in transcript evidence.",
  );
}

function evaluateQualificationLevel(
  instance: Extract<RequirementInstance, { kind: "qualification_level" }>,
  { context, evidence }: EvaluationContext,
): EligibilityRequirementCheck {
  const requiredRank = QUALIFICATION_LEVEL_RANK[instance.params.level];
  const extractedLevel =
    readFieldText(evidence.studyDetails?.highestEducationLevel) ?? context.level;
  const extractedKind = classifyQualificationText(extractedLevel);

  if (!extractedKind || requiredRank === undefined) {
    return buildRequirementCheck(
      instance,
      "unknown",
      "Qualification level could not be mapped from transcript evidence.",
    );
  }

  const extractedRank = QUALIFICATION_LEVEL_RANK[extractedKind];
  const status: EligibilityRequirementStatus =
    extractedRank >= requiredRank ? "pass" : "fail";

  return buildRequirementCheck(
    instance,
    status,
    status === "pass"
      ? `Extracted level "${extractedLevel}" meets the required ${instance.params.level.replace("_", " ")} level.`
      : `Extracted level "${extractedLevel}" is below the required ${instance.params.level.replace("_", " ")} level.`,
  );
}

function evaluateAcademicThreshold(
  instance: Extract<RequirementInstance, { kind: "academic_threshold" }>,
  { evidence }: EvaluationContext,
): EligibilityRequirementCheck {
  const params = instance.params as AcademicThresholdParams;
  const wamValue = parseNumberFromText(
    readFieldText(evidence.academicPerformance?.gradeAverageOrWam),
  );
  const gpaValue = parseNumberFromText(readFieldText(evidence.academicPerformance?.gpa));
  const gpaScale = parseNumberFromText(readFieldText(evidence.academicPerformance?.gpaScale));

  if (params.metric === "wam") {
    let comparableWam: number | undefined = wamValue;
    let explanationLead = "";
    if (comparableWam === undefined && gpaValue !== undefined && gpaScale !== undefined && gpaScale > 0) {
      comparableWam = (gpaValue / gpaScale) * 100;
      explanationLead = `Mapped GPA ${gpaValue}/${gpaScale} to approximately ${comparableWam.toFixed(1)}% WAM. `;
    }

    if (comparableWam === undefined) {
      return buildRequirementCheck(
        instance,
        "unknown",
        "No usable WAM or GPA evidence was extracted from the transcript.",
      );
    }

    const status: EligibilityRequirementStatus = comparableWam >= params.min ? "pass" : "fail";
    return buildRequirementCheck(
      instance,
      status,
      `${explanationLead}${
        status === "pass"
          ? `WAM ${comparableWam.toFixed(1)} meets minimum WAM ${params.min}.`
          : `WAM ${comparableWam.toFixed(1)} is below minimum WAM ${params.min}.`
      }`,
    );
  }

  // params.metric === "gpa"
  const requiredScale = params.scale ?? gpaScale;
  let comparableGpa: number | undefined = gpaValue;
  let comparableScale: number | undefined = gpaScale ?? requiredScale;
  let explanationLead = "";

  if (comparableGpa === undefined && wamValue !== undefined && typeof requiredScale === "number") {
    comparableGpa = (wamValue / 100) * requiredScale;
    comparableScale = requiredScale;
    explanationLead = `Mapped WAM ${wamValue.toFixed(1)}% to approximately GPA ${comparableGpa.toFixed(2)}/${requiredScale}. `;
  }

  if (
    comparableGpa === undefined ||
    comparableScale === undefined ||
    comparableScale <= 0 ||
    requiredScale === undefined
  ) {
    return buildRequirementCheck(
      instance,
      "unknown",
      "No usable GPA or WAM evidence was extracted from the transcript.",
    );
  }

  const normalizedExtracted = comparableGpa / comparableScale;
  const normalizedRequired = params.min / requiredScale;
  const status: EligibilityRequirementStatus =
    normalizedExtracted >= normalizedRequired ? "pass" : "fail";

  return buildRequirementCheck(
    instance,
    status,
    `${explanationLead}${
      status === "pass"
        ? `GPA ${comparableGpa.toFixed(2)}/${comparableScale} meets minimum GPA ${params.min}/${requiredScale}.`
        : `GPA ${comparableGpa.toFixed(2)}/${comparableScale} is below minimum GPA ${params.min}/${requiredScale}.`
    }`,
  );
}

function evaluateEnglishProficiency(
  instance: Extract<RequirementInstance, { kind: "english_proficiency" }>,
  { context, evidence }: EvaluationContext,
): EligibilityRequirementCheck {
  const params = instance.params as EnglishProficiencyParams;
  const country =
    readFieldText(evidence.applicantDetails?.countryOfInstitution) ?? context.country;

  for (const pathway of params.acceptedPathways) {
    if (pathway.type === "completion_in_country") {
      if (isCountryInAcceptedList(country, pathway.countries)) {
        return buildRequirementCheck(
          instance,
          "pass",
          `English language proficiency satisfied by completion at an institution in ${country}.`,
        );
      }
    }
    // english_test pathway evaluation is deferred — we do not currently extract test scores from
    // transcripts. When score evidence is added (separate doc kind), this branch will handle it.
  }

  // No country-based pathway matched. If a separate language-tests record exists in the form context,
  // surface that as a hint but mark unknown so admissions can verify.
  if ((context.languageTestsCount ?? 0) > 0) {
    return buildRequirementCheck(
      instance,
      "unknown",
      "Applicant has provided English test evidence elsewhere in the application; verify the test type and score meet the program's accepted pathway.",
    );
  }

  return buildRequirementCheck(
    instance,
    "unknown",
    "No English-medium country completion or test evidence available; manual verification required.",
  );
}

function evaluateWorkExperience(
  instance: Extract<RequirementInstance, { kind: "work_experience" }>,
): EligibilityRequirementCheck {
  // Work-experience requirements are not satisfied from transcript evidence alone — they come from
  // CV / employment history extraction, which is a separate document pipeline. We emit "unknown"
  // here so the UI can prompt the user for that evidence rather than silently failing.
  const params = instance.params as WorkExperienceParams;
  return buildRequirementCheck(
    instance,
    "unknown",
    `Requires ${params.minYears}+ years of relevant work experience; transcript evidence alone cannot confirm this.`,
  );
}

function evaluateFieldOfStudy(
  instance: Extract<RequirementInstance, { kind: "field_of_study" }>,
  { evidence }: EvaluationContext,
): EligibilityRequirementCheck {
  const params = instance.params as FieldOfStudyParams;
  const programName = readFieldText(evidence.studyDetails?.programName)?.toLowerCase();

  if (!programName) {
    return buildRequirementCheck(
      instance,
      "unknown",
      "Program name could not be extracted from the transcript.",
    );
  }

  const matched = params.acceptedAreas.some((area) => programName.includes(area.toLowerCase()));
  return buildRequirementCheck(
    instance,
    matched ? "pass" : "fail",
    matched
      ? `Program name matches an accepted field of study.`
      : `Program name does not match any accepted field of study (${params.acceptedAreas.join(", ")}).`,
  );
}

function evaluateOne(
  instance: RequirementInstance,
  ctx: EvaluationContext,
): EligibilityRequirementCheck {
  switch (instance.kind) {
    case "qualification_completed":
      return evaluateQualificationCompleted(instance, ctx);
    case "qualification_level":
      return evaluateQualificationLevel(instance, ctx);
    case "academic_threshold":
      return evaluateAcademicThreshold(instance, ctx);
    case "english_proficiency":
      return evaluateEnglishProficiency(instance, ctx);
    case "work_experience":
      return evaluateWorkExperience(instance);
    case "field_of_study":
      return evaluateFieldOfStudy(instance, ctx);
  }
}

/**
 * Folds an alternative group (multiple requirements that share an alternativeGroupId) into a single
 * check. Status is the strongest result across the group: pass beats unknown beats fail.
 */
function foldAlternativeGroup(
  groupId: string,
  group: ReadonlyArray<{ instance: RequirementInstance; check: EligibilityRequirementCheck }>,
): EligibilityRequirementCheck {
  const passEntry = group.find((entry) => entry.check.status === "pass");
  if (passEntry) {
    return {
      id: `${groupId}:satisfied`,
      requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
      status: "pass",
      explanation: `One alternative satisfied: ${passEntry.check.explanation}`,
    };
  }

  const unknownEntry = group.find((entry) => entry.check.status === "unknown");
  if (unknownEntry) {
    return {
      id: `${groupId}:unknown`,
      requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
      status: "unknown",
      explanation: `No alternative confirmed. ${unknownEntry.check.explanation}`,
    };
  }

  return {
    id: `${groupId}:failed`,
    requirement: group.map((entry) => entry.instance.sourceText).join(" — OR — "),
    status: "fail",
    explanation: "None of the listed alternatives was satisfied by the supplied evidence.",
  };
}

/**
 * Pure function: given a course's requirement instances and the applicant's extracted evidence (plus
 * the request context as a fallback for form-level values), produce exactly one check per requirement.
 *
 * Requirements sharing an `alternativeGroupId` are folded into a single OR-check that emits in place
 * of the first member of the group.
 */
export function evaluateRequirements(
  instances: readonly RequirementInstance[],
  evidence: TranscriptExtractedData,
  context: TranscriptEligibilityRequestContext,
): EligibilityRequirementCheck[] {
  const evalCtx: EvaluationContext = { context, evidence };

  // Group by alternativeGroupId, preserving first-occurrence order for groups.
  const groupOrder: string[] = [];
  const groups = new Map<
    string,
    Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }>
  >();
  const standalone: Array<{ instance: RequirementInstance; check: EligibilityRequirementCheck }> = [];

  for (const instance of instances) {
    const check = evaluateOne(instance, evalCtx);
    if (instance.alternativeGroupId) {
      const key = instance.alternativeGroupId;
      if (!groups.has(key)) {
        groups.set(key, []);
        groupOrder.push(key);
      }
      groups.get(key)!.push({ instance, check });
    } else {
      standalone.push({ instance, check });
    }
  }

  // Emit in input order: when we hit the first member of a group, emit the folded result; skip later
  // members of that same group.
  const emittedGroups = new Set<string>();
  const out: EligibilityRequirementCheck[] = [];

  for (const instance of instances) {
    if (instance.alternativeGroupId) {
      if (emittedGroups.has(instance.alternativeGroupId)) {
        continue;
      }
      emittedGroups.add(instance.alternativeGroupId);
      const group = groups.get(instance.alternativeGroupId);
      if (group && group.length > 0) {
        out.push(foldAlternativeGroup(instance.alternativeGroupId, group));
      }
    } else {
      const entry = standalone.find((item) => item.instance.id === instance.id);
      if (entry) {
        out.push(entry.check);
      }
    }
  }

  return out;
}

/**
 * Aggregates per-requirement check statuses into an overall eligibility outcome.
 * Mirrors the precedence used in deterministicRules.ts so the legacy and new paths produce consistent
 * outcome semantics during the migration.
 */
export function aggregateOutcome(checks: ReadonlyArray<EligibilityRequirementCheck>): {
  outcome: "eligible" | "ineligible" | "insufficient_data";
  manualReviewRequired: boolean;
} {
  if (checks.some((check) => check.status === "fail")) {
    return { outcome: "ineligible", manualReviewRequired: false };
  }
  if (checks.some((check) => check.status === "unknown")) {
    return { outcome: "insufficient_data", manualReviewRequired: true };
  }
  return { outcome: "eligible", manualReviewRequired: false };
}
