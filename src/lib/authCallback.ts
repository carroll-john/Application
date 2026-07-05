export function sanitizeRedirectPath(redirectPath: string | null | undefined) {
  if (
    !redirectPath ||
    !redirectPath.startsWith("/") ||
    redirectPath.startsWith("//")
  ) {
    return "/";
  }

  return redirectPath;
}

const AUTH_ROUTE_PATHS = new Set(["/sign-in", "/auth/callback"]);

export function resolveAuthRedirectPath(options: {
  pathname: string;
  search?: string;
  redirectFromQuery?: string | null;
}) {
  const redirectFromQuery =
    options.redirectFromQuery ??
    (options.search
      ? new URLSearchParams(options.search).get("redirect")
      : null);

  if (redirectFromQuery) {
    return sanitizeRedirectPath(redirectFromQuery);
  }

  if (AUTH_ROUTE_PATHS.has(options.pathname)) {
    return "/";
  }

  return sanitizeRedirectPath(`${options.pathname}${options.search ?? ""}`);
}

export function buildAuthCallbackUrl(origin: string, redirectPath: string) {
  const sanitized = sanitizeRedirectPath(redirectPath);
  const base = origin.replace(/\/$/, "");

  return `${base}/auth/callback?redirect=${encodeURIComponent(sanitized)}`;
}

export function hasPasswordRecoveryTokenInUrl(
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  if (!href) {
    return false;
  }

  try {
    const url = new URL(href);

    if (
      url.searchParams.get("token_hash") &&
      url.searchParams.get("type") === "recovery"
    ) {
      return true;
    }

    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

    if (hashParams.get("type") === "recovery") {
      return true;
    }

    return url.searchParams.get("type") === "recovery";
  } catch {
    return false;
  }
}

/** Landing marker from resetPasswordForEmail redirectTo — not recovery on its own. */
export function isPasswordRecoveryLanding(
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  if (!href) {
    return false;
  }

  try {
    return new URL(href).searchParams.get("recovery") === "1";
  } catch {
    return false;
  }
}

export function shouldTreatSessionAsPasswordRecovery(
  session: { user: unknown } | null,
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  if (hasPasswordRecoveryTokenInUrl(href)) {
    return true;
  }

  return Boolean(session) && isPasswordRecoveryLanding(href);
}

/** @deprecated Use hasPasswordRecoveryTokenInUrl for auth-state decisions. */
export function isPasswordRecoveryCallback(
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  return hasPasswordRecoveryTokenInUrl(href);
}

export function withoutPasswordRecoveryQuery(href: string) {
  const url = new URL(href);

  if (url.searchParams.get("recovery") !== "1") {
    return href;
  }

  url.searchParams.delete("recovery");
  const nextSearch = url.searchParams.toString();

  return `${url.origin}${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
}

export function clearPasswordRecoveryQueryFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = withoutPasswordRecoveryQuery(window.location.href);

  if (nextUrl === window.location.href) {
    return;
  }

  window.history.replaceState(window.history.state, "", nextUrl);
}

export function buildPasswordResetRedirectUrl(
  origin: string,
  redirectPath?: string | null,
) {
  const base = origin.replace(/\/$/, "");
  const sanitized = sanitizeRedirectPath(redirectPath);
  const params = new URLSearchParams({
    recovery: "1",
    redirect: sanitized,
  });

  return `${base}/sign-in?${params.toString()}`;
}

/** resetPasswordForEmail redirectTo — lands on /auth/callback for token_hash verifyOtp. */
export function buildPasswordRecoveryCallbackUrl(
  origin: string,
  redirectPath?: string | null,
) {
  return buildAuthCallbackUrl(origin, sanitizeRedirectPath(redirectPath));
}

/** When a reset email lands on the wrong route, send it through /auth/callback. */
export function buildRecoveryCallbackRedirectFromUrl(
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  const token = parseRecoveryTokenHashFromUrl(href);

  if (!token) {
    return null;
  }

  try {
    const url = new URL(href);
    const pathname = url.pathname.replace(/\/$/, "");

    if (pathname.endsWith("/auth/callback") || pathname.endsWith("/sign-in")) {
      return null;
    }

    const params = new URLSearchParams();
    const redirect = url.searchParams.get("redirect");

    if (redirect) {
      params.set("redirect", sanitizeRedirectPath(redirect));
    }

    params.set("token_hash", token.tokenHash);
    params.set("type", "recovery");

    return `/auth/callback?${params.toString()}`;
  } catch {
    return null;
  }
}

type RecoveryOtpClient = {
  auth: {
    verifyOtp: (params: {
      token_hash: string;
      type: "recovery";
    }) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * POST verifyOtp for token_hash recovery links. Call on password-form submit,
 * not on page load — Microsoft Safe Links may execute JS but does not submit forms.
 */
export async function verifyRecoveryTokenHash(
  client: RecoveryOtpClient,
  tokenHash: string,
) {
  return client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
}

export function parseRecoveryTokenHashFromUrl(
  href: string = typeof window !== "undefined" ? window.location.href : "",
) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href);
    const tokenHash = url.searchParams.get("token_hash");

    if (!tokenHash || url.searchParams.get("type") !== "recovery") {
      return null;
    }

    return { tokenHash };
  } catch {
    return null;
  }
}

export function withoutRecoveryTokenHashParams(href: string) {
  const url = new URL(href);

  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");

  const nextSearch = url.searchParams.toString();

  return `${url.origin}${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
}

export type AuthUrlError = {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

const AUTH_ERROR_PARAM_KEYS = [
  "error",
  "error_code",
  "error_description",
  "sb",
] as const;

function readAuthErrorParams(
  params: URLSearchParams,
): AuthUrlError | null {
  const error = params.get("error");
  const errorCode = params.get("error_code");
  const errorDescription = params.get("error_description");

  if (!error && !errorCode && !errorDescription) {
    return null;
  }

  return { error, errorCode, errorDescription };
}

/** Supabase auth failures arrive in the URL hash or query after a bad/expired link. */
export function parseAuthErrorFromUrl(
  href: string = typeof window !== "undefined" ? window.location.href : "",
): AuthUrlError | null {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const fromHash = readAuthErrorParams(hashParams);

    if (fromHash) {
      return fromHash;
    }

    return readAuthErrorParams(url.searchParams);
  } catch {
    return null;
  }
}

export function formatAuthUrlErrorMessage(authError: AuthUrlError): string {
  const code = authError.errorCode?.toLowerCase();

  switch (code) {
    case "otp_expired":
      return "This reset link has expired or was already used. Corporate email security (for example Microsoft Safe Links) can consume reset links before you open them — request a new one and click it promptly, or try a personal email address.";
    case "otp_disabled":
      return "This sign-in link is no longer valid. Request a new one.";
    default: {
      const description = authError.errorDescription
        ?.replace(/\+/g, " ")
        .trim();

      if (description) {
        return description;
      }

      return "This link is invalid or has expired. Request a new one.";
    }
  }
}

export function withoutAuthErrorParams(href: string) {
  const url = new URL(href);

  for (const key of AUTH_ERROR_PARAM_KEYS) {
    url.searchParams.delete(key);
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  for (const key of AUTH_ERROR_PARAM_KEYS) {
    hashParams.delete(key);
  }

  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";

  if (url.searchParams.get("recovery") === "1") {
    url.searchParams.delete("recovery");
  }

  const nextSearch = url.searchParams.toString();

  return `${url.origin}${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
}

export function clearAuthErrorFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = withoutAuthErrorParams(window.location.href);

  if (nextUrl === window.location.href) {
    return;
  }

  window.history.replaceState(window.history.state, "", nextUrl);
}
