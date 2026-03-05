import { describe, expect, it } from "vitest";
import {
  hashAnalyticsIdentifier,
  hashAnalyticsIdentifierSync,
} from "./analyticsIdentity";

describe("hashAnalyticsIdentifier", () => {
  it("returns a stable hash for the same identifier", async () => {
    const firstHash = await hashAnalyticsIdentifier("User@Example.com");
    const secondHash = await hashAnalyticsIdentifier(" user@example.com ");

    expect(firstHash).toBe(secondHash);
  });

  it("does not return the raw identifier", async () => {
    const hash = await hashAnalyticsIdentifier("user@example.com");

    expect(hash).not.toContain("user@example.com");
  });

  it("supports deterministic synchronous hashing", () => {
    const firstHash = hashAnalyticsIdentifierSync("local-profile:user@example.com");
    const secondHash = hashAnalyticsIdentifierSync("local-profile:user@example.com");

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^fnv1a:/);
  });
});
