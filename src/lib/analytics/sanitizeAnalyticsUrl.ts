const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "code",
  "type",
  "error",
  "error_description",
  "provider_token",
  "provider_refresh_token",
]);

const AUTH_CALLBACK_PATH = "/auth/callback";
const SIGN_IN_PATH = "/sign-in";

export function sanitizeAnalyticsUrl(href: string) {
  try {
    const url = new URL(href);

    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch {
    const withoutHash = href.split("#")[0] ?? href;
    const queryIndex = withoutHash.indexOf("?");

    return queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  }
}

export function sanitizeAnalyticsSearch(search: string) {
  if (!search) {
    return "";
  }

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }

  const sanitized = params.toString();
  return sanitized ? `?${sanitized}` : "";
}

function hasSensitiveQueryParams(search: string) {
  if (!search) {
    return false;
  }

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  for (const key of params.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function isPostHogSensitiveRoute(pathname: string, search = "") {
  if (pathname === AUTH_CALLBACK_PATH) {
    return true;
  }

  if (pathname === SIGN_IN_PATH && hasSensitiveQueryParams(search)) {
    return true;
  }

  return false;
}
