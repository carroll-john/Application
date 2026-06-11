import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(testDir, "../../supabase/migrations");

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

describe("supabase graphql exposure (DIS-128)", () => {
  const migration = readMigration(
    "20260611131148_disable_pg_graphql_authenticated_exposure.sql",
  );

  it("drops pg_graphql so authenticated users cannot introspect applicant tables", () => {
    expect(migration).toMatch(/drop extension if exists pg_graphql/i);
  });
});
