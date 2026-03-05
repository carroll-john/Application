import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  allowedEmailDomains,
  canUseLocalDevAuthBypass,
  DEV_AUTH_BYPASS_STORAGE_KEY,
  isAllowedCompanyEmail,
} from "../lib/supabase";
import {
  getExpiringStorageString,
  setExpiringStorageString,
} from "../lib/expiringStorage";
import {
  clearLocalApplicantProfile,
  ensureApplicantProfile,
  loadLocalApplicantProfile,
} from "../lib/applicantProfileStore";
import {
  clearLocalApplications,
  loadLocalApplications,
} from "../lib/applicationRecords";
import { clearStoredDocuments } from "../lib/documentStorage";
import { syncPostHogUser } from "../lib/posthog";
import { syncSentryUser } from "../lib/sentry";

interface AuthContextType {
  user: null;
  session: null;
  isLoading: boolean;
  isConfigured: boolean;
  isBypassedInDev: boolean;
  canUseDevBypass: boolean;
  isAuthorizedCompanyUser: boolean;
  companyUserEmail: string | null;
  companyUserDisplayName: string;
  companyDomains: string[];
  authorizeCompanyEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAllowedEmail: (email: string) => boolean;
  enableDevBypass: () => void;
  disableDevBypass: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const COMPANY_ACCESS_EMAIL_STORAGE_KEY =
  "application-prototype:company-access-email";
const LOCAL_DATA_OWNER_EMAIL_STORAGE_KEY =
  "application-prototype:local-data-owner-email";
const HOURS_TO_MS = 60 * 60 * 1000;
const COMPANY_ACCESS_EMAIL_TTL_MS = 24 * HOURS_TO_MS;
const LOCAL_DATA_OWNER_EMAIL_TTL_MS = 24 * HOURS_TO_MS;
const DEV_AUTH_BYPASS_TTL_MS = 4 * HOURS_TO_MS;
const AUTH_STORAGE_REVALIDATE_INTERVAL_MS = 60 * 1000;

function normalizeCompanyEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function loadAuthorizedCompanyEmail() {
  const email = getExpiringStorageString(
    COMPANY_ACCESS_EMAIL_STORAGE_KEY,
    COMPANY_ACCESS_EMAIL_TTL_MS,
    {
      normalize: normalizeCompanyEmail,
      validate: isAllowedCompanyEmail,
    },
  );

  return email ?? null;
}

function saveAuthorizedCompanyEmail(email: string) {
  const normalizedEmail = normalizeCompanyEmail(email);

  if (!normalizedEmail) {
    clearAuthorizedCompanyEmail();
    return;
  }

  setExpiringStorageString(
    COMPANY_ACCESS_EMAIL_STORAGE_KEY,
    normalizedEmail,
    COMPANY_ACCESS_EMAIL_TTL_MS,
  );
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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_DATA_OWNER_EMAIL_STORAGE_KEY);
    }
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

function clearAuthorizedCompanyEmail() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COMPANY_ACCESS_EMAIL_STORAGE_KEY);
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authorizedEmail, setAuthorizedEmail] = useState<string | null>(() =>
    loadAuthorizedCompanyEmail(),
  );
  const [hasDevBypassEnabled, setHasDevBypassEnabled] = useState(
    loadDevBypassEnabled,
  );
  const isCompanyGateConfigured = allowedEmailDomains.length > 0;

  const isBypassedInDev =
    (import.meta.env.DEV && !isCompanyGateConfigured) || hasDevBypassEnabled;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncAuthStateFromStorage = () => {
      const nextAuthorizedEmail = loadAuthorizedCompanyEmail();
      const nextHasDevBypassEnabled = loadDevBypassEnabled();

      setAuthorizedEmail((currentEmail) =>
        currentEmail === nextAuthorizedEmail ? currentEmail : nextAuthorizedEmail,
      );
      setHasDevBypassEnabled((currentValue) =>
        currentValue === nextHasDevBypassEnabled
          ? currentValue
          : nextHasDevBypassEnabled,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthStateFromStorage();
      }
    };

    syncAuthStateFromStorage();
    const intervalId = window.setInterval(
      syncAuthStateFromStorage,
      AUTH_STORAGE_REVALIDATE_INTERVAL_MS,
    );
    window.addEventListener("storage", syncAuthStateFromStorage);
    window.addEventListener("focus", syncAuthStateFromStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncAuthStateFromStorage);
      window.removeEventListener("focus", syncAuthStateFromStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!authorizedEmail) {
      syncPostHogUser(null);
      syncSentryUser(null);
      return;
    }

    syncPostHogUser({
      companyDomain: authorizedEmail.split("@")[1],
      email: authorizedEmail,
      id: authorizedEmail,
      name: formatCompanyDisplayName(authorizedEmail),
    });
    syncSentryUser({
      companyDomain: authorizedEmail.split("@")[1],
      email: authorizedEmail,
      id: authorizedEmail,
      name: formatCompanyDisplayName(authorizedEmail),
    });
  }, [authorizedEmail]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: null,
      session: null,
      isLoading: false,
      isConfigured: isCompanyGateConfigured,
      isBypassedInDev,
      canUseDevBypass: canUseLocalDevAuthBypass,
      isAuthorizedCompanyUser: Boolean(authorizedEmail) || isBypassedInDev,
      companyUserEmail: authorizedEmail,
      companyUserDisplayName: formatCompanyDisplayName(authorizedEmail),
      companyDomains: allowedEmailDomains,
      authorizeCompanyEmail: async (email) => {
        const normalizedEmail = normalizeCompanyEmail(email);

        if (!normalizedEmail) {
          return { error: "Enter your work email address." };
        }

        if (!isAllowedCompanyEmail(normalizedEmail)) {
          return {
            error: `Use your company email address (${allowedEmailDomains.join(", ")}).`,
          };
        }

        const previousEmail = loadAuthorizedCompanyEmail();
        const previousLocalDataOwnerEmail = loadLocalDataOwnerEmail();
        const previousLocalProfileEmail =
          loadLocalApplicantProfile()?.email ?? null;
        const knownLocalOwnerEmail =
          previousEmail ??
          previousLocalDataOwnerEmail ??
          previousLocalProfileEmail;
        const expectedLocalProfileId = `local-profile:${normalizedEmail}`;
        const hasConflictingLocalDraftOwner = loadLocalApplications().some(
          (application) => {
            const applicantProfileId =
              application.applicationMeta.applicantProfileId
                ?.trim()
                .toLowerCase() ?? "";

            if (!applicantProfileId.startsWith("local-profile:")) {
              return false;
            }

            return applicantProfileId !== expectedLocalProfileId;
          },
        );
        const isSwitchingUser =
          (Boolean(knownLocalOwnerEmail) &&
            knownLocalOwnerEmail !== normalizedEmail) ||
          hasConflictingLocalDraftOwner;

        if (isSwitchingUser) {
          clearLocalApplications();
          clearLocalApplicantProfile();
          await clearStoredDocuments().catch(() => {
            // Ignore IndexedDB cleanup issues during gate changes.
          });
        }

        saveAuthorizedCompanyEmail(normalizedEmail);
        saveLocalDataOwnerEmail(normalizedEmail);
        await ensureApplicantProfile(null, normalizedEmail);
        setAuthorizedEmail(normalizedEmail);
        syncPostHogUser({
          companyDomain: normalizedEmail.split("@")[1],
          email: normalizedEmail,
          id: normalizedEmail,
          name: formatCompanyDisplayName(normalizedEmail),
        });
        syncSentryUser({
          companyDomain: normalizedEmail.split("@")[1],
          email: normalizedEmail,
          id: normalizedEmail,
          name: formatCompanyDisplayName(normalizedEmail),
        });

        return { error: null };
      },
      signOut: async () => {
        if (authorizedEmail) {
          saveLocalDataOwnerEmail(authorizedEmail);
        }
        clearAuthorizedCompanyEmail();
        setAuthorizedEmail(null);
        syncPostHogUser(null);
        syncSentryUser(null);

        if (canUseLocalDevAuthBypass) {
          window.localStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY);
          setHasDevBypassEnabled(false);
        }
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
    [authorizedEmail, isBypassedInDev, isCompanyGateConfigured],
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
