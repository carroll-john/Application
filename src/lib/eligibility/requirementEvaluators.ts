import { isCountryInAcceptedList } from "./englishMediumCountries.js";
import {
  buildRequirementCheck,
  type AcademicThresholdParams,
  type EnglishProficiencyParams,
  type FieldOfStudyParams,
  type QualificationLevel,
  type RequirementInstance,
  type WorkExperienceParams,
} from "./requirements.js";
import type {
  EligibilityExtractedField,
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types.js";

export interface EvaluationContext {
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
  // Underscores normalize the schema-v2 enum values ("high_school") to the legacy phrases.
  const text = value.toLowerCase().replace(/_/g, " ");
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
  // Normalize underscores so the schema-v2 enum values ("in_progress") match the same phrases as
  // legacy free-text extraction ("in progress").
  const completionText = readFieldText(evidence.studyDetails?.completionStatus)
    ?.toLowerCase()
    .replace(/_/g, " ");
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
      "QUALIFICATION_INCOMPLETE",
    );
  }

  if (indicatesCompleted || completionFromForm === true) {
    return buildRequirementCheck(
      instance,
      "pass",
      "Qualification appears completed based on supplied evidence.",
      "QUALIFICATION_COMPLETE",
    );
  }

  return buildRequirementCheck(
    instance,
    "unknown",
    "Completion status is unclear or not confirmed in transcript evidence.",
    "QUALIFICATION_COMPLETION_UNKNOWN",
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
      "QUALIFICATION_LEVEL_UNKNOWN",
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
    status === "pass" ? "QUALIFICATION_LEVEL_MET" : "QUALIFICATION_LEVEL_BELOW",
    {
      observed: extractedLevel,
      required: instance.params.level.replace("_", " "),
    },
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
        "ACADEMIC_EVIDENCE_MISSING",
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
      status === "pass" ? "WAM_MET" : "WAM_BELOW",
      {
        metric: "wam",
        observed: comparableWam.toFixed(1),
        required: String(params.min),
      },
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
      "ACADEMIC_EVIDENCE_MISSING",
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
    status === "pass" ? "GPA_MET" : "GPA_BELOW",
    {
      metric: "gpa",
      observed: `${comparableGpa.toFixed(2)}/${comparableScale}`,
      required: `${params.min}/${requiredScale}`,
    },
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
          "ENGLISH_OK_COUNTRY",
          { observed: country },
        );
      }
    }
    // english_test pathway evaluation is deferred — we do not currently extract test scores from
    // transcripts. When score evidence is added (separate doc kind), this branch will handle it.
  }

  // An AHPRA registration (Australian Health Practitioner Regulation Agency) requires English
  // proficiency to obtain, so it satisfies the requirement on its own.
  if (context.hasAhpraRegistration) {
    return buildRequirementCheck(
      instance,
      "pass",
      "English language proficiency satisfied by AHPRA registration.",
      "ENGLISH_OK_AHPRA",
    );
  }

  // No country-based pathway matched. If a separate language-tests record exists in the form context,
  // surface that as a hint but mark unknown so admissions can verify.
  if ((context.languageTestsCount ?? 0) > 0) {
    return buildRequirementCheck(
      instance,
      "unknown",
      "Applicant has provided English test evidence elsewhere in the application; verify the test type and score meet the program's accepted pathway.",
      "ENGLISH_TEST_UNVERIFIED",
    );
  }

  return buildRequirementCheck(
    instance,
    "unknown",
    "No English-medium country completion or test evidence available; manual verification required.",
    "ENGLISH_UNVERIFIED",
  );
}

function evaluateWorkExperience(
  instance: Extract<RequirementInstance, { kind: "work_experience" }>,
  { context }: EvaluationContext,
): EligibilityRequirementCheck {
  // Work-experience requirements are not satisfied from transcript evidence alone — they come from
  // CV / employment history extraction, which is a separate document pipeline. We emit "unknown"
  // here so the UI can prompt the user for that evidence rather than silently failing.
  const params = instance.params as WorkExperienceParams;
  const hasEmploymentEvidence = (context.employmentCount ?? 0) > 0 || context.cvUploaded === true;
  return buildRequirementCheck(
    instance,
    "unknown",
    hasEmploymentEvidence
      ? `Requires ${params.minYears}+ years of relevant work experience; employment evidence supplied elsewhere in the application will be verified by admissions.`
      : `Requires ${params.minYears}+ years of relevant work experience; add a CV or employment history as evidence.`,
    "WORK_EXPERIENCE_UNVERIFIED",
    { required: `${params.minYears}+ years` },
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
      "FIELD_PROGRAM_MISSING",
    );
  }

  const matched = params.acceptedAreas.some((area) => programName.includes(area.toLowerCase()));
  return buildRequirementCheck(
    instance,
    matched ? "pass" : "fail",
    matched
      ? `Program name matches an accepted field of study.`
      : `Program name does not match any accepted field of study (${params.acceptedAreas.join(", ")}).`,
    matched ? "FIELD_MATCH" : "FIELD_MISMATCH",
  );
}

/** Dispatches a single requirement instance to its kind-specific evaluator. */
export function evaluateOne(
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
      return evaluateWorkExperience(instance, ctx);
    case "field_of_study":
      return evaluateFieldOfStudy(instance, ctx);
  }
}
