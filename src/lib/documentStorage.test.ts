import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: Error | null };

interface MockQuery {
  calls: Array<{ method: string; args: unknown[] }>;
  select: (...args: unknown[]) => MockQuery;
  eq: (...args: unknown[]) => MockQuery;
  insert: (...args: unknown[]) => MockQuery;
  update: (...args: unknown[]) => MockQuery;
  delete: (...args: unknown[]) => MockQuery;
  in: (...args: unknown[]) => MockQuery;
  gte: (...args: unknown[]) => MockQuery;
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
    in(...args) {
      this.calls.push({ method: "in", args });
      return this;
    },
    gte(...args) {
      this.calls.push({ method: "gte", args });
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

interface StorageBucket {
  removeCalls: Array<{ paths: string[] }>;
  remove: (paths: string[]) => Promise<{ data: unknown; error: Error | null }>;
}

interface MockClient {
  fromCalls: Array<{ table: string; query: MockQuery }>;
  storageFromCalls: Array<{ bucket: string }>;
  tableResults: Map<string, QueryResult[]>;
  storageRemoveResult: { data: unknown; error: Error | null };
  storageBuckets: Map<string, StorageBucket>;
  from: (table: string) => MockQuery;
  storage: { from: (bucket: string) => StorageBucket };
}

function createMockClient(): MockClient {
  const client: MockClient = {
    fromCalls: [],
    storageFromCalls: [],
    tableResults: new Map(),
    storageRemoveResult: { data: null, error: null },
    storageBuckets: new Map(),
    from(table) {
      const queue = this.tableResults.get(table);
      const result = queue?.shift() ?? { data: null, error: null };
      const query = createQuery(result);
      this.fromCalls.push({ table, query });
      return query;
    },
    storage: {
      from(bucket: string) {
        client.storageFromCalls.push({ bucket });
        let cached = client.storageBuckets.get(bucket);
        if (!cached) {
          cached = {
            removeCalls: [],
            remove(paths: string[]) {
              this.removeCalls.push({ paths });
              return Promise.resolve(client.storageRemoveResult);
            },
          };
          client.storageBuckets.set(bucket, cached);
        }
        return cached;
      },
    },
  };

  return client;
}

const mockClient = createMockClient();

vi.mock("./supabase", () => ({
  supabase: mockClient,
}));

const { deleteStoredDocument, formatFileSize } = await import(
  "./documentStorage"
);

beforeEach(() => {
  mockClient.fromCalls = [];
  mockClient.storageFromCalls = [];
  mockClient.tableResults.clear();
  mockClient.storageBuckets.clear();
  mockClient.storageRemoveResult = { data: null, error: null };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("formatFileSize", () => {
  it("returns null for missing or non-positive sizes", () => {
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
    expect(formatFileSize(-100)).toBeNull();
  });

  it("formats sub-megabyte values as kilobytes with a 1 KB floor", () => {
    expect(formatFileSize(100)).toBe("1 KB");
    expect(formatFileSize(2_048)).toBe("2 KB");
    expect(formatFileSize(1_048_575)).toBe("1024 KB");
  });

  it("formats megabyte and larger values with one decimal place", () => {
    expect(formatFileSize(1_048_576)).toBe("1.0 MB");
    expect(formatFileSize(5_242_880)).toBe("5.0 MB");
    expect(formatFileSize(2_500_000)).toBe("2.4 MB");
  });
});

describe("deleteStoredDocument", () => {
  it("is a no-op when given undefined", async () => {
    await expect(deleteStoredDocument(undefined)).resolves.toBeUndefined();
    expect(mockClient.fromCalls).toEqual([]);
    expect(mockClient.storageFromCalls).toEqual([]);
  });

  it("removes a remote document from storage and the metadata table", async () => {
    mockClient.tableResults.set("application_documents", [
      { data: null, error: null },
    ]);

    await deleteStoredDocument({
      id: "doc-1",
      name: "transcript.pdf",
      size: 100,
      type: "application/pdf",
      lastModified: 0,
      uploadedAt: "2026-04-01T00:00:00Z",
      source: "remote",
      storageBucket: "application-documents",
      storagePath: "user-9/app-1/transcript/doc-1-transcript.pdf",
    });

    expect(mockClient.storageFromCalls).toEqual([
      { bucket: "application-documents" },
    ]);
    expect(
      mockClient.storageBuckets.get("application-documents")?.removeCalls,
    ).toEqual([
      { paths: ["user-9/app-1/transcript/doc-1-transcript.pdf"] },
    ]);

    expect(mockClient.fromCalls[0]?.table).toBe("application_documents");
    expect(mockClient.fromCalls[0]?.query.calls).toEqual([
      { method: "delete", args: [] },
      { method: "eq", args: ["id", "doc-1"] },
    ]);
  });

  it("propagates a storage removal failure without touching the metadata table", async () => {
    mockClient.storageRemoveResult = {
      data: null,
      error: new Error("storage offline"),
    };

    await expect(
      deleteStoredDocument({
        id: "doc-2",
        name: "x.pdf",
        size: 1,
        type: "application/pdf",
        lastModified: 0,
        uploadedAt: "2026-04-02T00:00:00Z",
        source: "remote",
        storageBucket: "application-documents",
        storagePath: "user-9/app-1/cv/doc-2-x.pdf",
      }),
    ).rejects.toThrow("storage offline");

    expect(mockClient.fromCalls).toEqual([]);
  });

  it("propagates a metadata delete failure", async () => {
    mockClient.tableResults.set("application_documents", [
      { data: null, error: new Error("constraint violation") },
    ]);

    await expect(
      deleteStoredDocument({
        id: "doc-3",
        name: "x.pdf",
        size: 1,
        type: "application/pdf",
        lastModified: 0,
        uploadedAt: "2026-04-03T00:00:00Z",
        source: "remote",
        storageBucket: "application-documents",
        storagePath: "user-9/app-1/cv/doc-3-x.pdf",
      }),
    ).rejects.toThrow("constraint violation");
  });
});
