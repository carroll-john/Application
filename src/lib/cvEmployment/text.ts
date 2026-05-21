export function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeRequiredWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
