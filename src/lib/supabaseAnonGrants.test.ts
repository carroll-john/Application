import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(testDir, "../../supabase/migrations");

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

const applicantTables = [
  "applicant_profiles",
  "application_documents",
  "applications",
  "business_users",
  "employment_experiences",
  "language_tests",
  "professional_accreditations",
  "secondary_qualifications",
  "tertiary_qualifications",
] as const;

describe("supabase anon table grants (DIS-117)", () => {
  const migration = readMigration(
    "20260611130358_revoke_anon_select_applicant_tables.sql",
  );

  it.each(applicantTables)("revokes anon select on public.%s", (table) => {
    expect(migration).toMatch(
      new RegExp(`revoke select on table public\\.${table} from anon`, "i"),
    );
  });
});
