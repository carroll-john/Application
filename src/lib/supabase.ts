import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "./supabaseConfig";
import { createFetchWithRetry } from "./supabaseFetch";

const supabaseUrl = resolveSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.DEV,
);
const supabaseAnonKey = resolveSupabaseAnonKey(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.DEV,
);

export function hasSupabaseConfig(
  url: string | null | undefined,
  anonKey: string | null | undefined,
) {
  return Boolean(url?.trim() && anonKey?.trim());
}

export const isSupabaseConfigured = hasSupabaseConfig(
  supabaseUrl,
  supabaseAnonKey,
);

export const configuredSupabaseUrl = supabaseUrl ?? null;

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Defer URL session detection until AuthContext subscribes to
        // onAuthStateChange so PASSWORD_RECOVERY is not missed on reset links.
        skipAutoInitialize: true,
      },
      // DIS-142: retry transient network failures (e.g. "Failed to fetch")
      // with exponential back-off before the error surfaces to the UI. Only
      // idempotent requests (reads, deletes) are retried — never POST/PATCH —
      // so a lost response can't duplicate a non-idempotent insert.
      global: {
        fetch: createFetchWithRetry(),
      },
    })
  : null;
