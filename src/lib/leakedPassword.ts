// DIS-119: client half of the free-tier leaked-password check. See
// `api/check-leaked-password.ts` for the server proxy and the k-anonymity
// rationale. Every failure path here is fail-open (treat the password as not
// leaked) so a flaky network, a missing endpoint in local dev, or an
// unavailable Web Crypto API can never block sign-up or a password change.

const LEAKED_PASSWORD_ENDPOINT = "/api/check-leaked-password";
const REQUEST_TIMEOUT_MS = 5000;

async function sha1HexUpper(input: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }

  try {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-1", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  } catch {
    return null;
  }
}

/**
 * Returns true when `suffix` (the SHA-1 hash minus its 5-character prefix)
 * appears in a Pwned Passwords range response with a breach count greater than
 * zero. Padding entries (added by the upstream `Add-Padding` header) carry a
 * count of 0 and are correctly treated as "not found".
 */
export function hashSuffixIsListed(rangeBody: string, suffix: string): boolean {
  const target = suffix.trim().toUpperCase();

  if (!target) {
    return false;
  }

  for (const line of rangeBody.split("\n")) {
    const separatorIndex = line.indexOf(":");
    const lineSuffix = (
      separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    )
      .trim()
      .toUpperCase();

    if (lineSuffix !== target) {
      continue;
    }

    const count = Number.parseInt(
      separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).trim(),
      10,
    );

    return Number.isNaN(count) ? true : count > 0;
  }

  return false;
}

/**
 * Best-effort check of whether `password` appears in the Pwned Passwords data
 * set. Resolves `false` (not leaked) on any error so the caller never blocks an
 * auth action because the check itself failed.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  if (!password) {
    return false;
  }

  const hash = await sha1HexUpper(password);

  if (!hash) {
    return false;
  }

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let response: Response;

  try {
    response = await fetch(`${LEAKED_PASSWORD_ENDPOINT}?prefix=${prefix}`, {
      method: "GET",
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return false;
  }

  if (!response.ok) {
    return false;
  }

  let body: string;

  try {
    body = await response.text();
  } catch {
    return false;
  }

  return hashSuffixIsListed(body, suffix);
}
