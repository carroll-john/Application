import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type SelectedCourse,
  type TertiaryQualification,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import { replaceStoredDocument } from "../../../lib/documentStorage";
import type { TranscriptEligibilityAssessment } from "../../../lib/eligibility/types";
import { buildSection2EvidencePlan } from "../../section2/section2EvidencePlan";
import { beginCourseApplication } from "./beginCourseApplication";

vi.mock("../../../lib/documentStorage", () => ({
  replaceStoredDocument: vi.fn(),
}));

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const course: SelectedCourse = {
  code: "MGM104",
  intake: "Upcoming intake",
  provider: "University of Canberra",
  title: "Master of Business Administration",
};

function transcriptAssessment(): TranscriptEligibilityAssessment {
  return {
    checkedAt: "2026-08-19T00:00:00.000Z",
    confidence: 0.94,
    extractedData: {
      applicantDetails: {
        institutionName: { normalizedValue: "RMIT University" },
      },
      studyDetails: {
        completionStatus: { normalizedValue: "not_completed" },
        highestEducationLevel: { normalizedValue: "Bachelor" },
        programName: { normalizedValue: "Bachelor of Business (Management)" },
        startDate: { normalizedValue: "26 February 2024" },
        studyEndDate: { normalizedValue: "2025-08-29" },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    programCode: "MGM104,MGC103,ARC701",
    recommendedNextStep: "Continue",
    requirementsChecked: [],
  };
}

function qualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "qualification-business",
    institution: "RMIT University",
    country: "Australia",
    level: "Bachelor",
    courseName: "Bachelor of Business (Management)",
    startMonth: "",
    startYear: "",
    completed: false,
    endMonth: "",
    endYear: "",
    ...overrides,
  };
}

function makeStorageAdapter(
  overrides: Partial<ApplicationStorageAdapter> = {},
): ApplicationStorageAdapter {
  return {
    mode: "remote",
    deleteApplication: vi.fn(),
    ensureApplicantProfile: vi.fn().mockResolvedValue(null),
    findOpenDraftForCourse: vi.fn().mockResolvedValue(null),
    listApplications: vi.fn().mockResolvedValue([]),
    loadApplicantProfile: vi.fn().mockResolvedValue(null),
    loadApplicationById: vi.fn().mockResolvedValue(null),
    saveApplication: vi.fn(async (data: ApplicationData) => data),
    submitApplication: vi.fn(async (data: ApplicationData) => data),
    ...overrides,
  };
}

const storedTranscript = {
  id: "transcript-document",
  name: "maya-patel-transcript.pdf",
  size: 512,
  type: "application/pdf",
  lastModified: 1,
  uploadedAt: "2026-08-19T00:01:00.000Z",
  source: "remote" as const,
  storageBucket: "application-documents",
  storagePath: `${applicationId}/transcript-document/maya-patel-transcript.pdf`,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(replaceStoredDocument).mockResolvedValue(storedTranscript);
});

describe("beginCourseApplication UC transcript handoff", () => {
  it("uploads and attaches the assessed transcript to a new application", async () => {
    const assessment = transcriptAssessment();
    const transcriptFile = new File(["transcript"], "maya-patel-transcript.pdf", {
      type: "application/pdf",
    });
    const persistApplication = vi.fn(async (data: ApplicationData) => ({
      ...data,
      applicationMeta: {
        ...data.applicationMeta,
        recordId: applicationId,
      },
    }));

    const result = await beginCourseApplication(
      course,
      {
        startFresh: true,
        ucTranscriptFile: transcriptFile,
        ucTranscriptPrefill: assessment,
      },
      {
        applications: [],
        data: initialApplicationData,
        ensureApplicantProfile: vi.fn().mockResolvedValue(null),
        openApplication: vi.fn(),
        persistApplication,
        storageAdapter: makeStorageAdapter(),
        trackDraftCreated: vi.fn(),
        trackDraftResumed: vi.fn(),
      },
    );

    expect(replaceStoredDocument).toHaveBeenCalledWith(
      transcriptFile,
      undefined,
      { applicationId, kind: "tertiary_transcript" },
    );
    expect(persistApplication).toHaveBeenCalledTimes(2);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      completed: false,
      courseName: "Bachelor of Business (Management)",
      endMonth: "August",
      endYear: "2025",
      startMonth: "February",
      startYear: "2024",
      transcriptDocument: storedTranscript,
      transcriptDocumentName: "maya-patel-transcript.pdf",
      transcriptEligibility: assessment,
    });
    const evidencePlan = buildSection2EvidencePlan({
      data: result,
      groupedRows: [],
      hasPublishedRequirements: false,
      skippedSections: new Set(),
    });
    expect(evidencePlan.nextPrompt?.heading).not.toBe("Academic transcript");
  });

  it("uploads and attaches the transcript when resuming an existing course draft", async () => {
    const assessment = transcriptAssessment();
    const transcriptFile = new File(["transcript"], "maya-patel-transcript.pdf", {
      type: "application/pdf",
    });
    const loadedApplication: ApplicationData = {
      ...initialApplicationData,
      applicationMeta: {
        recordId: applicationId,
        selectedCourse: course,
        status: "draft",
      },
      tertiaryQualifications: [qualification()],
    };
    const saveApplication = vi.fn(async (data: ApplicationData) => data);
    const storageAdapter = makeStorageAdapter({
      findOpenDraftForCourse: vi.fn().mockResolvedValue({
        completedStepCount: 0,
        completionPercentage: 0,
        course,
        id: applicationId,
        status: "draft",
        totalStepCount: 1,
        updatedAt: "2026-08-19T00:00:00.000Z",
      }),
      loadApplicationById: vi.fn().mockResolvedValue(loadedApplication),
      saveApplication,
    });

    const result = await beginCourseApplication(
      course,
      {
        startFresh: true,
        ucTranscriptFile: transcriptFile,
        ucTranscriptPrefill: assessment,
      },
      {
        applications: [],
        data: initialApplicationData,
        ensureApplicantProfile: vi.fn().mockResolvedValue(null),
        openApplication: vi.fn(),
        persistApplication: vi.fn(),
        storageAdapter,
        trackDraftCreated: vi.fn(),
        trackDraftResumed: vi.fn(),
      },
    );

    expect(saveApplication).toHaveBeenCalledTimes(2);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      id: "qualification-business",
      transcriptDocument: storedTranscript,
      transcriptDocumentName: "maya-patel-transcript.pdf",
      transcriptEligibility: assessment,
    });
  });
});
