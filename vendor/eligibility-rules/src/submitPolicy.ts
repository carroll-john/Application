/**
 * Single source of truth for submit-time English/AHPRA policy shared by the app,
 * Supabase RPC SQL (kept in sync via contract test), and the rules engine.
 */

/** ISO alpha-2 codes accepted as English-medium study countries by default. */
export const DEFAULT_ENGLISH_MEDIUM_COUNTRY_CODES = [
  "AU",
  "NZ",
  "UK",
  "IE",
  "US",
  "CA",
  "ZA",
] as const;

/**
 * Lowercase country spellings checked by the submit RPC against tertiary qualification
 * country fields. Derived from {@link DEFAULT_ENGLISH_MEDIUM_COUNTRY_CODES} aliases.
 */
export const SQL_ENGLISH_MEDIUM_COUNTRY_ALIASES = [
  "au",
  "aus",
  "australia",
  "nz",
  "new zealand",
  "uk",
  "gb",
  "gbr",
  "britain",
  "united kingdom",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "ie",
  "ireland",
  "republic of ireland",
  "us",
  "usa",
  "united states",
  "united states of america",
  "america",
  "ca",
  "canada",
  "za",
  "south africa",
] as const;

/**
 * AHPRA and registered health-practitioner titles accepted as English-proficiency evidence.
 * Keep in sync with `application_submission_missing_fields` in Supabase migrations.
 */
export const AHPRA_REGISTRATION_PATTERN =
  /\bahpra\b|australian health practitioner|nursing and midwifery board|medical board of australia|dental board of australia|registered\s+(nurse|midwife|midwifery|medical practitioner|pharmacist|physiotherapist|psychologist|dentist|optometrist|paramedic|occupational therapist|chiropractor|osteopath|podiatrist|radiographer)/i;

/** Postgres regex equivalent used in submit RPC (word-boundary \\y for ahpra). */
export const SQL_AHPRA_REGISTRATION_PATTERN =
  String.raw`\yahpra\y|australian health practitioner|nursing and midwifery board|medical board of australia|dental board of australia|registered\s+(nurse|midwife|midwifery|medical practitioner|pharmacist|physiotherapist|psychologist|dentist|optometrist|paramedic|occupational therapist|chiropractor|osteopath|podiatrist|radiographer)`;

/** Transcript wording indicating qualification completion / conferral. */
export const TRANSCRIPT_COMPLETION_PATTERN =
  /complet|graduat|conferred|award(ed)?|finished|passed|degree (awarded|granted)/i;

export function isAhpraRegistration(name: string | undefined): boolean {
  return Boolean(name && AHPRA_REGISTRATION_PATTERN.test(name));
}
