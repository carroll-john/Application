import { describe, expect, it } from "vitest";
import {
  LOCAL_DEV_SUPABASE_ANON_KEY,
  LOCAL_DEV_SUPABASE_URL,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "./supabaseConfig";
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

describe("resolveSupabaseUrl", () => {
  it("prefers configured values", () => {
    expect(
      resolveSupabaseUrl("https://example.supabase.co", false),
    ).toBe("https://example.supabase.co");
  });

  it("falls back to the local stack URL in development", () => {
    expect(resolveSupabaseUrl(undefined, true)).toBe(LOCAL_DEV_SUPABASE_URL);
  });

  it("does not fall back outside development", () => {
    expect(resolveSupabaseUrl(undefined, false)).toBeUndefined();
  });
});

describe("resolveSupabaseAnonKey", () => {
  it("prefers configured values", () => {
    expect(resolveSupabaseAnonKey("publishable-key", false)).toBe(
      "publishable-key",
    );
  });

  it("falls back to the local stack anon key in development", () => {
    expect(resolveSupabaseAnonKey(undefined, true)).toBe(
      LOCAL_DEV_SUPABASE_ANON_KEY,
    );
  });

  it("does not fall back outside development", () => {
    expect(resolveSupabaseAnonKey(undefined, false)).toBeUndefined();
  });
});
