import { describe, expect, it, vi } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type SelectedCourse,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { AssessmentStorageAdapter } from "../../../lib/assessment/storageAdapter";
import type { AssessmentSessionSnapshot } from "../../../lib/assessment/types";
import { normalizeTranscriptEligibilityAssessment } from "../../../lib/eligibility/normalize";
import { beginCourseApplication } from "./beginCourseApplication";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const assessmentSessionId = "223e4567-e89b-42d3-a456-426614174000";
const course: SelectedCourse = {
  code: "master-of-education-leadership",
  intake: "2026",
  provider: "University of Canberra",
  title: "Master of Education (Leadership)",
};

function assessmentSession(
  overrides: Partial<AssessmentSessionSnapshot> = {},
): AssessmentSessionSnapshot {
  return {
    applicationId: null,
    catalogueId: "uc-online",
    cohort: "treatment",
    confirmedCv: {
      experiences: [],
      professionalAccreditations: [],
      profile: {
        firstName: "Alex",
        lastName: "Jordan",
        middleName: "",
        phone: "0400 000 000",
        title: "Dr",
      },
      secondaryQualifications: [],
      tertiaryQualifications: [],
    },
    createdAt: "2026-08-04T00:00:00Z",
    expiresAt: "2026-09-03T00:00:00Z",
    id: assessmentSessionId,
    partnerId: "university-of-canberra",
    results: [],
    shortlistCourseCodes: [course.code],
    status: "evaluated",
    transcriptAssessment: normalizeTranscriptEligibilityAssessment({
      confidence: 0.94,
      outcome: "eligible",
      applicantDetails: {
        institutionName: { normalizedValue: "University of Melbourne" },
      },
      studyDetails: {
        completionStatus: { normalizedValue: "completed" },
        highestEducationLevel: { normalizedValue: "Masters" },
        programName: { normalizedValue: "Master of Education" },
      },
    }),
    updatedAt: "2026-08-04T00:00:00Z",
    versions: {
      catalogueVersion: "uc-online-2026-07-23",
      modelVersion: "transcript-evidence-v1",
      rulesVersion: "uc-credit-pilot-2026-08-04.1",
    },
    ...overrides,
  };
}

function makeApplicationStorageAdapter(
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

function makeAssessmentStorageAdapter(
  session = assessmentSession(),
): AssessmentStorageAdapter {
  return {
    activateInvitation: vi.fn(),
    evaluateTranscript: vi.fn(),
    loadSession: vi.fn().mockResolvedValue(session),
    promoteToApplication: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn(),
    uploadDocument: vi.fn(),
  };
}

function dependencies(options: {
  assessmentAdapter?: AssessmentStorageAdapter;
  storageAdapter?: ApplicationStorageAdapter;
} = {}) {
  const persistApplication = vi.fn(async (data: ApplicationData) => ({
    ...data,
    applicationMeta: { ...data.applicationMeta, recordId: applicationId },
  }));

  return {
    applications: [],
    assessmentStorageAdapter:
      options.assessmentAdapter ?? makeAssessmentStorageAdapter(),
    data: initialApplicationData,
    ensureApplicantProfile: vi.fn().mockResolvedValue(null),
    openApplication: vi.fn(),
    persistApplication,
    storageAdapter: options.storageAdapter ?? makeApplicationStorageAdapter(),
    trackDraftCreated: vi.fn(),
    trackDraftResumed: vi.fn(),
  };
}

describe("beginCourseApplication assessment handoff", () => {
  it("loads the trusted assessment by id, fills blanks, and promotes evidence", async () => {
    const assessmentAdapter = makeAssessmentStorageAdapter();
    const deps = dependencies({ assessmentAdapter });

    const result = await beginCourseApplication(
      course,
      {
        assessmentSessionId,
        authenticatedEmail: "alex@example.com",
        startFresh: true,
      },
      deps,
    );

    expect(assessmentAdapter.loadSession).toHaveBeenCalledWith(assessmentSessionId);
    expect(result.personalDetails).toMatchObject({
      email: "alex@example.com",
      firstName: "Alex",
      lastName: "Jordan",
      phone: "0400 000 000",
    });
    expect(result.tertiaryQualifications[0]).toMatchObject({
      courseName: "Master of Education",
      institution: "University of Melbourne",
    });
    expect(assessmentAdapter.promoteToApplication).toHaveBeenCalledWith(
      assessmentSessionId,
      applicationId,
    );
  });

  it("fills blank fields only when resuming an existing application", async () => {
    const existing: ApplicationData = {
      ...initialApplicationData,
      applicationMeta: {
        recordId: applicationId,
        selectedCourse: course,
        status: "draft",
      },
      personalDetails: {
        ...initialApplicationData.personalDetails,
        firstName: "Saved",
        phone: "0411 111 111",
      },
    };
    let stored = existing;
    const storageAdapter = makeApplicationStorageAdapter({
      findOpenDraftForCourse: vi.fn().mockResolvedValue({
        completedStepCount: 0,
        completionPercentage: 0,
        course,
        id: applicationId,
        status: "draft",
        totalStepCount: 1,
        updatedAt: "2026-08-04T00:00:00Z",
      }),
      loadApplicationById: vi.fn(async () => stored),
      saveApplication: vi.fn(async (next: ApplicationData) => {
        stored = next;
        return next;
      }),
    });
    const deps = dependencies({ storageAdapter });

    const result = await beginCourseApplication(
      course,
      { assessmentSessionId, authenticatedEmail: "alex@example.com" },
      deps,
    );

    expect(result.personalDetails.firstName).toBe("Saved");
    expect(result.personalDetails.phone).toBe("0411 111 111");
    expect(result.personalDetails.email).toBe("alex@example.com");
    expect(deps.openApplication).toHaveBeenCalledWith(applicationId);
  });

  it("rejects control or incomplete sessions before creating an application", async () => {
    const assessmentAdapter = makeAssessmentStorageAdapter(
      assessmentSession({ cohort: "control", status: "shortlist" }),
    );
    const deps = dependencies({ assessmentAdapter });

    await expect(
      beginCourseApplication(
        course,
        { assessmentSessionId, startFresh: true },
        deps,
      ),
    ).rejects.toThrow(/complete the treatment assessment/i);
    expect(deps.persistApplication).not.toHaveBeenCalled();
    expect(assessmentAdapter.promoteToApplication).not.toHaveBeenCalled();
  });
});
