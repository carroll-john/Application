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

export function isPasswordRecoveryCallback(
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

    if (url.searchParams.get("type") === "recovery") {
      return true;
    }

    return url.searchParams.get("recovery") === "1";
  } catch {
    return false;
  }
}

export function buildPasswordResetRedirectUrl(origin: string) {
  const base = origin.replace(/\/$/, "");

  return `${base}/sign-in?recovery=1`;
}
