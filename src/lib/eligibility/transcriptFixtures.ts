import type {
  EligibilityOutcome,
  EligibilityRequirementStatus,
  TranscriptEligibilityAssessment,
} from "./types";

export interface TranscriptFixtureExpectation {
  expectedOutcome: EligibilityOutcome;
  expectedPrimaryRequirementStatus: EligibilityRequirementStatus;
  expectsManualReview: boolean;
  id: string;
  institution: string;
  scenario: string;
}

export const transcriptFixtureExpectations: TranscriptFixtureExpectation[] = [
  {
    expectedOutcome: "eligible",
    expectedPrimaryRequirementStatus: "pass",
    expectsManualReview: false,
    id: "AU-TX-001",
    institution: "The University of Melbourne",
    scenario: "Completed bachelor with conferred award and strong WAM/GPA evidence.",
  },
  {
    expectedOutcome: "ineligible",
    expectedPrimaryRequirementStatus: "fail",
    expectsManualReview: false,
    id: "AU-TX-002",
    institution: "Monash University",
    scenario: "Discontinued bachelor with low GPA and no completion.",
  },
  {
    expectedOutcome: "conditionally_eligible",
    expectedPrimaryRequirementStatus: "unknown",
    expectsManualReview: true,
    id: "AU-TX-003",
    institution: "The University of Sydney",
    scenario: "In-progress masters with partial results and no conferral yet.",
  },
  {
    expectedOutcome: "eligible",
    expectedPrimaryRequirementStatus: "pass",
    expectsManualReview: false,
    id: "AU-TX-004",
    institution: "University of New South Wales",
    scenario: "Completed graduate certificate with conferred award.",
  },
  {
    expectedOutcome: "eligible",
    expectedPrimaryRequirementStatus: "pass",
    expectsManualReview: false,
    id: "AU-TX-005",
    institution: "The University of Queensland",
    scenario: "Completed honours bachelor with explicit classification and award.",
  },
  {
    expectedOutcome: "ineligible",
    expectedPrimaryRequirementStatus: "fail",
    expectsManualReview: false,
    id: "AU-TX-006",
    institution: "University of Tasmania",
    scenario: "Excluded program with repeated failed clinical hurdles.",
  },
  {
    expectedOutcome: "eligible",
    expectedPrimaryRequirementStatus: "pass",
    expectsManualReview: false,
    id: "AU-TX-007",
    institution: "Deakin University",
    scenario: "Completed bachelor including advanced standing and conferral.",
  },
  {
    expectedOutcome: "insufficient_data",
    expectedPrimaryRequirementStatus: "unknown",
    expectsManualReview: true,
    id: "AU-TX-008",
    institution: "RMIT University",
    scenario: "Research degree withdrawn with no GPA/WAM basis for standard checks.",
  },
  {
    expectedOutcome: "conditionally_eligible",
    expectedPrimaryRequirementStatus: "pass",
    expectsManualReview: true,
    id: "AU-TX-009",
    institution: "Australian National University",
    scenario: "Conferred PhD research-only transcript with non-coursework outcomes.",
  },
  {
    expectedOutcome: "conditionally_eligible",
    expectedPrimaryRequirementStatus: "unknown",
    expectsManualReview: true,
    id: "AU-TX-010",
    institution: "Queensland University of Technology",
    scenario: "Coursework complete but award conferral pending.",
  },
  {
    expectedOutcome: "conditionally_eligible",
    expectedPrimaryRequirementStatus: "unknown",
    expectsManualReview: true,
    id: "AU-TX-011",
    institution: "Macquarie University",
    scenario: "Primary masters incomplete but exit award conferred.",
  },
  {
    expectedOutcome: "insufficient_data",
    expectedPrimaryRequirementStatus: "unknown",
    expectsManualReview: true,
    id: "AU-TX-012",
    institution: "University of Technology Sydney",
    scenario: "Pass/fail-heavy program with no calculated GPA/WAM.",
  },
];

export function buildFixtureServicePayload(
  fixture: TranscriptFixtureExpectation,
): Partial<TranscriptEligibilityAssessment> {
  return {
    confidence: fixture.expectsManualReview ? 0.64 : 0.9,
    manualReviewRequired: fixture.expectsManualReview,
    outcome: fixture.expectedOutcome,
    programCode: "TEST-PROGRAM",
    programTitle: "Test Program",
    recommendedNextStep: fixture.expectsManualReview
      ? "Escalate to manual admissions review."
      : "Proceed to the next admissions step.",
    requirementsChecked: [
      {
        explanation: fixture.scenario,
        id: "primary-requirement",
        requirement: "Primary academic eligibility requirement",
        status: fixture.expectedPrimaryRequirementStatus,
      },
    ],
  };
}

