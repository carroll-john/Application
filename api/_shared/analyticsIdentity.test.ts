import { describe, expect, it } from "vitest";
import { hashAnalyticsIdentifier } from "../../src/lib/analyticsIdentity";
import { hashAnalyticsIdentifierServer } from "./analyticsIdentity";

describe("hashAnalyticsIdentifierServer", () => {
  it("matches the client-side sha256 hash for Supabase user ids", async () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const clientHash = await hashAnalyticsIdentifier(userId);
    const serverHash = hashAnalyticsIdentifierServer(userId);

    expect(serverHash).toBe(clientHash);
    expect(serverHash).toMatch(/^sha256:/);
  });

  it("returns anonymous for blank identifiers", () => {
    expect(hashAnalyticsIdentifierServer("   ")).toBe("anonymous");
  });
});
