// Reserve capacity for both possible paid attempts before invoking the model.
// No refunds: failures and timeouts can still incur provider charges.
export async function reserveWorkExperienceQuota(userId: string, signal: AbortSignal): Promise<"allowed" | "limited" | "unavailable"> {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return "unavailable";
  try {
    const response = await fetch(new URL("/rest/v1/rpc/reserve_work_experience_quota", url), {
      method: "POST", signal,
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_user_id: userId }),
    });
    signal.throwIfAborted();
    if (!response.ok) return "unavailable";
    const result: unknown = await response.json();
    signal.throwIfAborted();
    return result === true ? "allowed" : result === false ? "limited" : "unavailable";
  } catch {
    return "unavailable";
  }
}
