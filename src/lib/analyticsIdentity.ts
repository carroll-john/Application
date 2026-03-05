const ANALYTICS_HASH_SALT =
  import.meta.env.VITE_ANALYTICS_HASH_SALT?.trim() || "application-prototype";

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digestSha256(input: string) {
  if (
    typeof crypto === "undefined" ||
    !crypto.subtle ||
    typeof TextEncoder === "undefined"
  ) {
    return null;
  }

  try {
    const buffer = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return toHex(new Uint8Array(digest));
  } catch {
    return null;
  }
}

function fallbackHash(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeIdentifier(rawIdentifier: string) {
  const normalizedIdentifier = rawIdentifier.trim().toLowerCase();

  if (!normalizedIdentifier) {
    return null;
  }

  return `${ANALYTICS_HASH_SALT}:${normalizedIdentifier}`;
}

export function hashAnalyticsIdentifierSync(rawIdentifier: string) {
  const hashInput = normalizeIdentifier(rawIdentifier);
  if (!hashInput) {
    return "anonymous";
  }

  return `fnv1a:${fallbackHash(hashInput)}`;
}

export async function hashAnalyticsIdentifier(rawIdentifier: string) {
  const hashInput = normalizeIdentifier(rawIdentifier);
  if (!hashInput) {
    return "anonymous";
  }

  const sha256Hash = await digestSha256(hashInput);

  if (sha256Hash) {
    return `sha256:${sha256Hash}`;
  }

  return hashAnalyticsIdentifierSync(rawIdentifier);
}
