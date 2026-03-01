import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const LOCAL_APPLICANT_PROFILE_STORAGE_KEY =
  "application-prototype:applicant-profile";

export interface ApplicantProfileSeed {
  email: string;
  firstName: string;
  lastName: string;
}

export interface StoredApplicantProfile extends ApplicantProfileSeed {
  id?: string;
}

function normalizeProfile(
  profile: ApplicantProfileSeed | StoredApplicantProfile,
): StoredApplicantProfile {
  return {
    ...("id" in profile ? { id: profile.id } : {}),
    email: profile.email.trim().toLowerCase(),
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
  };
}

export function loadLocalApplicantProfile(): StoredApplicantProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(
    LOCAL_APPLICANT_PROFILE_STORAGE_KEY,
  );

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredApplicantProfile;

    if (!parsedValue?.email) {
      return null;
    }

    return normalizeProfile(parsedValue);
  } catch {
    return null;
  }
}

export function saveLocalApplicantProfile(
  profile: ApplicantProfileSeed | StoredApplicantProfile,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOCAL_APPLICANT_PROFILE_STORAGE_KEY,
    JSON.stringify(normalizeProfile(profile)),
  );
}

export function clearLocalApplicantProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LOCAL_APPLICANT_PROFILE_STORAGE_KEY);
}

function mapRemoteProfile(
  row: {
    email: string;
    first_name: string | null;
    id: string;
    last_name: string | null;
  },
): StoredApplicantProfile {
  return normalizeProfile({
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
  });
}

export async function loadApplicantProfile(
  session: Session | null,
  applicantProfileId?: string,
): Promise<StoredApplicantProfile | null> {
  if (!supabase || !session) {
    return loadLocalApplicantProfile();
  }

  const baseQuery = supabase
    .from("applicant_profiles")
    .select("id, email, first_name, last_name")
    .eq("owner_user_id", session.user.id);

  const query = applicantProfileId
    ? baseQuery.eq("id", applicantProfileId).maybeSingle()
    : baseQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return loadLocalApplicantProfile();
  }

  const profile = mapRemoteProfile(data);
  saveLocalApplicantProfile(profile);
  return profile;
}

export async function saveApplicantProfile(
  session: Session | null,
  profile: ApplicantProfileSeed,
  applicantProfileId?: string,
): Promise<StoredApplicantProfile> {
  const normalizedProfile = normalizeProfile(profile);

  if (!supabase || !session) {
    saveLocalApplicantProfile({
      ...normalizedProfile,
      id: applicantProfileId,
    });
    return {
      ...normalizedProfile,
      id: applicantProfileId,
    };
  }

  const payload = {
    id: applicantProfileId,
    owner_user_id: session.user.id,
    email: normalizedProfile.email,
    first_name: normalizedProfile.firstName || null,
    last_name: normalizedProfile.lastName || null,
    preferred_name: null,
    phone: null,
  };

  const profileQuery = applicantProfileId
    ? supabase
        .from("applicant_profiles")
        .update(payload)
        .eq("id", applicantProfileId)
        .eq("owner_user_id", session.user.id)
        .select("id, email, first_name, last_name")
        .single()
    : supabase
        .from("applicant_profiles")
        .upsert(payload, { onConflict: "owner_user_id,email" })
        .select("id, email, first_name, last_name")
        .single();

  const { data, error } = await profileQuery;

  if (error) {
    throw error;
  }

  const storedProfile = mapRemoteProfile(data);
  saveLocalApplicantProfile(storedProfile);
  return storedProfile;
}

export async function ensureApplicantProfile(
  session: Session | null,
): Promise<StoredApplicantProfile | null> {
  if (!session) {
    return loadLocalApplicantProfile();
  }

  const existingProfile = await loadApplicantProfile(session);

  if (existingProfile) {
    return existingProfile;
  }

  const metadata = session.user.user_metadata;
  const email = session.user.email?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return saveApplicantProfile(session, {
    email,
    firstName:
      metadata?.given_name?.trim?.() ||
      metadata?.first_name?.trim?.() ||
      "",
    lastName:
      metadata?.family_name?.trim?.() ||
      metadata?.last_name?.trim?.() ||
      "",
  });
}
