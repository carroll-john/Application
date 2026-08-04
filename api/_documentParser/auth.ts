import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase.types";
import { resolveLlmRuntimeConfig } from "../_ai/runtimeConfig.js";

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

function getSupabaseProjectConfig() {
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
}

export function isDeployedEnvironment() {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  return vercelEnv === "production" || vercelEnv === "preview";
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

if (resolveLlmRuntimeConfig() && !getSupabaseProjectConfig()) {
  console.warn(
    isDeployedEnvironment()
      ? "[parse-cv] An LLM credential is set but SUPABASE_URL/SUPABASE_ANON_KEY are missing on a deployed environment — the route will reject all requests with CV_PARSER_NOT_CONFIGURED until Supabase auth is configured."
      : "[parse-cv] An LLM credential is set but SUPABASE_URL/SUPABASE_ANON_KEY are missing — running in unauthenticated open mode (local/dev only).",
  );
}

export async function authenticateRequest(request: Request): Promise<
  | { kind: "unauthenticated" }
  | { kind: "open" }
  | { kind: "authenticated"; userId: string }
> {
  const supabaseConfig = getSupabaseProjectConfig();

  if (!supabaseConfig) {
    return { kind: "open" };
  }

  const accessToken = getBearerToken(request.headers);

  if (!accessToken) {
    return { kind: "unauthenticated" };
  }

  const supabase = createClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { kind: "unauthenticated" };
  }

  return { kind: "authenticated", userId: data.user.id };
}
