import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type { ApplicationData } from "./applicationData";
import type { ApplicationSummary } from "./applicationRecords";

const listRemoteApplications = vi.fn();
const loadRemoteApplicationById = vi.fn();
const saveRemoteApplication = vi.fn();
const submitRemoteApplication = vi.fn();
const deleteRemoteApplication = vi.fn();

const ensureApplicantProfile = vi.fn();
const loadApplicantProfile = vi.fn();

vi.mock("./applicationRemoteStore", () => ({
  listRemoteApplications,
  loadRemoteApplicationById,
  saveRemoteApplication,
  submitRemoteApplication,
  deleteRemoteApplication,
}));

vi.mock("./applicantProfileStore", () => ({
  ensureApplicantProfile,
  loadApplicantProfile,
}));

const { createApplicationStorageAdapter } = await import(
  "./applicationStorageAdapter"
);

const session = {
  user: { id: "user-123", email: "applicant@example.com" },
} as unknown as Session;

const baseSummary: ApplicationSummary = {
  applicationNumber: "APP-0001",
  course: {
    code: "MBA-101",
    title: "Master of Business Administration",
    intake: "March 2026",
    provider: "Example University",
  },
  id: "app-1",
  status: "draft",
  updatedAt: "2026-04-02T00:00:00Z",
};

const minimalApplicationData = {
  applicationMeta: {
    recordId: "app-1",
    selectedCourse: baseSummary.course,
  },
  personalDetails: {},
  contactDetails: {},
  cvDocument: undefined,
  cvFileName: undefined,
  cvUploaded: false,
  tertiaryQualifications: [],
  employmentExperiences: [],
  professionalAccreditations: [],
  secondaryQualifications: [],
  languageTests: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as ApplicationData;

beforeEach(() => {
  for (const fn of [
    listRemoteApplications,
    loadRemoteApplicationById,
    saveRemoteApplication,
    submitRemoteApplication,
    deleteRemoteApplication,
    ensureApplicantProfile,
    loadApplicantProfile,
  ]) {
    fn.mockReset();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createApplicationStorageAdapter", () => {
  it("returns a remote adapter when a session is supplied", () => {
    const adapter = createApplicationStorageAdapter({ session });
    expect(adapter.mode).toBe("remote");
  });

  it("returns a guest adapter when no session is supplied", () => {
    const adapter = createApplicationStorageAdapter({ session: null });
    expect(adapter.mode).toBe("guest");
  });
});

describe("guest adapter", () => {
  it("reports no applications or profile and never touches remote storage", async () => {
    const adapter = createApplicationStorageAdapter({ session: null });

    expect(await adapter.listApplications()).toEqual([]);
    expect(await adapter.loadApplicationById("app-1")).toBeNull();
    expect(await adapter.ensureApplicantProfile()).toBeNull();
    expect(await adapter.loadApplicantProfile()).toBeNull();
    expect(await adapter.findOpenDraftForCourse("MBA-101", [baseSummary])).toBeNull();

    expect(listRemoteApplications).not.toHaveBeenCalled();
    expect(loadRemoteApplicationById).not.toHaveBeenCalled();
  });

  it("rejects writes because applications require authentication", async () => {
    const adapter = createApplicationStorageAdapter({ session: null });

    await expect(adapter.saveApplication(minimalApplicationData)).rejects.toThrow(
      "Applications require an authenticated session.",
    );
    await expect(
      adapter.submitApplication(minimalApplicationData),
    ).rejects.toThrow("Applications require an authenticated session.");
    expect(saveRemoteApplication).not.toHaveBeenCalled();
    expect(submitRemoteApplication).not.toHaveBeenCalled();
  });
});

describe("remote adapter delegation", () => {
  it("listApplications delegates to listRemoteApplications with the session", async () => {
    listRemoteApplications.mockResolvedValueOnce([baseSummary]);
    const adapter = createApplicationStorageAdapter({ session });

    const result = await adapter.listApplications();

    expect(listRemoteApplications).toHaveBeenCalledWith(session);
    expect(result).toEqual([baseSummary]);
  });

  it("loadApplicationById forwards the application id and the session", async () => {
    loadRemoteApplicationById.mockResolvedValueOnce(null);
    const adapter = createApplicationStorageAdapter({ session });

    const result = await adapter.loadApplicationById("missing");

    expect(loadRemoteApplicationById).toHaveBeenCalledWith(session, "missing");
    expect(result).toBeNull();
  });

  it("deleteApplication delegates to deleteRemoteApplication", async () => {
    deleteRemoteApplication.mockResolvedValueOnce(undefined);
    const adapter = createApplicationStorageAdapter({ session });

    await adapter.deleteApplication("app-9");

    expect(deleteRemoteApplication).toHaveBeenCalledWith(session, "app-9");
  });

  it("submitApplication decorates the application with the RPC result", async () => {
    submitRemoteApplication.mockResolvedValueOnce({
      applicationId: "app-1",
      applicationNumber: "APP-0001",
      submittedAt: "2026-04-10T01:00:00Z",
    });
    const adapter = createApplicationStorageAdapter({ session });

    const result = await adapter.submitApplication(minimalApplicationData);

    expect(submitRemoteApplication).toHaveBeenCalledWith(
      session,
      minimalApplicationData,
    );
    expect(result.applicationMeta).toMatchObject({
      applicationNumber: "APP-0001",
      recordId: "app-1",
      status: "submitted",
      submittedAt: "2026-04-10T01:00:00Z",
    });
  });

  it("findOpenDraftForCourse picks the draft matching the course code", async () => {
    const adapter = createApplicationStorageAdapter({ session });

    const submitted: ApplicationSummary = {
      ...baseSummary,
      id: "app-2",
      status: "submitted",
    };
    const draftWrongCourse: ApplicationSummary = {
      ...baseSummary,
      id: "app-3",
      course: { ...baseSummary.course, code: "OTHER-1" },
    };

    const found = await adapter.findOpenDraftForCourse("MBA-101", [
      submitted,
      draftWrongCourse,
      baseSummary,
    ]);

    expect(found).toBe(baseSummary);
  });

  it("findOpenDraftForCourse returns null when no draft matches", async () => {
    const adapter = createApplicationStorageAdapter({ session });
    const submitted: ApplicationSummary = {
      ...baseSummary,
      status: "submitted",
    };

    const found = await adapter.findOpenDraftForCourse("MBA-101", [submitted]);

    expect(found).toBeNull();
  });
});
