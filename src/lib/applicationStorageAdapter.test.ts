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

const findLocalApplicationById = vi.fn();
const findLocalOpenApplicationForCourse = vi.fn();
const loadLocalApplications = vi.fn();
const loadLocalActiveApplicationId = vi.fn();
const saveLocalActiveApplicationId = vi.fn();
const saveLocalApplications = vi.fn();
const upsertLocalApplication = vi.fn();
const summarizeApplication = vi.fn();

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

vi.mock("./applicationRecords", async () => {
  const actual =
    await vi.importActual<typeof import("./applicationRecords")>(
      "./applicationRecords",
    );
  return {
    ...actual,
    findLocalApplicationById,
    findLocalOpenApplicationForCourse,
    loadLocalApplications,
    loadLocalActiveApplicationId,
    saveLocalActiveApplicationId,
    saveLocalApplications,
    upsertLocalApplication,
    summarizeApplication,
  };
});

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
    findLocalApplicationById,
    findLocalOpenApplicationForCourse,
    loadLocalApplications,
    loadLocalActiveApplicationId,
    saveLocalActiveApplicationId,
    saveLocalApplications,
    upsertLocalApplication,
    summarizeApplication,
  ]) {
    fn.mockReset();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createApplicationStorageAdapter", () => {
  it("returns a local adapter when mode is 'local'", () => {
    const adapter = createApplicationStorageAdapter({
      mode: "local",
      session: null,
    });
    expect(adapter.mode).toBe("local");
  });

  it("returns a local adapter even when a session is supplied with mode 'local'", () => {
    const adapter = createApplicationStorageAdapter({
      mode: "local",
      session,
    });
    expect(adapter.mode).toBe("local");
  });

  it("returns a remote adapter when mode is 'remote' and a session is supplied", () => {
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });
    expect(adapter.mode).toBe("remote");
  });

  it("throws when remote mode is requested without a session", () => {
    expect(() =>
      createApplicationStorageAdapter({ mode: "remote", session: null }),
    ).toThrow("Remote storage mode requires an authenticated session.");
  });
});

describe("remote adapter delegation", () => {
  it("listApplications delegates to listRemoteApplications with the session", async () => {
    listRemoteApplications.mockResolvedValueOnce([baseSummary]);
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

    const result = await adapter.listApplications();

    expect(listRemoteApplications).toHaveBeenCalledWith(session);
    expect(result).toEqual([baseSummary]);
  });

  it("loadApplicationById forwards the application id and the session", async () => {
    loadRemoteApplicationById.mockResolvedValueOnce(null);
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

    const result = await adapter.loadApplicationById("missing");

    expect(loadRemoteApplicationById).toHaveBeenCalledWith(session, "missing");
    expect(result).toBeNull();
  });

  it("deleteApplication delegates to deleteRemoteApplication", async () => {
    deleteRemoteApplication.mockResolvedValueOnce(undefined);
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

    await adapter.deleteApplication("app-9");

    expect(deleteRemoteApplication).toHaveBeenCalledWith(session, "app-9");
  });

  it("submitApplication decorates the application with the RPC result", async () => {
    submitRemoteApplication.mockResolvedValueOnce({
      applicationId: "app-1",
      applicationNumber: "APP-0001",
      submittedAt: "2026-04-10T01:00:00Z",
    });
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

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
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

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
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });
    const submitted: ApplicationSummary = {
      ...baseSummary,
      status: "submitted",
    };

    const found = await adapter.findOpenDraftForCourse("MBA-101", [submitted]);

    expect(found).toBeNull();
  });

  it("syncLoadedApplication writes through to upsertLocalApplication", () => {
    const adapter = createApplicationStorageAdapter({ mode: "remote", session });

    adapter.syncLoadedApplication(minimalApplicationData);

    expect(upsertLocalApplication).toHaveBeenCalledWith(minimalApplicationData);
  });
});

describe("local adapter delegation", () => {
  it("listApplications maps loadLocalApplications through summarizeApplication", async () => {
    loadLocalApplications.mockReturnValueOnce([
      minimalApplicationData,
      minimalApplicationData,
    ]);
    summarizeApplication.mockReturnValueOnce({
      ...baseSummary,
      updatedAt: "2026-04-02T00:00:00Z",
    });
    summarizeApplication.mockReturnValueOnce({
      ...baseSummary,
      id: "app-newer",
      updatedAt: "2026-04-03T00:00:00Z",
    });

    const adapter = createApplicationStorageAdapter({
      mode: "local",
      session: null,
    });

    const result = await adapter.listApplications();

    expect(loadLocalApplications).toHaveBeenCalled();
    expect(result.map((summary) => summary.id)).toEqual(["app-newer", "app-1"]);
  });

  it("deleteApplication clears the active id when it matches the deletion target", async () => {
    loadLocalApplications.mockReturnValueOnce([minimalApplicationData]);
    loadLocalActiveApplicationId.mockReturnValueOnce("app-1");

    const adapter = createApplicationStorageAdapter({
      mode: "local",
      session: null,
    });

    await adapter.deleteApplication("app-1");

    expect(saveLocalApplications).toHaveBeenCalledWith([]);
    expect(saveLocalActiveApplicationId).toHaveBeenCalledWith(null);
  });
});
