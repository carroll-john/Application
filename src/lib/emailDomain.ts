/**
 * Domain part of an email address, used as a low-cardinality, non-PII
 * analytics property (`email_domain`). Callers choose their own fallback.
 */
export function getEmailDomain(
  email: string | null | undefined,
): string | undefined {
  return email?.split("@")[1] || undefined;
}
