import type {
  ApplicationData,
  LanguageTest,
  ProfessionalAccreditation,
  TertiaryQualification,
} from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { isSubmissionReadyDocument } from "../documentAttachment";
import {
  DEFAULT_ENGLISH_MEDIUM_COUNTRIES,
  isCountryInAcceptedList,
} from "./englishMediumCountries";
import type { EnglishPathway, RequirementInstance } from "./requirements";

/**
 * Helpers for the two conditional ("optional hard") submission requirements:
 *
 * - **Certificate of Completion** — needed only when a qualification is marked
 *   completed but its transcript can't evidence that completion. If the transcript
 *   already states completion, no certificate is required.
 * - **English proficiency** — needed only when the course requires it AND it can't be
 *   inferred from a transcript (study at an English-medium-country institution). It can
 *   be satisfied by an English test OR an AHPRA registration.
 */

/**
 * AHPRA (Australian Health Practitioner Regulation Agency) registrations are accepted
 * as English-proficiency evidence. Recognised from the free-text accreditation name —
 * either an explicit AHPRA mention or a registered health-practitioner title.
 */
const AHPRA_REGISTRATION_PATTERN =
  /\bahpra\b|australian health practitioner|nursing and midwifery board|medical board of australia|dental board of australia|registered\s+(nurse|midwife|midwifery|medical practitioner|pharmacist|physiotherapist|psychologist|dentist|optometrist|paramedic|occupational therapist|chiropractor|osteopath|podiatrist|radiographer)/i;

export function isAhpraRegistration(name: string | undefined): boolean {
  return Boolean(name && AHPRA_REGISTRATION_PATTERN.test(name));
}

export function hasAhpraRegistration(
  accreditations: ProfessionalAccreditation[],
): boolean {
  return accreditations.some((accreditation) => isAhpraRegistration(accreditation.name));
}

export function hasCurrentAhpraRegistrationEvidence(
  accreditations: ProfessionalAccreditation[],
): boolean {
  return accreditations.some(
    (accreditation) =>
      isAhpraRegistration(accreditation.name) &&
      accreditation.status.toLowerCase() === "active" &&
      isSubmissionReadyDocument(accreditation.document),
  );
}

/** Transcript wording that indicates the qualification was completed / conferred. */
const COMPLETION_PATTERN =
  /complet|graduat|conferred|award(ed)?|finished|passed|degree (awarded|granted)/i;

/** True when the parsed transcript states the qualification was completed. */
export function transcriptConfirmsCompletion(
  qualification: TertiaryQualification,
): boolean {
  const status =
    qualification.transcriptEligibility?.extractedData.studyDetails?.completionStatus;
  if (status) {
    const value = status.normalizedValue ?? status.originalValue ?? "";
    return COMPLETION_PATTERN.test(value);
  }
  // No in-memory assessment (e.g. a draft reloaded from the store) — fall back to
  // the persisted snapshot of the transcript's completion signal.
  return Boolean(qualification.transcriptCompletionConfirmed);
}

export function getEnglishProficiencyRequirements(
  course: CourseCatalogEntry | null | undefined,
): Array<Extract<RequirementInstance, { kind: "english_proficiency" }>> {
  return (
    course?.requirements?.filter(
      (
        requirement,
      ): requirement is Extract<RequirementInstance, { kind: "english_proficiency" }> =>
        requirement.kind === "english_proficiency",
    ) ?? []
  );
}

export function getAcceptedEnglishCompletionCountries(
  course: CourseCatalogEntry | null | undefined,
) {
  const countrySets = getEnglishProficiencyRequirements(course).flatMap((requirement) =>
    requirement.params.acceptedPathways.flatMap((pathway) =>
      pathway.type === "completion_in_country" ? pathway.countries : [],
    ),
  );

  return countrySets.length > 0 ? countrySets : DEFAULT_ENGLISH_MEDIUM_COUNTRIES;
}

/** True when a qualification was studied at an accepted English-medium-country institution. */
export function isEnglishMediumQualification(
  qualification: TertiaryQualification,
  course?: CourseCatalogEntry | null,
): boolean {
  return isCountryInAcceptedList(
    qualification.country,
    getAcceptedEnglishCompletionCountries(course),
  );
}

/** English can be inferred when any qualification was studied in an English-medium country. */
export function isEnglishInferableFromTranscripts(
  data: ApplicationData,
  course?: CourseCatalogEntry | null,
): boolean {
  return data.tertiaryQualifications.some((qualification) =>
    isEnglishMediumQualification(qualification, course),
  );
}

type EnglishTestPathway = Extract<EnglishPathway, { type: "english_test" }>;

function parseScore(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTestType(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function languageTestMatchesPathway(test: LanguageTest, pathway: EnglishTestPathway) {
  const type = normalizeTestType(test.type);
  const name = normalizeTestType(test.name);
  const accepted =
    pathway.test === "TOEFL_iBT"
      ? ["toefl", "toeflibt"]
      : pathway.test === "PTE"
        ? ["pte", "pteacademic"]
        : pathway.test === "CAE"
          ? ["cambridge", "cambridgeenglish", "cae", "c1advanced"]
          : [normalizeTestType(pathway.test)];

  return accepted.some((candidate) => type.includes(candidate) || name.includes(candidate));
}

export function languageTestSatisfiesPathway(
  test: LanguageTest,
  pathway: EnglishTestPathway,
): boolean {
  if (!languageTestMatchesPathway(test, pathway)) {
    return false;
  }

  if (!isSubmissionReadyDocument(test.document)) {
    return false;
  }

  const overall = parseScore(test.overallScore);
  if (overall === undefined || overall < pathway.minOverall) {
    return false;
  }

  const minBand = pathway.minBand;
  if (typeof minBand !== "number") {
    return true;
  }

  const componentScores = [
    parseScore(test.listeningScore),
    parseScore(test.readingScore),
    parseScore(test.writingScore),
    parseScore(test.speakingScore),
  ];

  return componentScores.every((score) => score !== undefined && score >= minBand);
}

export function languageTestSatisfiesEnglishRequirement(
  test: LanguageTest,
  requirement: Extract<RequirementInstance, { kind: "english_proficiency" }>,
): boolean {
  return requirement.params.acceptedPathways.some(
    (pathway) =>
      pathway.type === "english_test" && languageTestSatisfiesPathway(test, pathway),
  );
}

export function hasApprovedEnglishTestEvidence(
  tests: LanguageTest[],
  course: CourseCatalogEntry | null | undefined,
): boolean {
  const requirements = getEnglishProficiencyRequirements(course);
  if (requirements.length === 0) {
    return tests.some((test) => isSubmissionReadyDocument(test.document));
  }

  return requirements.some((requirement) =>
    tests.some((test) => languageTestSatisfiesEnglishRequirement(test, requirement)),
  );
}

/** Whether English proficiency has been evidenced by a language test or an AHPRA registration. */
export function hasEnglishProficiencyEvidence(
  data: ApplicationData,
  course?: CourseCatalogEntry | null,
): boolean {
  return (
    hasApprovedEnglishTestEvidence(data.languageTests, course) ||
    hasCurrentAhpraRegistrationEvidence(data.professionalAccreditations)
  );
}

/**
 * A qualification needs a Certificate of Completion only when it's marked completed but
 * its transcript doesn't evidence that. (Whether the certificate document is attached is
 * checked separately by the caller.)
 */
export function needsCertificateOfCompletion(
  qualification: TertiaryQualification,
): boolean {
  return Boolean(qualification.completed) && !transcriptConfirmsCompletion(qualification);
}

export function courseRequiresEnglishProficiency(
  course: CourseCatalogEntry | null | undefined,
): boolean {
  return Boolean(
    course?.requirements?.some((requirement) => requirement.kind === "english_proficiency"),
  );
}

/**
 * English proficiency must be evidenced when the course requires it, it can't be inferred
 * from a transcript, and no English test / AHPRA registration has been provided.
 */
export function needsEnglishProficiencyEvidence(
  data: ApplicationData,
  course: CourseCatalogEntry | null | undefined,
): boolean {
  if (!courseRequiresEnglishProficiency(course)) {
    return false;
  }
  if (isEnglishInferableFromTranscripts(data, course)) {
    return false;
  }
  return !hasEnglishProficiencyEvidence(data, course);
}
