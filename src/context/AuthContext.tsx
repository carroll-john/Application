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
  clearLocalApplicantProfile,
  ensureApplicantProfile,
} from "../lib/applicantProfileStore";
import { clearLocalApplications } from "../lib/applicationRecords";
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

function normalizeCompanyEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function loadAuthorizedCompanyEmail() {
  if (typeof window === "undefined") {
    return null;
  }

  const email = normalizeCompanyEmail(
    window.localStorage.getItem(COMPANY_ACCESS_EMAIL_STORAGE_KEY),
  );

  return email && isAllowedCompanyEmail(email) ? email : null;
}

function saveAuthorizedCompanyEmail(email: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COMPANY_ACCESS_EMAIL_STORAGE_KEY, email);
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
  const [hasDevBypassEnabled, setHasDevBypassEnabled] = useState(() => {
    if (!canUseLocalDevAuthBypass) {
      return false;
    }

    return (
      window.localStorage.getItem(DEV_AUTH_BYPASS_STORAGE_KEY) === "enabled"
    );
  });
  const isCompanyGateConfigured = allowedEmailDomains.length > 0;

  const isBypassedInDev =
    (import.meta.env.DEV && !isCompanyGateConfigured) || hasDevBypassEnabled;

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

        if (previousEmail && previousEmail !== normalizedEmail) {
          clearLocalApplications();
          clearLocalApplicantProfile();
          await clearStoredDocuments().catch(() => {
            // Ignore IndexedDB cleanup issues during gate changes.
          });
        }

        saveAuthorizedCompanyEmail(normalizedEmail);
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

        window.localStorage.setItem(DEV_AUTH_BYPASS_STORAGE_KEY, "enabled");
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
