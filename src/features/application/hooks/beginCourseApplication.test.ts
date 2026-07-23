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
import { beginCourseApplication } from "./beginCourseApplication";

vi.mock("../../../lib/documentStorage", () => ({
  replaceStoredDocument: vi.fn(),
}));

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const course: SelectedCourse = {
  code: "master-of-education-leadership",
  intake: "2026",
  provider: "University of Canberra",
  title: "Master of Education (Leadership)",
};

function transcriptAssessment(): TranscriptEligibilityAssessment {
  return {
    checkedAt: "2026-07-23T03:30:00.000Z",
    confidence: 0.94,
    extractedData: {
      applicantDetails: {
        institutionName: { normalizedValue: "University of Melbourne" },
      },
      studyDetails: {
        completionStatus: { normalizedValue: "completed" },
        highestEducationLevel: { normalizedValue: "Masters" },
        programName: { normalizedValue: "Master of Business Administration" },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    programCode: "UC-A,UC-B,UC-C",
    recommendedNextStep: "Continue",
    requirementsChecked: [],
  };
}

function qualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "qualification-mba",
    institution: "University of Melbourne",
    country: "Australia",
    level: "Masters",
    courseName: "Master of Business Administration",
    startMonth: "",
    startYear: "",
    completed: true,
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
  name: "academic-transcript.pdf",
  size: 512,
  type: "application/pdf",
  lastModified: 1,
  uploadedAt: "2026-07-23T03:31:00.000Z",
  source: "remote" as const,
  storageBucket: "application-documents",
  storagePath: `${applicationId}/transcript-document/academic-transcript.pdf`,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(replaceStoredDocument).mockResolvedValue(storedTranscript);
});

describe("beginCourseApplication UC transcript handoff", () => {
  it("attaches the carried transcript to a new application's prefilled qualification", async () => {
    const assessment = transcriptAssessment();
    const transcriptFile = new File(["transcript"], "academic-transcript.pdf", {
      type: "application/pdf",
    });
    const storageAdapter = makeStorageAdapter();
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
        storageAdapter,
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
      courseName: "Master of Business Administration",
      transcriptDocument: storedTranscript,
      transcriptDocumentName: "academic-transcript.pdf",
      transcriptEligibility: assessment,
    });
  });

  it("attaches the carried transcript when the selected course resumes an existing draft", async () => {
    const assessment = transcriptAssessment();
    const transcriptFile = new File(["transcript"], "academic-transcript.pdf", {
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
        updatedAt: "2026-07-23T03:00:00.000Z",
      }),
      loadApplicationById: vi.fn().mockResolvedValue(loadedApplication),
      saveApplication,
    });
    const openApplication = vi.fn();

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
        openApplication,
        persistApplication: vi.fn(),
        storageAdapter,
        trackDraftCreated: vi.fn(),
        trackDraftResumed: vi.fn(),
      },
    );

    expect(saveApplication).toHaveBeenCalledTimes(2);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      id: "qualification-mba",
      transcriptDocument: storedTranscript,
      transcriptDocumentName: "academic-transcript.pdf",
      transcriptEligibility: assessment,
    });
    expect(openApplication).toHaveBeenCalledWith(applicationId);
  });
});
