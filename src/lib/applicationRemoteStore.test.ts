import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

type QueryResult = { data: unknown; error: Error | null };

interface MockQuery {
  calls: Array<{ method: string; args: unknown[] }>;
  select: (...args: unknown[]) => MockQuery;
  eq: (...args: unknown[]) => MockQuery;
  order: (...args: unknown[]) => MockQuery;
  insert: (...args: unknown[]) => MockQuery;
  update: (...args: unknown[]) => MockQuery;
  delete: (...args: unknown[]) => MockQuery;
  single: (...args: unknown[]) => MockQuery;
  maybeSingle: (...args: unknown[]) => MockQuery;
  then: <R>(onfulfilled: (value: QueryResult) => R) => Promise<R>;
}

function createQuery(result: QueryResult): MockQuery {
  const query: MockQuery = {
    calls: [],
    select(...args) {
      this.calls.push({ method: "select", args });
      return this;
    },
    eq(...args) {
      this.calls.push({ method: "eq", args });
      return this;
    },
    order(...args) {
      this.calls.push({ method: "order", args });
      return this;
    },
    insert(...args) {
      this.calls.push({ method: "insert", args });
      return this;
    },
    update(...args) {
      this.calls.push({ method: "update", args });
      return this;
    },
    delete(...args) {
      this.calls.push({ method: "delete", args });
      return this;
    },
    single(...args) {
      this.calls.push({ method: "single", args });
      return this;
    },
    maybeSingle(...args) {
      this.calls.push({ method: "maybeSingle", args });
      return this;
    },
    then<R>(onfulfilled: (value: QueryResult) => R) {
      return Promise.resolve(result).then(onfulfilled);
    },
  };

  return query;
}

interface MockClient {
  fromCalls: Array<{ table: string; query: MockQuery }>;
  rpcCalls: Array<{ name: string; args: unknown }>;
  tableResults: Map<string, QueryResult[]>;
  rpcResults: Map<string, QueryResult>;
  from: (table: string) => MockQuery;
  rpc: (name: string, args: unknown) => Promise<QueryResult>;
}

function createMockClient(): MockClient {
  const client: MockClient = {
    fromCalls: [],
    rpcCalls: [],
    tableResults: new Map(),
    rpcResults: new Map(),
    from(table) {
      const queue = this.tableResults.get(table);
      const result = queue?.shift() ?? { data: null, error: null };
      const query = createQuery(result);
      this.fromCalls.push({ table, query });
      return query;
    },
    rpc(name, args) {
      this.rpcCalls.push({ name, args });
      const result = this.rpcResults.get(name) ?? {
        data: null,
        error: new Error(`rpc "${name}" not configured`),
      };
      return Promise.resolve(result);
    },
  };

  return client;
}

const mockClient = createMockClient();

vi.mock("./supabase", () => ({
  supabase: mockClient,
}));

vi.mock("./courseCatalog", () => ({
  getDefaultCourse: () => ({
    code: "DEFAULT-101",
    eligibility: {
      rules: [{ type: "min_education", minEducation: "Bachelor degree" }],
    },
    title: "Default Course",
    provider: "Default University",
    intakeLabel: "Default Intake",
  }),
  getCourseByCode: (code: string | null | undefined) =>
    code === "MATCHED-202"
        ? {
            code: "MATCHED-202",
            eligibility: {
              rules: [{ type: "min_education", minEducation: "Bachelor degree" }],
            },
            title: "Matched Course",
            provider: "Matched University",
            intakeLabel: "Matched Intake",
        }
      : undefined,
}));

const {
  deleteRemoteApplication,
  listRemoteApplications,
  loadRemoteApplicationById,
  saveRemoteApplication,
  submitRemoteApplication,
} = await import("./applicationRemoteStore");

const session = {
  user: { id: "user-123", email: "applicant@example.com" },
} as unknown as Session;

beforeEach(() => {
  mockClient.fromCalls = [];
  mockClient.rpcCalls = [];
  mockClient.tableResults.clear();
  mockClient.rpcResults.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("listRemoteApplications", () => {
  it("scopes the query to the current user and maps rows into summaries", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: [
          {
            id: "app-1",
            applicant_profile_id: "profile-1",
            application_number: "APP-0001",
            course_code: "MATCHED-202",
            course_title: "Stored Title",
            intake_label: "Stored Intake",
            personal_details: { firstName: "Pat" },
            contact_details: null,
            cv_document_id: null,
            cv_file_name: "cv.pdf",
            status: "draft",
            submitted_at: null,
            created_at: "2026-04-01T00:00:00Z",
            updated_at: "2026-04-02T00:00:00Z",
          },
        ],
        error: null,
      },
    ]);

    const summaries = await listRemoteApplications(session);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: "app-1",
      applicationNumber: "APP-0001",
      status: "draft",
    });

    const query = mockClient.fromCalls[0]?.query;
    expect(mockClient.fromCalls[0]?.table).toBe("applications");
    expect(query?.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "eq", args: ["user_id", "user-123"] }),
        expect.objectContaining({ method: "order", args: ["updated_at", { ascending: false }] }),
      ]),
    );
  });

  it("throws when supabase reports an error", async () => {
    mockClient.tableResults.set("applications", [
      { data: null, error: new Error("permission denied") },
    ]);

    await expect(listRemoteApplications(session)).rejects.toThrow("permission denied");
  });

  it("returns an empty array when the user has no applications", async () => {
    mockClient.tableResults.set("applications", [{ data: [], error: null }]);

    await expect(listRemoteApplications(session)).resolves.toEqual([]);
  });
});

describe("loadRemoteApplicationById", () => {
  it("returns null when the application is not found", async () => {
    mockClient.tableResults.set("applications", [{ data: null, error: null }]);

    const result = await loadRemoteApplicationById(session, "missing-id");

    expect(result).toBeNull();
    const query = mockClient.fromCalls[0]?.query;
    expect(query?.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "eq", args: ["id", "missing-id"] }),
        expect.objectContaining({ method: "eq", args: ["user_id", "user-123"] }),
        expect.objectContaining({ method: "maybeSingle", args: [] }),
      ]),
    );
  });

  it("propagates supabase errors when fetching the application", async () => {
    mockClient.tableResults.set("applications", [
      { data: null, error: new Error("network down") },
    ]);

    await expect(loadRemoteApplicationById(session, "any")).rejects.toThrow("network down");
  });
});

describe("saveRemoteApplication", () => {
  it("inserts a new remote row when the draft only has a local record id", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    const result = await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "local-550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
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
      } as any,
      { forceCreate: true },
    );

    expect(result).toEqual({
      applicantProfileId: "profile-1",
      applicationId: "550e8400-e29b-41d4-a716-446655440000",
      applicationNumber: undefined,
      submittedAt: undefined,
      updatedAt: "2026-04-10T00:00:00Z",
    });

    const query = mockClient.fromCalls[0]?.query;
    expect(query?.calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "insert", args: [expect.any(Object)] })]),
    );
    expect(query?.calls).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "update", args: expect.any(Array) })]),
    );
  });

  it("drops local-only applicant profile ids before insert", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          applicant_profile_id: null,
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "local-550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "local-profile:john.carroll@keypathedu.com.au",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
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
      } as any,
      {
        applicantProfileId: "local-profile:john.carroll@keypathedu.com.au",
        forceCreate: true,
      },
    );

    const insertCall = mockClient.fromCalls[0]?.query.calls.find(
      (call) => call.method === "insert",
    );

    expect(insertCall?.args[0]).toMatchObject({
      applicant_profile_id: null,
    });
  });

  it("inserts a fresh remote row when the client record id no longer exists", async () => {
    mockClient.tableResults.set("applications", [
      { data: null, error: null },
      {
        data: {
          id: "660e8400-e29b-41d4-a716-446655440001",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    const result = await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
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
      } as any,
      { forceCreate: true },
    );

    expect(result?.applicationId).toBe("660e8400-e29b-41d4-a716-446655440001");

    const updateQuery = mockClient.fromCalls[0]?.query;
    expect(updateQuery?.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "update", args: [expect.any(Object)] }),
        expect.objectContaining({ method: "maybeSingle", args: [] }),
      ]),
    );

    const insertQuery = mockClient.fromCalls[1]?.query;
    expect(insertQuery?.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "insert",
          args: [expect.objectContaining({ id: undefined })],
        }),
      ]),
    );
  });

  it("drops stale cv document references before upserting the application row", async () => {
    mockClient.tableResults.set("application_documents", [
      { data: null, error: null },
    ]);
    mockClient.tableResults.set("applications", [
      { data: null, error: null },
      {
        data: {
          id: "660e8400-e29b-41d4-a716-446655440002",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvDocument: {
          id: "770e8400-e29b-41d4-a716-446655440000",
          name: "stale.pdf",
          size: 1024,
          type: "application/pdf",
          lastModified: Date.now(),
          uploadedAt: new Date().toISOString(),
          source: "remote",
        },
        cvFileName: "stale.pdf",
        cvUploaded: true,
        tertiaryQualifications: [],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { forceCreate: true },
    );

    expect(mockClient.fromCalls[0]?.table).toBe("application_documents");
    const insertCall = mockClient.fromCalls[2]?.query.calls.find(
      (call) => call.method === "insert",
    );
    expect(insertCall?.args[0]).toMatchObject({
      cv_document_id: null,
      cv_file_name: null,
    });
  });

  it("preserves valid cv document references when metadata exists", async () => {
    mockClient.tableResults.set("application_documents", [
      {
        data: { id: "770e8400-e29b-41d4-a716-446655440000" },
        error: null,
      },
    ]);
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvDocument: {
          id: "770e8400-e29b-41d4-a716-446655440000",
          name: "current.pdf",
          size: 1024,
          type: "application/pdf",
          lastModified: Date.now(),
          uploadedAt: new Date().toISOString(),
          source: "remote",
        },
        cvFileName: "current.pdf",
        cvUploaded: true,
        tertiaryQualifications: [],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { forceCreate: true },
    );

    const updateCall = mockClient.fromCalls[1]?.query.calls.find(
      (call) => call.method === "update",
    );
    expect(updateCall?.args[0]).toMatchObject({
      cv_document_id: "770e8400-e29b-41d4-a716-446655440000",
      cv_file_name: "current.pdf",
    });
    expect(
      mockClient.fromCalls.some((call) => call.query.calls.some(({ method }) => method === "insert")),
    ).toBe(false);
  });

  it("drops stale cv document references when updating an existing application row", async () => {
    mockClient.tableResults.set("application_documents", [
      { data: null, error: null },
    ]);
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvDocument: {
          id: "770e8400-e29b-41d4-a716-446655440000",
          name: "stale.pdf",
          size: 1024,
          type: "application/pdf",
          lastModified: Date.now(),
          uploadedAt: new Date().toISOString(),
          source: "remote",
        },
        cvFileName: "stale.pdf",
        cvUploaded: true,
        tertiaryQualifications: [],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { forceCreate: true },
    );

    const updateCall = mockClient.fromCalls[1]?.query.calls.find(
      (call) => call.method === "update",
    );
    expect(updateCall?.args[0]).toMatchObject({
      cv_document_id: null,
      cv_file_name: null,
    });
    expect(
      mockClient.fromCalls.some((call) => call.query.calls.some(({ method }) => method === "insert")),
    ).toBe(false);
  });

  it("skips cv document lookup for local-only cv metadata", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);

    await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "550e8400-e29b-41d4-a716-446655440000",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvDocument: {
          id: "local-doc-1",
          name: "draft.pdf",
          size: 1024,
          type: "application/pdf",
          lastModified: Date.now(),
          uploadedAt: new Date().toISOString(),
          source: "local",
        },
        cvFileName: "draft.pdf",
        cvUploaded: true,
        tertiaryQualifications: [],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { forceCreate: true },
    );

    expect(mockClient.fromCalls[0]?.table).toBe("applications");
    expect(mockClient.fromCalls.some((call) => call.table === "application_documents")).toBe(
      false,
    );
  });

  it("skips child-table rewrites when shellOnly is true", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "770e8400-e29b-41d4-a716-446655440003",
          applicant_profile_id: "profile-1",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);

    const result = await saveRemoteApplication(
      session,
      {
        applicationMeta: {
          recordId: "770e8400-e29b-41d4-a716-446655440003",
          applicantProfileId: "profile-1",
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvDocument: undefined,
        cvFileName: undefined,
        cvUploaded: false,
        tertiaryQualifications: [
          {
            id: "qual-1",
            institution: "Example Uni",
            country: "Australia",
            level: "Bachelor",
            courseName: "Example",
            startMonth: "January",
            startYear: "2020",
            completed: true,
            endMonth: "December",
            endYear: "2023",
          },
        ],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { forceCreate: true, shellOnly: true },
    );

    expect(result?.applicationId).toBe("770e8400-e29b-41d4-a716-446655440003");
    expect(mockClient.fromCalls.every((call) => call.table === "applications")).toBe(true);
  });
});

describe("submitRemoteApplication", () => {
  it("calls submit_application with the saved application id", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "app-2",
          applicant_profile_id: "profile-2",
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-10T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);
    mockClient.rpcResults.set("submit_application", {
      data: {
        applicationId: "app-2",
        applicationNumber: "APP-0002",
        submittedAt: "2026-04-10T01:00:00Z",
      },
      error: null,
    });

    const result = await submitRemoteApplication(session, {
      applicationMeta: {
        recordId: undefined,
        applicantProfileId: "profile-2",
        selectedCourse: {
          code: "MATCHED-202",
          title: "Matched Course",
          provider: "Matched University",
          intake: "Matched Intake",
        },
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
    } as any);

    expect(result).toEqual({
      applicationId: "app-2",
      applicationNumber: "APP-0002",
      submittedAt: "2026-04-10T01:00:00Z",
    });
    expect(mockClient.rpcCalls).toEqual([
      { name: "submit_application", args: { target_application_id: "app-2" } },
    ]);
  });

  it("throws when submit_application RPC returns an error", async () => {
    mockClient.tableResults.set("applications", [
      {
        data: {
          id: "app-3",
          applicant_profile_id: null,
          application_number: null,
          submitted_at: null,
          updated_at: "2026-04-11T00:00:00Z",
        },
        error: null,
      },
    ]);
    mockClient.tableResults.set("tertiary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("employment_experiences", [{ data: null, error: null }]);
    mockClient.tableResults.set("professional_accreditations", [{ data: null, error: null }]);
    mockClient.tableResults.set("secondary_qualifications", [{ data: null, error: null }]);
    mockClient.tableResults.set("language_tests", [{ data: null, error: null }]);
    mockClient.rpcResults.set("submit_application", {
      data: null,
      error: new Error("submission_grant_required"),
    });

    await expect(
      submitRemoteApplication(session, {
        applicationMeta: {
          recordId: undefined,
          selectedCourse: {
            code: "MATCHED-202",
            title: "Matched Course",
            provider: "Matched University",
            intake: "Matched Intake",
          },
        },
        personalDetails: {},
        contactDetails: {},
        cvUploaded: false,
        tertiaryQualifications: [],
        employmentExperiences: [],
        professionalAccreditations: [],
        secondaryQualifications: [],
        languageTests: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).rejects.toThrow("submission_grant_required");
  });
});

describe("deleteRemoteApplication", () => {
  it("scopes the delete to the current user", async () => {
    mockClient.tableResults.set("applications", [{ data: null, error: null }]);

    await deleteRemoteApplication(session, "record-9");

    const query = mockClient.fromCalls[0]?.query;
    expect(query?.calls).toEqual([
      { method: "delete", args: [] },
      { method: "eq", args: ["id", "record-9"] },
      { method: "eq", args: ["user_id", "user-123"] },
    ]);
  });

  it("throws when supabase rejects the delete", async () => {
    mockClient.tableResults.set("applications", [
      { data: null, error: new Error("foreign key violation") },
    ]);

    await expect(deleteRemoteApplication(session, "x")).rejects.toThrow(
      "foreign key violation",
    );
  });
});
