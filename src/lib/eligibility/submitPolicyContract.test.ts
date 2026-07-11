import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AHPRA_REGISTRATION_PATTERN,
  SQL_AHPRA_REGISTRATION_PATTERN,
  SQL_ENGLISH_MEDIUM_COUNTRY_ALIASES,
} from "./submitPolicy";

describe("submitPolicy SQL contract", () => {
  it("keeps English-medium country aliases aligned with the submit RPC migration", () => {
    const migrationPath = new URL(
      "../../../supabase/migrations/20260707120000_section2_submission_policy.sql",
      import.meta.url,
    );
    const sql = readFileSync(fileURLToPath(migrationPath), "utf8");
    const match = sql.match(
      /english_medium_countries text\[\] := array\[([\s\S]*?)\];/,
    );
    expect(match).not.toBeNull();
    const sqlCountries = [...match![1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
    expect(sqlCountries).toEqual([...SQL_ENGLISH_MEDIUM_COUNTRY_ALIASES]);
  });

  it("keeps AHPRA pattern aligned with the submit RPC migration", () => {
    const migrationPath = new URL(
      "../../../supabase/migrations/20260707120000_section2_submission_policy.sql",
      import.meta.url,
    );
    const sql = readFileSync(fileURLToPath(migrationPath), "utf8");
    expect(sql).toContain(SQL_AHPRA_REGISTRATION_PATTERN);
    expect(AHPRA_REGISTRATION_PATTERN.test("AHPRA registration")).toBe(true);
    expect(AHPRA_REGISTRATION_PATTERN.test("Registered Nurse")).toBe(true);
  });
});
