import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

type QueryResult = { data: unknown; error: Error | null };

interface MockQuery {
  calls: Array<{ method: string; args: unknown[] }>;
  select: (...args: unknown[]) => MockQuery;
  eq: (...args: unknown[]) => MockQuery;
  order: (...args: unknown[]) => MockQuery;
  limit: (...args: unknown[]) => MockQuery;
  upsert: (...args: unknown[]) => MockQuery;
  update: (...args: unknown[]) => MockQuery;
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
    limit(...args) {
      this.calls.push({ method: "limit", args });
      return this;
    },
    upsert(...args) {
      this.calls.push({ method: "upsert", args });
      return this;
    },
    update(...args) {
      this.calls.push({ method: "update", args });
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
  tableResults: Map<string, QueryResult[]>;
  from: (table: string) => MockQuery;
}

function createMockClient(): MockClient {
  const client: MockClient = {
    fromCalls: [],
    tableResults: new Map(),
    from(table) {
      const queue = this.tableResults.get(table);
      const result = queue?.shift() ?? { data: null, error: null };
      const query = createQuery(result);
      this.fromCalls.push({ table, query });
      return query;
    },
  };

  return client;
}

const mockClient = createMockClient();

vi.mock("./supabase", () => ({
  supabase: mockClient,
}));

const {
  createSeededLocalApplicantProfile,
  ensureApplicantProfile,
  loadApplicantProfile,
  saveLocalApplicantProfile,
} = await import("./applicantProfileStore");

const session = {
  user: {
    id: "user-123",
    email: "john.carroll@keypathedu.com.au",
    user_metadata: {},
  },
} as unknown as Session;

beforeEach(() => {
  mockClient.fromCalls = [];
  mockClient.tableResults.clear();

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

  saveLocalApplicantProfile(
    createSeededLocalApplicantProfile("john.carroll@keypathedu.com.au"),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("applicantProfileStore", () => {
  it("seeds a stable local profile from a company email", () => {
    expect(
      createSeededLocalApplicantProfile("john.carroll@keypathedu.com.au"),
    ).toEqual({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      id: "local-profile:john.carroll@keypathedu.com.au",
      lastName: "Carroll",
    });
  });

  it("collapses aliases and separators into sensible name defaults", () => {
    expect(
      createSeededLocalApplicantProfile("jane_mary-smith+demo@keypathedu.com.au"),
    ).toEqual({
      email: "jane_mary-smith+demo@keypathedu.com.au",
      firstName: "Jane",
      id: "local-profile:jane_mary-smith+demo@keypathedu.com.au",
      lastName: "Mary Smith",
    });
  });

  it("keeps single-token emails usable", () => {
    expect(
      createSeededLocalApplicantProfile("operations@keypathedu.com.au"),
    ).toEqual({
      email: "operations@keypathedu.com.au",
      firstName: "Operations",
      id: "local-profile:operations@keypathedu.com.au",
      lastName: "",
    });
  });

  it("ignores stale remote profile ids cached locally when no remote profile exists", async () => {
    saveLocalApplicantProfile({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    mockClient.tableResults.set("applicant_profiles", [{ data: null, error: null }]);

    const profile = await loadApplicantProfile(session);

    expect(profile).toBeNull();
  });

  it("creates a remote profile when a signed-in user only has a local profile id", async () => {
    mockClient.tableResults.set("applicant_profiles", [
      { data: null, error: null },
      {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "john.carroll@keypathedu.com.au",
          first_name: "John",
          last_name: "Carroll",
        },
        error: null,
      },
    ]);

    const profile = await ensureApplicantProfile(session);

    expect(profile).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
    });

    const upsertQuery = mockClient.fromCalls[1]?.query;
    expect(upsertQuery?.calls.some((call) => call.method === "upsert")).toBe(true);
    expect(upsertQuery?.calls.some((call) => call.method === "update")).toBe(false);
  });

  it("recreates a remote profile when local storage only has a stale remote id", async () => {
    saveLocalApplicantProfile({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    mockClient.tableResults.set("applicant_profiles", [
      { data: null, error: null },
      {
        data: {
          id: "661e8400-e29b-41d4-a716-446655440001",
          email: "john.carroll@keypathedu.com.au",
          first_name: "John",
          last_name: "Carroll",
        },
        error: null,
      },
    ]);

    const profile = await ensureApplicantProfile(session);

    expect(profile).toEqual({
      id: "661e8400-e29b-41d4-a716-446655440001",
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
    });
  });
});
