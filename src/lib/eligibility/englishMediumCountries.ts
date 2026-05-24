/**
 * Default set of countries whose tertiary completion is widely accepted as evidence of English-language
 * proficiency by Australian universities. Each course's `english_proficiency` requirement carries its own
 * accepted-country list so individual providers can diverge from this default.
 *
 * Codes are ISO 3166-1 alpha-2.
 */
export const DEFAULT_ENGLISH_MEDIUM_COUNTRIES: readonly string[] = [
  "AU",
  "NZ",
  "UK",
  "IE",
  "US",
  "CA",
  "ZA",
] as const;

/**
 * Common full-name and informal spellings mapped to the canonical alpha-2 code so we can compare
 * the extracted `applicantDetails.countryOfInstitution.normalizedValue` against the accepted list.
 *
 * Lookup is case-insensitive; values must be lowercased.
 */
const COUNTRY_ALIAS_TO_CODE: ReadonlyMap<string, string> = new Map([
  ["au", "AU"],
  ["aus", "AU"],
  ["australia", "AU"],
  ["nz", "NZ"],
  ["new zealand", "NZ"],
  ["uk", "UK"],
  ["gb", "UK"],
  ["gbr", "UK"],
  ["britain", "UK"],
  ["united kingdom", "UK"],
  ["great britain", "UK"],
  ["england", "UK"],
  ["scotland", "UK"],
  ["wales", "UK"],
  ["northern ireland", "UK"],
  ["ie", "IE"],
  ["ireland", "IE"],
  ["republic of ireland", "IE"],
  ["us", "US"],
  ["usa", "US"],
  ["united states", "US"],
  ["united states of america", "US"],
  ["america", "US"],
  ["ca", "CA"],
  ["canada", "CA"],
  ["za", "ZA"],
  ["south africa", "ZA"],
  ["sg", "SG"],
  ["singapore", "SG"],
]);

/**
 * Normalises a free-text country string (e.g. "Australia", "United Kingdom", "USA", "AU") into its
 * canonical ISO 3166-1 alpha-2 code, or returns undefined if no match is found.
 */
export function normalizeCountryCode(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  return COUNTRY_ALIAS_TO_CODE.get(trimmed);
}

/**
 * Returns true when `countryValue` (any spelling) resolves to a country present in `acceptedCountries`.
 * Accepted codes are matched case-insensitively against alpha-2 codes.
 */
export function isCountryInAcceptedList(
  countryValue: string | undefined,
  acceptedCountries: readonly string[],
): boolean {
  const code = normalizeCountryCode(countryValue);
  if (!code) {
    return false;
  }

  const acceptedUpper = acceptedCountries.map((entry) => entry.trim().toUpperCase());
  return acceptedUpper.includes(code.toUpperCase());
}
