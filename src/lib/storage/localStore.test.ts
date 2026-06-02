import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initialApplicationData, type ApplicationData, type SelectedCourse } from "../applicationData";
import {
  ACTIVE_APPLICATION_ID_STORAGE_KEY,
  APPLICATIONS_STORAGE_KEY,
  clearLocalApplications,
  createApplicationDraft,
  findLocalApplicationById,
  findLocalOpenApplicationForCourse,
  loadLocalActiveApplicationId,
  loadLocalApplications,
  saveLocalActiveApplicationId,
  saveLocalApplications,
  sortApplicationsForPrefillChooser,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "./localStore";

/**
 * Characterization tests for the local (localStorage-backed) application store.
 * Written against the pre-refactor module so its draft-creation, summary, sort,
 * and persistence behavior is locked before the file is decomposed.
 */

const COURSE: SelectedCourse = {
  code: "mba-online",
  title: "Master of Business Administration",
  provider: "Example University",
  intake: "March 2026",
};

function makeApplication(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return {
    ...initialApplicationData,
    ...overrides,
    applicationMeta: {
      ...initialApplicationData.applicationMeta,
      ...overrides.applicationMeta,
    },
  };
}

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApplicationDraft", () => {
  it("creates a draft with a local record id and the selected course", () => {
    const draft = createApplicationDraft(COURSE);
    expect(draft.applicationMeta.recordId).toMatch(/^local-/);
    expect(draft.applicationMeta.selectedCourse).toEqual(COURSE);
    expect(draft.applicationMeta.status).toBe("draft");
    expect(draft.applicationMeta.createdAt).toBe(draft.applicationMeta.updatedAt);
  });

  it("seeds personal details from the applicant profile", () => {
    const draft = createApplicationDraft(COURSE, "profile-1", {
      id: "profile-1",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(draft.applicationMeta.applicantProfileId).toBe("profile-1");
    expect(draft.personalDetails.firstName).toBe("Jane");
    expect(draft.personalDetails.lastName).toBe("Doe");
    expect(draft.personalDetails.email).toBe("jane@example.com");
  });

  it("clones source collections with fresh prefixed ids and records the prefill source", () => {
    const source = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-source",
        selectedCourse: { ...COURSE, code: "other-course" },
      },
      employmentExperiences: [
        {
          company: "Acme",
          currentRole: true,
          duties: "Work",
          endMonth: "",
          endYear: "",
          id: "employment-old",
          position: "Engineer",
          startMonth: "January",
          startYear: "2020",
          type: "Full-time",
        },
      ],
    });

    const draft = createApplicationDraft(COURSE, undefined, null, source);
    expect(draft.employmentExperiences).toHaveLength(1);
    expect(draft.employmentExperiences[0].id).toMatch(/^employment-/);
    expect(draft.employmentExperiences[0].id).not.toBe("employment-old");
    expect(draft.employmentExperiences[0].company).toBe("Acme");
    expect(draft.applicationMeta.prefilledFrom).toEqual({
      applicationId: "local-source",
      course: { ...COURSE, code: "other-course" },
    });
  });

  it("drops source documents when includeSourceDocuments is explicitly false", () => {
    const source = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-source",
        selectedCourse: COURSE,
      },
      cvFileName: "cv.pdf",
      cvUploaded: true,
    });
    const draft = createApplicationDraft(COURSE, undefined, null, source, {
      includeSourceDocuments: false,
    });
    expect(draft.cvDocument).toBeUndefined();
  });
});

describe("summarizeApplication", () => {
  it("returns null without a record id or course", () => {
    expect(summarizeApplication(makeApplication())).toBeNull();
  });

  it("summarizes a draft with course, status, and step counts", () => {
    const application = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-1",
        selectedCourse: COURSE,
        updatedAt: "2026-02-01T00:00:00Z",
      },
    });
    const summary = summarizeApplication(application);
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      id: "local-1",
      course: COURSE,
      status: "draft",
      updatedAt: "2026-02-01T00:00:00Z",
    });
    expect(typeof summary?.completionPercentage).toBe("number");
    expect(typeof summary?.totalStepCount).toBe("number");
  });

  it("reports submitted status when submittedAt is set", () => {
    const summary = summarizeApplication(
      makeApplication({
        applicationMeta: {
          ...initialApplicationData.applicationMeta,
          recordId: "local-2",
          selectedCourse: COURSE,
          submittedAt: "2026-03-01T00:00:00Z",
        },
      }),
    );
    expect(summary?.status).toBe("submitted");
  });
});

describe("sortApplicationsForPrefillChooser", () => {
  const base: ApplicationSummary = {
    completedStepCount: 0,
    completionPercentage: 0,
    course: { ...COURSE, code: "c" },
    id: "x",
    status: "draft",
    totalStepCount: 10,
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("excludes the target course and orders by completion then recency", () => {
    const apps: ApplicationSummary[] = [
      { ...base, id: "target", course: { ...COURSE, code: "target" }, completionPercentage: 99 },
      { ...base, id: "low", course: { ...COURSE, code: "a" }, completionPercentage: 20 },
      { ...base, id: "high", course: { ...COURSE, code: "b" }, completionPercentage: 80 },
    ];
    const sorted = sortApplicationsForPrefillChooser(apps, "target");
    expect(sorted.map((a) => a.id)).toEqual(["high", "low"]);
  });
});

describe("persistence round-trip", () => {
  it("saves and loads applications", () => {
    const application = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-1",
        selectedCourse: COURSE,
      },
    });
    saveLocalApplications([application]);
    const loaded = loadLocalApplications();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].applicationMeta.recordId).toBe("local-1");
  });

  it("upserts: inserts a new application then updates it in place", () => {
    const application = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-1",
        selectedCourse: COURSE,
      },
    });
    upsertLocalApplication(application);
    expect(loadLocalApplications()).toHaveLength(1);
    expect(loadLocalActiveApplicationId()).toBe("local-1");

    upsertLocalApplication({
      ...application,
      personalDetails: { ...application.personalDetails, firstName: "Updated" },
    });
    const loaded = loadLocalApplications();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].personalDetails.firstName).toBe("Updated");
  });

  it("finds by id and finds an open (unsubmitted) application for a course", () => {
    const application = makeApplication({
      applicationMeta: {
        ...initialApplicationData.applicationMeta,
        recordId: "local-1",
        selectedCourse: COURSE,
      },
    });
    saveLocalApplications([application]);
    expect(findLocalApplicationById("local-1")?.applicationMeta.recordId).toBe("local-1");
    expect(findLocalOpenApplicationForCourse(COURSE.code)?.applicationMeta.recordId).toBe(
      "local-1",
    );
    expect(findLocalApplicationById("missing")).toBeUndefined();
  });

  it("manages the active application id and clears all keys", () => {
    saveLocalActiveApplicationId("local-9");
    expect(loadLocalActiveApplicationId()).toBe("local-9");
    saveLocalActiveApplicationId(null);
    expect(loadLocalActiveApplicationId()).toBeNull();

    saveLocalApplications([
      makeApplication({
        applicationMeta: {
          ...initialApplicationData.applicationMeta,
          recordId: "local-1",
          selectedCourse: COURSE,
        },
      }),
    ]);
    saveLocalActiveApplicationId("local-1");
    clearLocalApplications();
    expect(window.localStorage.getItem(APPLICATIONS_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_APPLICATION_ID_STORAGE_KEY)).toBeNull();
  });
});
