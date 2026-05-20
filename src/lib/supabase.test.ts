import { describe, expect, it } from "vitest";
import { hasSupabaseConfig } from "./supabase";

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
