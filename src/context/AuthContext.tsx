import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  buildAuthCallbackUrl,
  buildPasswordRecoveryCallbackUrl,
  clearPasswordRecoveryQueryFromUrl,
  hasPasswordRecoveryTokenInUrl,
  parseRecoveryTokenHashFromUrl,
  shouldTreatSessionAsPasswordRecovery,
  verifyRecoveryTokenHash,
  withoutRecoveryTokenHashParams,
} from "../lib/authCallback";
import {
  changePassword as changePasswordRequest,
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
import { isPasswordLeaked } from "../lib/leakedPassword";
import { getEmailDomain } from "../lib/emailDomain";
import { syncPostHogUser } from "../lib/posthog";
import { syncSentryUser } from "../lib/sentry";
import {
  getMfaSessionStatus,
  verifyTotpChallenge,
} from "../lib/authMfa";

type SessionAssessmentOutcome =
  | "authenticated"
  | "mfa_required"
  | "signed_out"
  | "error"
  | "stale";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  requiresMfa: boolean;
  mfaError: string | null;
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
  requestPasswordReset: (email: string, options?: { redirectPath?: string }) => Promise<{ error: string | null }>;
  updatePasswordAfterRecovery: (
    password: string,
  ) => Promise<{ error: string | null }>;
  changePassword: (
    currentPassword: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    hasPasswordRecoveryTokenInUrl(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(supabase));
  const approvedSessionRef = useRef<Session | null>(null);
  const assessmentGenerationRef = useRef(0);
  const isActiveRef = useRef(true);

  const assessSession = useCallback(
    async (nextSession: Session | null): Promise<SessionAssessmentOutcome> => {
      const generation = ++assessmentGenerationRef.current;

      if (!nextSession) {
        approvedSessionRef.current = null;
        if (isActiveRef.current) {
          setSession(null);
          setRequiresMfa(false);
          setMfaError(null);
          setIsLoading(false);
        }
        return "signed_out";
      }

      if (!supabase) {
        return "error";
      }

      if (isActiveRef.current) {
        if (approvedSessionRef.current?.user.id !== nextSession.user.id) {
          approvedSessionRef.current = null;
          setSession(null);
        }
      }

      const { status, error } = await getMfaSessionStatus(supabase.auth.mfa);

      if (
        !isActiveRef.current ||
        generation !== assessmentGenerationRef.current
      ) {
        return "stale";
      }

      if (error || !status) {
        approvedSessionRef.current = null;
        setSession(null);
        setRequiresMfa(true);
        setMfaError(
          error ??
            "Two-factor authentication is unavailable right now. Try again.",
        );
        setIsLoading(false);
        return "error";
      }

      if (status.requiresChallenge) {
        approvedSessionRef.current = null;
        setSession(null);
        setRequiresMfa(true);
        setMfaError(null);
        setIsLoading(false);
        return "mfa_required";
      }

      approvedSessionRef.current = nextSession;
      setSession(nextSession);
      setRequiresMfa(false);
      setMfaError(null);
      setIsLoading(false);
      return "authenticated";
    },
    [],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    isActiveRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isActiveRef.current) {
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      } else if (shouldTreatSessionAsPasswordRecovery(nextSession)) {
        setIsPasswordRecovery(true);
      }

      void assessSession(nextSession);
    });

    void (async () => {
      try {
        await supabase.auth.initialize();
        if (!isActiveRef.current) {
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!isActiveRef.current) {
          return;
        }

        if (shouldTreatSessionAsPasswordRecovery(data.session)) {
          setIsPasswordRecovery(true);
        }

        await assessSession(data.session);
      } catch {
        if (isActiveRef.current) {
          approvedSessionRef.current = null;
          setSession(null);
          setRequiresMfa(false);
          setMfaError(null);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActiveRef.current = false;
      assessmentGenerationRef.current += 1;
      subscription.unsubscribe();
    };
  }, [assessSession]);

  const userEmail = normalizeAuthEmail(session?.user?.email ?? "") || null;
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    if (isLoading) {
      return;
    }

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
  }, [isAuthenticated, isLoading, session?.user.id, userEmail]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      isAuthenticated,
      requiresMfa,
      mfaError,
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
          checkLeakedPassword: isPasswordLeaked,
        });
      },
      requestPasswordReset: async (email, options) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const redirectTo =
          typeof window !== "undefined"
            ? buildPasswordRecoveryCallbackUrl(
                window.location.origin,
                options?.redirectPath,
              )
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

        const pendingToken =
          typeof window !== "undefined"
            ? parseRecoveryTokenHashFromUrl()
            : null;

        if (pendingToken) {
          const { error: verifyError } = await verifyRecoveryTokenHash(
            supabase,
            pendingToken.tokenHash,
          );

          if (verifyError) {
            return {
              error:
                verifyError.message ||
                "This reset link has expired or was already used.",
            };
          }

          if (typeof window !== "undefined") {
            const nextUrl = withoutRecoveryTokenHashParams(
              window.location.href,
            );

            if (nextUrl !== window.location.href) {
              window.history.replaceState(window.history.state, "", nextUrl);
            }
          }
        }

        const { error } = await updatePasswordAfterRecoveryRequest(
          supabase.auth,
          password,
          {
            supabaseUrl: configuredSupabaseUrl,
            checkLeakedPassword: isPasswordLeaked,
          },
        );

        if (!error) {
          setIsPasswordRecovery(false);
          clearPasswordRecoveryQueryFromUrl();
        }

        return { error };
      },
      changePassword: async (currentPassword, password) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        return changePasswordRequest(supabase.auth, currentPassword, password, {
          supabaseUrl: configuredSupabaseUrl,
          checkLeakedPassword: isPasswordLeaked,
        });
      },
      verifyMfa: async (code) => {
        if (!supabase) {
          return {
            error: "Authentication is not configured on this deployment.",
          };
        }

        const result = await verifyTotpChallenge(supabase.auth.mfa, code);

        if (result.error) {
          return result;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          return {
            error:
              error?.message ??
              "Two-factor authentication is unavailable right now. Try again.",
          };
        }

        const outcome = await assessSession(data.session);

        return outcome === "authenticated"
          ? { error: null }
          : {
              error:
                "Two-factor authentication could not be confirmed. Try again.",
            };
      },
      signOut: async () => {
        assessmentGenerationRef.current += 1;
        approvedSessionRef.current = null;
        setSession(null);
        setRequiresMfa(false);
        setMfaError(null);
        setIsLoading(false);

        if (supabase) {
          await supabase.auth.signOut();
        }

        syncPostHogUser(null);
        syncSentryUser(null);
      },
    }),
    [
      assessSession,
      isAuthenticated,
      isLoading,
      isPasswordRecovery,
      mfaError,
      requiresMfa,
      session,
      userEmail,
    ],
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
