import type {
  ApplicationData,
  ProfessionalAccreditation,
  TertiaryQualification,
} from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import {
  DEFAULT_ENGLISH_MEDIUM_COUNTRIES,
  isCountryInAcceptedList,
} from "./englishMediumCountries";

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

/** True when a qualification was studied at an English-medium-country institution. */
export function isEnglishMediumQualification(
  qualification: TertiaryQualification,
): boolean {
  return isCountryInAcceptedList(
    qualification.country,
    DEFAULT_ENGLISH_MEDIUM_COUNTRIES,
  );
}

/** English can be inferred when any qualification was studied in an English-medium country. */
export function isEnglishInferableFromTranscripts(data: ApplicationData): boolean {
  return data.tertiaryQualifications.some(isEnglishMediumQualification);
}

/** Whether English proficiency has been evidenced by a language test or an AHPRA registration. */
export function hasEnglishProficiencyEvidence(data: ApplicationData): boolean {
  return (
    data.languageTests.length > 0 ||
    hasAhpraRegistration(data.professionalAccreditations)
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
  if (isEnglishInferableFromTranscripts(data)) {
    return false;
  }
  return !hasEnglishProficiencyEvidence(data);
}
