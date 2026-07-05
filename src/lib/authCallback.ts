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
