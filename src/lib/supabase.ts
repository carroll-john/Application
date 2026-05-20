import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
