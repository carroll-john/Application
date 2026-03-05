import { describe, expect, it } from "vitest";
import {
  getExpiringStorageString,
  setExpiringStorageString,
} from "./expiringStorage";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map<string, string>(Object.entries(initial));

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

describe("expiringStorage", () => {
  it("returns null when no value is stored", () => {
    const storage = createMemoryStorage();

    expect(
      getExpiringStorageString("missing", 1000, {
        storage,
      }),
    ).toBeNull();
  });

  it("returns values before expiry and clears them after expiry", () => {
    const storage = createMemoryStorage();
    let now = 1_750_000_000_000;

    setExpiringStorageString("key", "value", 1_000, {
      now: () => now,
      storage,
    });

    expect(
      getExpiringStorageString("key", 1_000, {
        now: () => now,
        storage,
      }),
    ).toBe("value");

    now += 1_001;

    expect(
      getExpiringStorageString("key", 1_000, {
        now: () => now,
        storage,
      }),
    ).toBeNull();
    expect(storage.getItem("key")).toBeNull();
  });

  it("migrates legacy plain-string values to expiring payloads", () => {
    const storage = createMemoryStorage({
      "application-prototype:dev-auth-bypass": "enabled",
    });
    const now = 1_750_000_000_000;

    expect(
      getExpiringStorageString("application-prototype:dev-auth-bypass", 60_000, {
        now: () => now,
        normalize: (value) => value.trim().toLowerCase(),
        storage,
        validate: (value) => value === "enabled",
      }),
    ).toBe("enabled");

    const migratedValue = storage.getItem("application-prototype:dev-auth-bypass");
    expect(migratedValue).not.toBe("enabled");
    expect(
      typeof migratedValue === "string" &&
        migratedValue.includes("\"value\":\"enabled\""),
    ).toBe(true);
  });

  it("removes invalid legacy values", () => {
    const storage = createMemoryStorage({
      "application-prototype:dev-auth-bypass": "nope",
    });

    expect(
      getExpiringStorageString("application-prototype:dev-auth-bypass", 60_000, {
        normalize: (value) => value.trim().toLowerCase(),
        storage,
        validate: (value) => value === "enabled",
      }),
    ).toBeNull();
    expect(storage.getItem("application-prototype:dev-auth-bypass")).toBeNull();
  });
});
