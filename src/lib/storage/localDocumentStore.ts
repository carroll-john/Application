const DATABASE_NAME = "application-prototype-documents";
const STORE_NAME = "documents";
const DATABASE_VERSION = 1;

export interface StoredDocumentRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  uploadedAt: string;
  source?: "local" | "remote";
  storageBucket?: string;
  storagePath?: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveLocalDocumentFile(
  file: File,
  document: {
    id: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
    uploadedAt: string;
  },
) {
  await withStore("readwrite", (store) =>
    store.put({
      ...document,
      blob: file,
      source: "local",
    } satisfies StoredDocumentRecord),
  );
}

export async function loadLocalDocumentFile(id: string): Promise<File | null> {
  const stored = await withStore<StoredDocumentRecord | undefined>(
    "readonly",
    (store) => store.get(id),
  );

  if (!stored) {
    return null;
  }

  return new File([stored.blob], stored.name, {
    type: stored.type,
    lastModified: stored.lastModified,
  });
}

export async function deleteLocalDocument(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function clearStoredDocuments(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
