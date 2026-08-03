import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260804090000_uc_assessment_pilot.sql",
  ),
  "utf8",
).toLowerCase();
const hardening = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260804100000_uc_assessment_authority_hardening.sql",
  ),
  "utf8",
).toLowerCase();

const TABLES = [
  "pilot_participants",
  "assessment_sessions",
  "assessment_results",
  "assessment_documents",
  "staff_roles",
  "assessment_reviews",
  "assessment_audit_events",
] as const;

describe("UC assessment migration contract", () => {
  it("creates every partner-scoped pilot table with RLS enabled", () => {
    for (const table of TABLES) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });

  it("requires AAL2 for staff policies and revokes anonymous access", () => {
    expect(migration).toContain("auth.jwt() ->> 'aal'");
    expect(migration).toContain("= 'aal2'");
    expect(migration).toContain("is_active_assessment_staff");
    for (const table of TABLES) {
      expect(migration).toContain(`revoke all on public.${table} from anon`);
    }
  });

  it("makes assessment and staff mutations API-only", () => {
    expect(hardening).toContain("applicants read their assessment sessions");
    expect(hardening).toContain("aal2 staff read partner reviews");
    expect(hardening).toContain(
      "revoke insert, update, delete on public.assessment_sessions from authenticated",
    );
    expect(hardening).toContain(
      "revoke insert, update, delete on public.assessment_reviews from authenticated",
    );
    expect(hardening).toContain("protect_application_assessment_context");
  });

  it("creates a private quarantine bucket and shared database rate limiter", () => {
    expect(migration).toContain("'assessment-quarantine'");
    expect(migration).toContain("consume_assessment_rate_limit");
    expect(migration).toContain(
      "revoke all on function public.consume_assessment_rate_limit",
    );
  });
});
