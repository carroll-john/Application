interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface ExpiringStorageValue {
  expiresAt: number;
  value: string;
}

interface StorageAccessOptions {
  now?: () => number;
  storage?: StorageLike;
}

interface ReadExpiringStorageOptions extends StorageAccessOptions {
  normalize?: (value: string) => string;
  validate?: (value: string) => boolean;
}

function resolveStorage(storage?: StorageLike) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isExpiringStorageValue(value: unknown): value is ExpiringStorageValue {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ExpiringStorageValue>;

  return (
    typeof entry.value === "string" &&
    typeof entry.expiresAt === "number" &&
    Number.isFinite(entry.expiresAt)
  );
}

function normalizeValue(
  value: string,
  normalize?: (value: string) => string,
  validate?: (value: string) => boolean,
) {
  const normalized = normalize ? normalize(value) : value;

  if (!normalized) {
    return null;
  }

  if (validate && !validate(normalized)) {
    return null;
  }

  return normalized;
}

function removeStoredValue(storage: StorageLike, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore remove failures in restricted browser contexts.
  }
}

export function setExpiringStorageString(
  key: string,
  value: string,
  ttlMs: number,
  options?: StorageAccessOptions,
) {
  const storage = resolveStorage(options?.storage);

  if (!storage) {
    return;
  }

  const now = options?.now?.() ?? Date.now();
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.max(0, ttlMs) : 0;
  const payload: ExpiringStorageValue = {
    expiresAt: now + safeTtlMs,
    value,
  };

  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore write failures in restricted browser contexts.
  }
}

export function getExpiringStorageString(
  key: string,
  ttlMs: number,
  options?: ReadExpiringStorageOptions,
) {
  const storage = resolveStorage(options?.storage);

  if (!storage) {
    return null;
  }

  let storedValue: string | null;

  try {
    storedValue = storage.getItem(key);
  } catch {
    return null;
  }

  if (!storedValue) {
    return null;
  }

  const now = options?.now?.() ?? Date.now();

  try {
    const parsed = JSON.parse(storedValue) as unknown;

    if (isExpiringStorageValue(parsed)) {
      const normalizedValue = normalizeValue(
        parsed.value,
        options?.normalize,
        options?.validate,
      );

      if (!normalizedValue || parsed.expiresAt <= now) {
        removeStoredValue(storage, key);
        return null;
      }

      return normalizedValue;
    }
  } catch {
    // Fall through to legacy value handling.
  }

  const normalizedLegacyValue = normalizeValue(
    storedValue,
    options?.normalize,
    options?.validate,
  );

  if (!normalizedLegacyValue) {
    removeStoredValue(storage, key);
    return null;
  }

  setExpiringStorageString(key, normalizedLegacyValue, ttlMs, options);
  return normalizedLegacyValue;
}
