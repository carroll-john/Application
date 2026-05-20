import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  allowedEmailDomains,
  canUseLocalDevAuthBypass,
  DEV_AUTH_BYPASS_STORAGE_KEY,
  isAllowedCompanyEmail,
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase";
import {
  getExpiringStorageString,
  setExpiringStorageString,
} from "../lib/expiringStorage";
import { clearLocalApplicantProfile } from "../lib/applicantProfileStore";
import { clearLocalApplications } from "../lib/applicationRecords";
import { clearStoredDocuments } from "../lib/documentStorage";
import { syncPostHogUser } from "../lib/posthog";
import { syncSentryUser } from "../lib/sentry";

export type StorageMode = "local" | "remote";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  storageMode: StorageMode;
  isLoading: boolean;
  isConfigured: boolean;
  isBypassedInDev: boolean;
  canUseDevBypass: boolean;
  isAuthorizedCompanyUser: boolean;
  companyUserEmail: string | null;
  companyUserDisplayName: string;
  companyDomains: string[];
  sendSignInLink: (
    email: string,
    redirectPath: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAllowedEmail: (email: string) => boolean;
  enableDevBypass: () => void;
  disableDevBypass: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_DATA_OWNER_EMAIL_STORAGE_KEY =
  "application-prototype:local-data-owner-email";
const HOURS_TO_MS = 60 * 60 * 1000;
const LOCAL_DATA_OWNER_EMAIL_TTL_MS = 24 * HOURS_TO_MS;
const DEV_AUTH_BYPASS_TTL_MS = 4 * HOURS_TO_MS;

function normalizeCompanyEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function loadLocalDataOwnerEmail() {
  return getExpiringStorageString(
    LOCAL_DATA_OWNER_EMAIL_STORAGE_KEY,
    LOCAL_DATA_OWNER_EMAIL_TTL_MS,
    {
      normalize: normalizeCompanyEmail,
      validate: (email) => email.length > 0,
    },
  );
}

function saveLocalDataOwnerEmail(email: string) {
  const normalizedEmail = normalizeCompanyEmail(email);

  if (!normalizedEmail) {
    return;
  }

  setExpiringStorageString(
    LOCAL_DATA_OWNER_EMAIL_STORAGE_KEY,
    normalizedEmail,
    LOCAL_DATA_OWNER_EMAIL_TTL_MS,
  );
}

function loadDevBypassEnabled() {
  if (!canUseLocalDevAuthBypass) {
    return false;
  }

  return (
    getExpiringStorageString(DEV_AUTH_BYPASS_STORAGE_KEY, DEV_AUTH_BYPASS_TTL_MS, {
      normalize: (value) => value.trim().toLowerCase(),
      validate: (value) => value === "enabled",
    }) === "enabled"
  );
}

function formatCompanyDisplayName(email: string | null) {
  if (!email) {
    return "Team member";
  }

  const localPart = email.split("@")[0] ?? "";
  const normalizedName = localPart.replace(/[._-]+/g, " ").trim();

  if (!normalizedName) {
    return "Team member";
  }

  return normalizedName
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function clearLocalCachedApplicationData() {
  clearLocalApplications();
  clearLocalApplicantProfile();
  await clearStoredDocuments().catch(() => {
    // Ignore IndexedDB cleanup issues.
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(supabase));
  const [hasDevBypassEnabled, setHasDevBypassEnabled] = useState(
    loadDevBypassEnabled,
  );

  // Track the live Supabase session. The client persists and refreshes the
  // session itself; onAuthStateChange keeps tabs in sync and picks up the
  // session established by the magic-link callback.
  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isActive) {
          setSession(data.session);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const sessionEmail = normalizeCompanyEmail(session?.user?.email) || null;
  const isCompanyEmailAuthorized = sessionEmail
    ? isAllowedCompanyEmail(sessionEmail)
    : false;
  const isBypassedInDev =
    (import.meta.env.DEV && !isSupabaseConfigured) || hasDevBypassEnabled;
  const isAuthorizedCompanyUser = isCompanyEmailAuthorized || isBypassedInDev;
  const companyUserEmail = isCompanyEmailAuthorized ? sessionEmail : null;

  // A signed-in session whose email is outside the allowed company domains is
  // not a valid company user — sign it out so the app does not sit in a
  // logged-in-but-rejected limbo. RLS also rejects this user server-side.
  useEffect(() => {
    if (!supabase || !session || !sessionEmail) {
      return;
    }

    if (!isAllowedCompanyEmail(sessionEmail)) {
      void supabase.auth.signOut();
    }
  }, [session, sessionEmail]);

  // When a different company user signs in on this browser, drop the previous
  // user's locally cached drafts/documents so data does not leak across users.
  useEffect(() => {
    if (!companyUserEmail) {
      return;
    }

    const previousOwner = loadLocalDataOwnerEmail();

    if (previousOwner && previousOwner !== companyUserEmail) {
      void clearLocalCachedApplicationData();
    }

    saveLocalDataOwnerEmail(companyUserEmail);
  }, [companyUserEmail]);

  // Keep analytics user identity in sync with the signed-in company user.
  useEffect(() => {
    if (!companyUserEmail) {
      syncPostHogUser(null);
      syncSentryUser(null);
      return;
    }

    const identity = {
      companyDomain: companyUserEmail.split("@")[1],
      email: companyUserEmail,
      id: companyUserEmail,
      name: formatCompanyDisplayName(companyUserEmail),
    };

    syncPostHogUser(identity);
    syncSentryUser(identity);
  }, [companyUserEmail]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      // Application drafts stay in local storage for now. Activating remote
      // (Supabase) persistence is tracked separately and must wait for the
      // remote-store integration test — restoring auth does not by itself
      // move applicant data off the client.
      storageMode: "local",
      isLoading,
      isConfigured: isSupabaseConfigured,
      isBypassedInDev,
      canUseDevBypass: canUseLocalDevAuthBypass,
      isAuthorizedCompanyUser,
      companyUserEmail,
      companyUserDisplayName: formatCompanyDisplayName(companyUserEmail),
      companyDomains: allowedEmailDomains,
      sendSignInLink: async (email, redirectPath) => {
        const normalizedEmail = normalizeCompanyEmail(email);

        if (!normalizedEmail) {
          return { error: "Enter your work email address." };
        }

        if (!isAllowedCompanyEmail(normalizedEmail)) {
          return {
            error: `Use your company email address (${allowedEmailDomains.join(", ")}).`,
          };
        }

        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { emailRedirectTo, shouldCreateUser: true },
        });

        if (error) {
          return { error: error.message };
        }

        return { error: null };
      },
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }

        if (canUseLocalDevAuthBypass) {
          window.localStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY);
          setHasDevBypassEnabled(false);
        }

        syncPostHogUser(null);
        syncSentryUser(null);
      },
      isAllowedEmail: isAllowedCompanyEmail,
      enableDevBypass: () => {
        if (!canUseLocalDevAuthBypass) {
          return;
        }

        setExpiringStorageString(
          DEV_AUTH_BYPASS_STORAGE_KEY,
          "enabled",
          DEV_AUTH_BYPASS_TTL_MS,
        );
        setHasDevBypassEnabled(true);
      },
      disableDevBypass: () => {
        if (!canUseLocalDevAuthBypass) {
          return;
        }

        window.localStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY);
        setHasDevBypassEnabled(false);
      },
    }),
    [session, isLoading, isBypassedInDev, isAuthorizedCompanyUser, companyUserEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
