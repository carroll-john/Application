import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const DEV_AUTH_BYPASS_STORAGE_KEY =
  "application-prototype:dev-auth-bypass";

export const allowedEmailDomains = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? ""
)
  .split(",")
  .map((domain: string) => domain.trim().toLowerCase())
  .filter(Boolean);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && allowedEmailDomains.length > 0,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const canUseLocalDevAuthBypass =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  ["127.0.0.1", "localhost"].includes(window.location.hostname);

export function isAllowedCompanyEmail(email: string) {
  const [, domain = ""] = email.trim().toLowerCase().split("@");
  return allowedEmailDomains.includes(domain);
}
