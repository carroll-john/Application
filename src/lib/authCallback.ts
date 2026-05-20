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
