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
import { ensureApplicantProfile } from "../lib/applicantProfileStore";
import { ensureBusinessUserRecord } from "../lib/businessUsers";
import { identifyPostHogUser, resetPostHogUser } from "../lib/posthog";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isBypassedInDev: boolean;
  canUseDevBypass: boolean;
  isAuthorizedCompanyUser: boolean;
  companyUserDisplayName: string;
  companyDomains: string[];
  sendMagicLink: (
    email: string,
    redirectPath?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAllowedEmail: (email: string) => boolean;
  enableDevBypass: () => void;
  disableDevBypass: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAllowedSessionUser(nextSession: Session | null) {
  const email = nextSession?.user.email?.trim().toLowerCase();
  return Boolean(email && isAllowedCompanyEmail(email));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [hasDevBypassEnabled, setHasDevBypassEnabled] = useState(() => {
    if (!canUseLocalDevAuthBypass) {
      return false;
    }

    return (
      window.localStorage.getItem(DEV_AUTH_BYPASS_STORAGE_KEY) === "enabled"
    );
  });

  const isBypassedInDev =
    (import.meta.env.DEV && !isSupabaseConfigured) || hasDevBypassEnabled;

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    void client.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      if (data.session && !isAllowedSessionUser(data.session)) {
        void client.auth.signOut();
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession && !isAllowedSessionUser(nextSession)) {
        void client.auth.signOut();
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !isAllowedSessionUser(session)) {
      return;
    }

    void Promise.all([
      ensureBusinessUserRecord(session),
      ensureApplicantProfile(session),
    ]).catch(() => {
      // Do not block the sign-in flow if profile provisioning fails.
    });
  }, [session]);

  useEffect(() => {
    if (user?.id) {
      identifyPostHogUser(user.id, {
        email: user.email?.trim().toLowerCase() ?? undefined,
        is_dev_bypass: isBypassedInDev,
      });
      return;
    }

    resetPostHogUser();
  }, [isBypassedInDev, user?.email, user?.id]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      isBypassedInDev,
      canUseDevBypass: canUseLocalDevAuthBypass,
      isAuthorizedCompanyUser: isAllowedSessionUser(session),
      companyUserDisplayName:
        user?.user_metadata?.full_name?.trim() ||
        user?.user_metadata?.name?.trim() ||
        user?.email?.split("@")[0] ||
        "Team member",
      companyDomains: allowedEmailDomains,
      sendMagicLink: async (email, redirectPath = "/") => {
        if (!supabase) {
          return { error: "Supabase auth is not configured." };
        }

        if (!isAllowedCompanyEmail(email)) {
          return {
            error: `Use your company email address (${allowedEmailDomains.join(", ")}).`,
          };
        }

        const redirectUrl = new URL("/auth/callback", window.location.origin);
        redirectUrl.searchParams.set("redirect", redirectPath);

        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: redirectUrl.toString(),
          },
        });

        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (canUseLocalDevAuthBypass) {
          window.localStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY);
          setHasDevBypassEnabled(false);
        }

        if (!supabase) {
          return;
        }

        await supabase.auth.signOut();
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
    [hasDevBypassEnabled, isBypassedInDev, isLoading, session, user],
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
