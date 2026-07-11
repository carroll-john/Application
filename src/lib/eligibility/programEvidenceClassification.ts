import type { ApplicationData, LanguageTest, ProfessionalAccreditation } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { isSubmissionReadyDocument } from "../documentAttachment";
import { requirementCheckDisplayCopy } from "./checkCopy";
import {
  getAcceptedEnglishCompletionCountries,
  hasCurrentAhpraRegistrationEvidence,
  isEnglishMediumQualification,
  languageTestSatisfiesEnglishRequirement,
} from "./englishProficiencyEvidence";
import type { RequirementInstance } from "./requirements";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  RequirementReasonCode,
} from "./types";

export type ProgramEvidenceStatus =
  | "met"
  | "needs_evidence"
  | "needs_details"
  | "needs_review"
  | "possible_alternative";

/** Policy outcome before app routes and action labels are applied. */
export interface ProgramEvidenceClassification {
  explanation: string;
  isBlocking: boolean;
  reasonCode?: RequirementReasonCode;
  requirementStatus?: EligibilityRequirementStatus;
  status: ProgramEvidenceStatus;
}

export function buildRequirementCheckMap(checks: readonly EligibilityRequirementCheck[]) {
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

export function classifyTranscriptCheckEvidence(options: {
  check: EligibilityRequirementCheck | undefined;
  hasTranscriptEvidence: boolean;
  instance: RequirementInstance;
}): ProgramEvidenceClassification {
  const { check, hasTranscriptEvidence, instance } = options;

  if (!check) {
    if (hasTranscriptEvidence) {
      return {
        explanation:
          "We reviewed your transcript but could not confirm this requirement automatically. Admissions will verify it.",
        isBlocking: false,
        status: "needs_review",
      };
    }

    return {
      explanation: "Add your transcript to verify this requirement.",
      isBlocking: true,
      status: "needs_evidence",
    };
  }

  if (check.status === "pass") {
    return {
      explanation: requirementCheckDisplayCopy(check),
      isBlocking: false,
      reasonCode: check.reasonCode,
      requirementStatus: check.status,
      status: "met",
    };
  }

  if (check.status === "unknown") {
    return {
      explanation: requirementCheckDisplayCopy(check),
      isBlocking: !hasTranscriptEvidence,
      reasonCode: check.reasonCode,
      requirementStatus: check.status,
      status: hasTranscriptEvidence ? "needs_review" : "needs_evidence",
    };
  }

  if (instance.kind === "academic_threshold") {
    return {
      explanation: `${requirementCheckDisplayCopy(check)} Add a CV for admissions to consider an alternate pathway.`,
      isBlocking: false,
      reasonCode: check.reasonCode,
      requirementStatus: check.status,
      status: "possible_alternative",
    };
  }

  return {
    explanation: requirementCheckDisplayCopy(check),
    isBlocking: false,
    reasonCode: check.reasonCode,
    requirementStatus: check.status,
    status: "needs_review",
  };
}

export function classifyEnglishProficiencyEvidence(options: {
  applicationData: ApplicationData;
  course: CourseCatalogEntry;
  instance: Extract<RequirementInstance, { kind: "english_proficiency" }>;
}): ProgramEvidenceClassification {
  const { applicationData, course, instance } = options;

  const englishQualification = applicationData.tertiaryQualifications.find((qualification) =>
    isEnglishMediumQualification(qualification, course),
  );
  if (englishQualification) {
    return {
      explanation: `English evidence is satisfied by study in ${englishQualification.country}.`,
      isBlocking: false,
      status: "met",
    };
  }

  const matchingTest = applicationData.languageTests.find((test) =>
    languageTestSatisfiesEnglishRequirement(test, instance),
  );
  if (matchingTest) {
    return {
      explanation: `${matchingTest.type} evidence meets the score and document requirements for this program.`,
      isBlocking: false,
      status: "met",
    };
  }

  if (hasCurrentAhpraRegistrationEvidence(applicationData.professionalAccreditations)) {
    return {
      explanation: "English evidence is satisfied by current documented AHPRA registration.",
      isBlocking: false,
      status: "met",
    };
  }

  const firstLanguageTest = applicationData.languageTests[0];
  if (firstLanguageTest) {
    const hasDocument = isSubmissionReadyDocument(firstLanguageTest.document);
    const hasOverallScore = Boolean(firstLanguageTest.overallScore?.trim());
    return {
      explanation: hasDocument && hasOverallScore
        ? "Your English test doesn't meet this program's required scores. Add another approved test or AHPRA registration."
        : "Add your official score report so this requirement can be checked.",
      isBlocking: true,
      status: hasDocument && hasOverallScore ? "needs_evidence" : "needs_details",
    };
  }

  const firstAhpraLikeAccreditation = applicationData.professionalAccreditations.find(
    (accreditation) => /ahpra|registered/i.test(accreditation.name),
  );
  if (firstAhpraLikeAccreditation) {
    return {
      explanation: "Mark your AHPRA registration active and attach the supporting document.",
      isBlocking: true,
      status: "needs_details",
    };
  }

  const acceptedCountries = getAcceptedEnglishCompletionCountries(course).join(", ");
  return {
    explanation: `Add an approved English test, AHPRA registration, or a qualification from an accepted English-speaking country (${acceptedCountries}).`,
    isBlocking: true,
    status: "needs_evidence",
  };
}

export function classifyWorkExperienceEvidence(options: {
  applicationData: ApplicationData;
  instance: Extract<RequirementInstance, { kind: "work_experience" }>;
}): ProgramEvidenceClassification {
  const { applicationData, instance } = options;

  if (applicationData.employmentExperiences.length > 0) {
    return {
      explanation: applicationData.cvUploaded
        ? "Work experience and CV added for admissions review."
        : "Work experience added. A CV can strengthen your case.",
      isBlocking: false,
      status: "met",
    };
  }

  if (applicationData.cvUploaded) {
    return {
      explanation: `Add your employment history so admissions can assess ${instance.params.minYears}+ years' relevant experience.`,
      isBlocking: true,
      status: "needs_evidence",
    };
  }

  return {
    explanation: `Add evidence of ${instance.params.minYears}+ years' relevant experience.`,
    isBlocking: true,
    status: "needs_evidence",
  };
}

export function languageTestNeedsDocument(test: LanguageTest): boolean {
  return !isSubmissionReadyDocument(test.document);
}

export function accreditationNeedsDocument(
  accreditation: ProfessionalAccreditation,
): boolean {
  return !isSubmissionReadyDocument(accreditation.document);
}
