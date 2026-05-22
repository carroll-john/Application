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
  buildAuthCallbackUrl,
  buildPasswordResetRedirectUrl,
  isPasswordRecoveryCallback,
} from "../lib/authCallback";
import {
  normalizeAuthEmail,
  requestPasswordReset as requestPasswordResetRequest,
  signInWithPassword as signInWithPasswordRequest,
  signUpWithPassword as signUpWithPasswordRequest,
  updatePasswordAfterRecovery as updatePasswordAfterRecoveryRequest,
  type SignUpWithPasswordResult,
} from "../lib/authPassword";
import {
  configuredSupabaseUrl,
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase";
import { syncPostHogUser } from "../lib/posthog";
import { syncSentryUser } from "../lib/sentry";

export type StorageMode = "local" | "remote";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  storageMode: StorageMode;
  isLoading: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  userEmail: string | null;
  userDisplayName: string;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    options?: { redirectPath?: string },
  ) => Promise<SignUpWithPasswordResult>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePasswordAfterRecovery: (
    password: string,
  ) => Promise<{ error: string | null }>;
  changePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatUserDisplayName(email: string | null) {
  if (!email) {
    return "Applicant";
  }

  const localPart = email.split("@")[0] ?? "";
  const normalizedName = localPart.replace(/[._-]+/g, " ").trim();

  if (!normalizedName) {
    return "Applicant";
  }

  return normalizedName
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEmailDomain(email: string | null) {
  return email?.split("@")[1] ?? undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    isPasswordRecoveryCallback(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(supabase));

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
          if (isPasswordRecoveryCallback()) {
            setIsPasswordRecovery(true);
          }
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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }

      setIsLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const userEmail = normalizeAuthEmail(session?.user?.email ?? "") || null;
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    if (!isAuthenticated || !userEmail) {
      syncPostHogUser(null);
      syncSentryUser(null);
      return;
    }

    const identity = {
      email: userEmail,
      emailDomain: getEmailDomain(userEmail),
      id: session?.user.id ?? userEmail,
      name: formatUserDisplayName(userEmail),
    };

    syncPostHogUser(identity);
    syncSentryUser(identity);
  }, [isAuthenticated, session?.user.id, userEmail]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      storageMode: session ? "remote" : "local",
      isLoading,
      isConfigured: isSupabaseConfigured,
      isAuthenticated,
      isPasswordRecovery,
      userEmail,
      userDisplayName: formatUserDisplayName(userEmail),
      signInWithPassword: async (email, password) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        return signInWithPasswordRequest(supabase.auth, email, password, {
          supabaseUrl: configuredSupabaseUrl,
        });
      },
      signUpWithPassword: async (email, password, options) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const redirectPath = options?.redirectPath ?? "/";
        const emailRedirectTo =
          typeof window !== "undefined"
            ? buildAuthCallbackUrl(window.location.origin, redirectPath)
            : undefined;

        return signUpWithPasswordRequest(supabase.auth, email, password, {
          emailRedirectTo,
          supabaseUrl: configuredSupabaseUrl,
        });
      },
      requestPasswordReset: async (email) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const redirectTo =
          typeof window !== "undefined"
            ? buildPasswordResetRedirectUrl(window.location.origin)
            : undefined;

        return requestPasswordResetRequest(supabase.auth, email, {
          redirectTo,
          supabaseUrl: configuredSupabaseUrl,
        });
      },
      updatePasswordAfterRecovery: async (password) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const { error } = await updatePasswordAfterRecoveryRequest(
          supabase.auth,
          password,
          { supabaseUrl: configuredSupabaseUrl },
        );

        if (!error) {
          setIsPasswordRecovery(false);
        }

        return { error };
      },
      changePassword: async (password) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        return updatePasswordAfterRecoveryRequest(supabase.auth, password, {
          supabaseUrl: configuredSupabaseUrl,
        });
      },
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }

        syncPostHogUser(null);
        syncSentryUser(null);
      },
    }),
    [isAuthenticated, isLoading, isPasswordRecovery, session, userEmail],
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
