import { getGeneratedRequirementsForCourse } from "../courseCatalog/requirementsLoader";
import type { RequirementInstance } from "./requirements";
import type {
  EligibilityRequirementStatus,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types";

/**
 * Pulls canonical requirements for a course directly from the shipped generated catalog (via the
 * runtime loader, so JSON null normalization and the matcher-safety filter run too). Using the real
 * shipped data in fixtures means a regression in either the parser output OR the matcher will cause
 * the eval to fail.
 */
function realCourseRequirements(courseCode: string): RequirementInstance[] {
  const requirements = getGeneratedRequirementsForCourse(courseCode);
  if (!requirements || requirements.length === 0) {
    throw new Error(
      `matcherFixtures: no canonical (matcher-safe) requirements found for course code "${courseCode}". ` +
        `Either run \`npm run eligibility:parse-requirements -- --code=${courseCode}\` or pick a safer course.`,
    );
  }
  return requirements;
}

/**
 * Matcher-level fixture. Unlike `transcriptFixtures.ts` (which exercises the proxy + service
 * contract), this fixture supplies the data already extracted from the transcript and asserts the
 * per-requirement and aggregate outcomes the pure matcher should produce.
 *
 * Used by `scripts/eligibility-eval.ts` to compute precision/recall and surface regressions before
 * they reach production.
 */
export interface MatcherFixture {
  id: string;
  scenario: string;
  context: TranscriptEligibilityRequestContext;
  evidence: TranscriptExtractedData;
  requirements: RequirementInstance[];
  /**
   * Expected status for each requirement by id. Missing entries default to "unknown".
   */
  expectedStatusById: Record<string, EligibilityRequirementStatus>;
  expectedOutcome: "eligible" | "ineligible" | "insufficient_data";
}

const STANDARD_AU_BACHELOR_REQUIREMENTS: RequirementInstance[] = [
  {
    id: "completion",
    kind: "qualification_completed",
    params: {},
    sourceText: "Successful completion of an Australian bachelor degree (or equivalent).",
    weight: "mandatory",
  },
  {
    id: "level-bachelor",
    kind: "qualification_level",
    params: { level: "bachelor" },
    sourceText: "Minimum qualification: Bachelor degree.",
    weight: "mandatory",
  },
  {
    id: "wam-65",
    kind: "academic_threshold",
    params: { metric: "wam", min: 65 },
    sourceText: "Weighted Average Mark (WAM) of 65% or above.",
    weight: "mandatory",
  },
  {
    id: "english",
    kind: "english_proficiency",
    params: {
      acceptedPathways: [
        {
          type: "completion_in_country",
          countries: ["AU", "NZ", "UK", "IE", "US", "CA", "ZA"],
        },
      ],
    },
    sourceText:
      "Evidence of English language proficiency or completion of program in English at a recognised institution.",
    weight: "mandatory",
  },
];

export const matcherFixtures: MatcherFixture[] = [
  {
    id: "MX-001",
    scenario: "Completed AU bachelor, strong WAM — should be fully eligible.",
    context: { completed: true, country: "Australia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.9, normalizedValue: "The University of Melbourne" },
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Australia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Information Technology" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "78.6" },
      },
    },
    requirements: STANDARD_AU_BACHELOR_REQUIREMENTS,
    expectedStatusById: {
      completion: "pass",
      "level-bachelor": "pass",
      "wam-65": "pass",
      english: "pass",
    },
    expectedOutcome: "eligible",
  },
  {
    id: "MX-002",
    scenario: "Discontinued bachelor with low WAM — completion fails immediately.",
    context: { completed: false, country: "Australia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.9, normalizedValue: "Monash University" },
        countryOfInstitution: { confidence: 0.9, normalizedValue: "Australia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "withdrawn" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Arts" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "55" },
      },
    },
    requirements: STANDARD_AU_BACHELOR_REQUIREMENTS,
    expectedStatusById: {
      completion: "fail",
      "level-bachelor": "pass",
      "wam-65": "fail",
      english: "pass",
    },
    expectedOutcome: "ineligible",
  },
  {
    id: "MX-003",
    scenario: "Completed bachelor at AU institution but WAM is missing — insufficient data for academic threshold.",
    context: { completed: true, country: "Australia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.85, normalizedValue: "The University of Sydney" },
        countryOfInstitution: { confidence: 0.9, normalizedValue: "Australia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Science" },
      },
      academicPerformance: {},
    },
    requirements: STANDARD_AU_BACHELOR_REQUIREMENTS,
    expectedStatusById: {
      completion: "pass",
      "level-bachelor": "pass",
      "wam-65": "unknown",
      english: "pass",
    },
    expectedOutcome: "insufficient_data",
  },
  {
    id: "MX-004",
    scenario: "Completed bachelor from a non-English-medium country with no test evidence — English unknown.",
    context: { completed: true, country: "Indonesia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.9, normalizedValue: "Universitas Indonesia" },
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Indonesia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Engineering" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "75" },
      },
    },
    requirements: STANDARD_AU_BACHELOR_REQUIREMENTS,
    expectedStatusById: {
      completion: "pass",
      "level-bachelor": "pass",
      "wam-65": "pass",
      english: "unknown",
    },
    expectedOutcome: "insufficient_data",
  },
  {
    id: "MX-005",
    scenario:
      "Bachelor-or-experience alternative group: applicant has bachelor, so group satisfies.",
    context: { completed: true, country: "Australia" },
    evidence: {
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Commerce" },
      },
      applicantDetails: {
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Australia" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "70" },
      },
    },
    requirements: [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of a qualifying program (entry pathway A or B).",
        weight: "mandatory",
      },
      {
        id: "alt-bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "A completed bachelor degree, OR",
        weight: "alternative",
        alternativeGroupId: "entry-pathway",
      },
      {
        id: "alt-experience",
        kind: "work_experience",
        params: { minYears: 5 },
        sourceText: "five or more years of relevant professional experience.",
        weight: "alternative",
        alternativeGroupId: "entry-pathway",
      },
      {
        id: "wam-65",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
      {
        id: "english",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [{ type: "completion_in_country", countries: ["AU", "NZ"] }],
        },
        sourceText: "Evidence of English language proficiency.",
        weight: "mandatory",
      },
    ],
    expectedStatusById: {
      completion: "pass",
      "entry-pathway": "pass",
      "wam-65": "pass",
      english: "pass",
    },
    expectedOutcome: "eligible",
  },

  // -------- Real-catalog fixtures --------
  // These pull canonical requirements directly from the shipped requirements.generated.json so the
  // eval gates against the actual production data shape.

  {
    id: "REAL-001",
    scenario:
      "La Trobe MIT, completed Bachelor of IT from University of Melbourne (78.6 WAM) — matches the user's original duplicate-checks report. Expect 3 clean passes.",
    context: { completed: true, country: "Australia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.95, normalizedValue: "The University of Melbourne" },
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Australia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Bachelor of Information Technology",
        },
        programName: { confidence: 0.9, normalizedValue: "Bachelor of Information Technology" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "78.6" },
        gpa: { confidence: 0.85, normalizedValue: "6.1" },
        gpaScale: { confidence: 0.85, normalizedValue: "7" },
      },
    },
    requirements: realCourseRequirements("la-trobe-university-master-of-information-technology"),
    expectedStatusById: {
      "completed-australian-bachelor": "pass",
      "english-completion-in-country": "pass",
    },
    expectedOutcome: "eligible",
  },
  {
    id: "REAL-002",
    scenario:
      "SCU MBA Online, completed AU bachelor (Commerce) with no IELTS — completion-in-country pathway should satisfy English.",
    context: { completed: true, country: "Australia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.9, normalizedValue: "Macquarie University" },
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Australia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Commerce" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "72" },
      },
    },
    requirements: realCourseRequirements("mba-online"),
    expectedStatusById: {
      "qualification-level-bachelor": "pass",
      "english-ielts": "pass",
    },
    expectedOutcome: "eligible",
  },
  {
    id: "REAL-003",
    scenario:
      "SCU MBA Online, completed bachelor at Universitas Gadjah Mada (Indonesia) with no IELTS evidence — English pathway should be unknown.",
    context: { completed: true, country: "Indonesia" },
    evidence: {
      applicantDetails: {
        institutionName: { confidence: 0.9, normalizedValue: "Universitas Gadjah Mada" },
        countryOfInstitution: { confidence: 0.95, normalizedValue: "Indonesia" },
      },
      studyDetails: {
        completionStatus: { confidence: 0.95, normalizedValue: "completed" },
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of Engineering" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "70" },
      },
    },
    requirements: realCourseRequirements("mba-online"),
    expectedStatusById: {
      "qualification-level-bachelor": "pass",
      "english-ielts": "unknown",
    },
    expectedOutcome: "insufficient_data",
  },
];
