import type {
  EligibilityCheckDetails,
  EligibilityOutcome,
  EligibilityPendingEvidence,
  EligibilityRequirementCheck,
  RequirementReasonCode,
} from "./types";

/**
 * Single source of applicant-facing copy for requirement checks, keyed on the durable
 * `reasonCode` (never on LLM free text). Both the server pipeline (missing-information bullets,
 * recommended next step) and the UI (card bodies) read from here, so the same check can never
 * produce contradicting wording in different parts of the panel.
 *
 * The free-text `explanation` on a check remains as a debugging/legacy fallback for checks
 * produced without a reasonCode (e.g. older external-service payloads).
 */

type CopyBuilder = (details?: EligibilityCheckDetails) => string;

export const checkCopyByReasonCode: Record<RequirementReasonCode, CopyBuilder> = {
  QUALIFICATION_COMPLETE: () => "Your transcript shows this qualification as completed.",
  QUALIFICATION_INCOMPLETE: () =>
    "Your transcript shows this qualification as incomplete or withdrawn.",
  QUALIFICATION_COMPLETION_UNKNOWN: () =>
    "We couldn't confirm the completion status from your transcript.",
  QUALIFICATION_IDENTITY_UNKNOWN: () =>
    "We couldn't confirm the required qualification or institution from your transcript.",
  QUALIFICATION_NAME_MISMATCH: (details) =>
    details?.required
      ? `Your qualification does not match the required ${details.required}.`
      : "Your qualification does not match the specific award required for this pathway.",
  QUALIFICATION_PROVIDER_MISMATCH: (details) =>
    details?.required
      ? `Your qualification was not awarded by the required provider (${details.required}).`
      : "Your qualification was not awarded by the provider required for this pathway.",
  QUALIFICATION_LEVEL_MET: (details) =>
    details?.observed
      ? `Your qualification ("${details.observed}") meets the required level.`
      : "Your qualification meets the required level.",
  QUALIFICATION_LEVEL_BELOW: (details) =>
    details?.observed
      ? `Your qualification ("${details.observed}") appears below the required level.`
      : "Your qualification appears below the required level.",
  QUALIFICATION_LEVEL_UNKNOWN: () =>
    "We couldn't confirm your qualification level from your transcript.",
  WAM_MET: (details) =>
    details?.observed && details?.required
      ? `Your WAM of ${details.observed} meets the minimum of ${details.required}.`
      : "Your WAM meets the minimum for this program.",
  WAM_BELOW: (details) =>
    details?.observed && details?.required
      ? `Your WAM of ${details.observed} is below the minimum of ${details.required}.`
      : "Your WAM appears below the minimum for this program.",
  GPA_MET: (details) =>
    details?.observed && details?.required
      ? `Your GPA of ${details.observed} meets the minimum of ${details.required}.`
      : "Your GPA meets the minimum for this program.",
  GPA_BELOW: (details) =>
    details?.observed && details?.required
      ? `Your GPA of ${details.observed} is below the minimum of ${details.required}.`
      : "Your GPA appears below the minimum for this program.",
  ACADEMIC_EVIDENCE_MISSING: () => "We couldn't find a WAM or GPA on your transcript.",
  ENGLISH_OK_COUNTRY: (details) =>
    details?.observed
      ? `English language proficiency is satisfied by study in ${details.observed}.`
      : "English language proficiency is satisfied by study in an accepted English-speaking country.",
  ENGLISH_OK_AHPRA: () =>
    "English language proficiency is satisfied by your AHPRA registration.",
  ENGLISH_TEST_UNVERIFIED: () =>
    "Your English test details were provided and will be verified by admissions.",
  ENGLISH_UNVERIFIED: () =>
    "Add an approved English test, AHPRA registration, or a qualification from an accepted English-speaking country.",
  WORK_EXPERIENCE_UNVERIFIED: (details) =>
    `Work experience${
      details?.required ? ` (${details.required})` : ""
    } is verified from your CV and employment history rather than your transcript.`,
  FIELD_MATCH: () => "Your program's field of study matches an accepted field.",
  FIELD_MISMATCH: () =>
    "Your program's field of study doesn't appear to match the accepted fields for this program.",
  FIELD_PROGRAM_MISSING: () => "We couldn't read your program name from the transcript.",
  GROUP_SATISFIED: () => "One of the accepted entry pathways is satisfied by your evidence.",
  GROUP_UNSATISFIED: () =>
    "None of the accepted entry pathways appears satisfied by your evidence.",
  GROUP_UNCONFIRMED: () =>
    "We couldn't confirm any of the accepted entry pathways from your evidence.",
  SERVICE_UNAVAILABLE: () =>
    "Automated transcript review was unavailable. Admissions will review your documents manually.",
};

/** Card-body copy for a check: hardcoded reasonCode copy, falling back to the free-text explanation. */
export function requirementCheckDisplayCopy(check: EligibilityRequirementCheck): string {
  if (check.reasonCode) {
    return checkCopyByReasonCode[check.reasonCode](check.details);
  }
  return check.explanation;
}

/**
 * Applicant-facing "missing or unclear information" bullet for an unknown transcript-scoped check.
 * Only reason codes that represent something the transcript itself failed to show get a bullet —
 * requirements proven by other documents (CV, English tests) are surfaced as pending evidence
 * prompts instead.
 */
export const missingInformationCopyByReasonCode: Partial<
  Record<RequirementReasonCode, CopyBuilder>
> = {
  QUALIFICATION_COMPLETION_UNKNOWN: () =>
    "Completion or conferral status is not clearly shown on the transcript.",
  QUALIFICATION_IDENTITY_UNKNOWN: () =>
    "The qualification name or awarding institution could not be confirmed from the transcript.",
  QUALIFICATION_LEVEL_UNKNOWN: () =>
    "The qualification level could not be read from the transcript.",
  ACADEMIC_EVIDENCE_MISSING: () => "A WAM or GPA could not be found on the transcript.",
  FIELD_PROGRAM_MISSING: () => "The program name could not be read from the transcript.",
  GROUP_UNCONFIRMED: () =>
    "None of the alternative entry pathways could be confirmed from the transcript.",
  SERVICE_UNAVAILABLE: () => "Automated transcript review was unavailable for this document.",
};

/** What the applicant should show more clearly on a re-uploaded transcript, per unknown reason. */
const transcriptNextStepFragmentByReasonCode: Partial<Record<RequirementReasonCode, string>> = {
  QUALIFICATION_COMPLETION_UNKNOWN: "your completion or conferral status",
  QUALIFICATION_IDENTITY_UNKNOWN: "the qualification name and awarding institution",
  QUALIFICATION_LEVEL_UNKNOWN: "your qualification level",
  ACADEMIC_EVIDENCE_MISSING: "your WAM or GPA",
  FIELD_PROGRAM_MISSING: "your program name",
  GROUP_UNCONFIRMED: "the entry pathway you are applying under",
};

const pendingEvidenceNextStepBySource: Record<
  EligibilityPendingEvidence["evidenceSource"],
  string
> = {
  transcript: "Add your academic transcript.",
  cv: "Add your CV and employment history so your work experience can be reviewed.",
  english_evidence:
    "Add English language evidence (an approved test, AHPRA registration, or study in an accepted country).",
};

function formatList(items: readonly string[]): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items);
}

/**
 * Deterministic recommended-next-step sentence, derived only from what is actually unresolved:
 * unknown transcript-scoped checks and pending other-document evidence. Never uses LLM free text.
 */
export function buildRecommendedNextStep(input: {
  outcome: EligibilityOutcome;
  pendingEvidence?: readonly EligibilityPendingEvidence[];
  unknownTranscriptReasonCodes?: readonly RequirementReasonCode[];
}): string {
  const sentences: string[] = [];

  if (input.outcome === "ineligible") {
    sentences.push(
      "One or more requirements appear unmet based on the supplied evidence. Admissions makes the final decision after verifying your documents.",
    );
  }

  const fragments = [
    ...new Set(
      (input.unknownTranscriptReasonCodes ?? [])
        .map((code) => transcriptNextStepFragmentByReasonCode[code])
        .filter((fragment): fragment is string => Boolean(fragment)),
    ),
  ];
  if (fragments.length > 0) {
    sentences.push(`Upload a transcript that clearly shows ${formatList(fragments)}.`);
  }

  const pendingSources = [
    ...new Set((input.pendingEvidence ?? []).map((entry) => entry.evidenceSource)),
  ];
  for (const source of pendingSources) {
    sentences.push(pendingEvidenceNextStepBySource[source]);
  }

  if (sentences.length === 0) {
    sentences.push(
      "No further transcript evidence is needed. Admissions will verify your documents and confirm the outcome.",
    );
  }

  return sentences.join(" ");
}
