import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function ensureBusinessUserRecord(session: Session) {
  if (!supabase || !session.user.email) {
    return;
  }

  const { error } = await supabase.from("business_users").upsert(
    {
      user_id: session.user.id,
      email: session.user.email.trim().toLowerCase(),
      full_name:
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}
