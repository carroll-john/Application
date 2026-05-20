export const LOCAL_DEV_SUPABASE_URL = "http://127.0.0.1:54321";

// Default anon key for `supabase start` local stacks.
export const LOCAL_DEV_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function resolveSupabaseUrl(
  configuredUrl: string | undefined,
  isDev: boolean,
) {
  const configured = configuredUrl?.trim();
  if (configured) {
    return configured;
  }

  if (isDev) {
    return LOCAL_DEV_SUPABASE_URL;
  }

  return undefined;
}

export function resolveSupabaseAnonKey(
  configuredAnonKey: string | undefined,
  isDev: boolean,
) {
  const configured = configuredAnonKey?.trim();
  if (configured) {
    return configured;
  }

  if (isDev) {
    return LOCAL_DEV_SUPABASE_ANON_KEY;
  }

  return undefined;
}
