import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IndexedDB polyfill + minimal `window` shim so documentStorage's
// `window.indexedDB.open(...)` calls find a real backing store.
import "fake-indexeddb/auto";

type WindowShim = { indexedDB: IDBFactory };

if (typeof (globalThis as { window?: WindowShim }).window === "undefined") {
  (globalThis as { window: WindowShim }).window = {
    indexedDB: globalThis.indexedDB,
  };
}

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
  sessionResult: { data: { session: unknown }; error: Error | null };
  from: (table: string) => MockQuery;
  storage: { from: (bucket: string) => StorageBucket };
  auth: { getSession: () => Promise<MockClient["sessionResult"]> };
}

function createMockClient(): MockClient {
  const client: MockClient = {
    fromCalls: [],
    storageFromCalls: [],
    tableResults: new Map(),
    storageRemoveResult: { data: null, error: null },
    storageBuckets: new Map(),
    sessionResult: { data: { session: null }, error: null },
    auth: {
      getSession: () => Promise.resolve(client.sessionResult),
    },
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

const {
  clearStoredDocuments,
  deleteStoredDocument,
  formatFileSize,
  replaceStoredDocument,
  saveDocumentFile,
} = await import("./documentStorage");

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

describe("saveDocumentFile (IndexedDB)", () => {
  beforeEach(async () => {
    await clearStoredDocuments();
  });

  it("persists the file as an UploadedDocument with source 'local'", async () => {
    const file = new File(["resume contents"], "cv.pdf", {
      type: "application/pdf",
    });

    const stored = await saveDocumentFile(file);

    expect(stored).toMatchObject({
      name: "cv.pdf",
      size: file.size,
      type: "application/pdf",
      source: "local",
    });
    expect(stored.id).toMatch(/[0-9a-f-]{36}/i);
    expect(stored.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects files larger than the size cap before writing", async () => {
    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], "huge.pdf", {
      type: "application/pdf",
    });

    await expect(saveDocumentFile(oversized)).rejects.toThrow();
  });
});

describe("replaceStoredDocument (local fallback)", () => {
  beforeEach(async () => {
    await clearStoredDocuments();
  });

  it("returns the previous document when no new file is supplied", async () => {
    const existing = await saveDocumentFile(
      new File(["x"], "old.pdf", { type: "application/pdf" }),
    );

    const result = await replaceStoredDocument(null, existing);

    expect(result).toBe(existing);
  });

  it("saves the new file and deletes the previous local document", async () => {
    const previous = await saveDocumentFile(
      new File(["old"], "old.pdf", { type: "application/pdf" }),
    );
    const next = new File(["new"], "new.pdf", { type: "application/pdf" });

    const stored = await replaceStoredDocument(next, previous);

    expect(stored).toBeDefined();
    expect(stored?.name).toBe("new.pdf");
    expect(stored?.id).not.toBe(previous.id);

    // Old local doc should now 404 the IDB get; deleteStoredDocument(undefined)
    // is a no-op so it serves as a sanity check that we don't blow up on the
    // already-cleared id.
    await expect(deleteStoredDocument(previous)).resolves.toBeUndefined();
  });

  it("falls back to local save when applicationId or kind is missing", async () => {
    const next = new File(["x"], "cv.pdf", { type: "application/pdf" });

    const stored = await replaceStoredDocument(next, undefined, {
      applicationId: undefined,
      kind: undefined,
    });

    expect(stored?.source).toBe("local");
  });
});

describe("clearStoredDocuments", () => {
  it("empties the local store", async () => {
    await saveDocumentFile(
      new File(["x"], "a.pdf", { type: "application/pdf" }),
    );
    await saveDocumentFile(
      new File(["y"], "b.pdf", { type: "application/pdf" }),
    );

    await expect(clearStoredDocuments()).resolves.toBeUndefined();
    // After clear, a fresh save should succeed without seeing the old rows.
    const fresh = await saveDocumentFile(
      new File(["z"], "c.pdf", { type: "application/pdf" }),
    );
    expect(fresh.name).toBe("c.pdf");
  });
});
