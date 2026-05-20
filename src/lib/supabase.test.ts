import { describe, expect, it } from "vitest";
import { canUseLocalDevAuthBypassForHostname, hasSupabaseConfig } from "./supabase";

describe("hasSupabaseConfig", () => {
  it("requires only the Supabase URL and anon key", () => {
    expect(hasSupabaseConfig("https://example.supabase.co", "anon")).toBe(true);
  });

  it("does not require an allowed email domain setting", () => {
    expect(hasSupabaseConfig("https://example.supabase.co", "anon")).toBe(true);
  });

  it("blocks incomplete Supabase configuration", () => {
    expect(hasSupabaseConfig("", "anon")).toBe(false);
    expect(hasSupabaseConfig("https://example.supabase.co", "")).toBe(false);
  });
});

describe("canUseLocalDevAuthBypassForHostname", () => {
  it("allows bypass on localhost hosts in development", () => {
    expect(canUseLocalDevAuthBypassForHostname(true, "localhost")).toBe(true);
    expect(canUseLocalDevAuthBypassForHostname(true, "127.0.0.1")).toBe(true);
  });

  it("blocks bypass outside development mode", () => {
    expect(canUseLocalDevAuthBypassForHostname(false, "localhost")).toBe(false);
    expect(canUseLocalDevAuthBypassForHostname(false, "127.0.0.1")).toBe(false);
  });

  it("blocks bypass for non-local hosts even in development", () => {
    expect(canUseLocalDevAuthBypassForHostname(true, "application-prototype.vercel.app")).toBe(
      false,
    );
    expect(canUseLocalDevAuthBypassForHostname(true, "preview.example.com")).toBe(
      false,
    );
  });

  it("blocks bypass when hostname is missing", () => {
    expect(canUseLocalDevAuthBypassForHostname(true, undefined)).toBe(false);
    expect(canUseLocalDevAuthBypassForHostname(true, null)).toBe(false);
  });
});
