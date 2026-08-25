import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "./courseCatalog";
import {
  courseRequiresEnglishProficiency,
  getEnglishProficiencyRequirements,
} from "./eligibility/englishProficiencyEvidence";
import { buildSection2SubmissionPolicy } from "./section2Requirements";

const migrationPath = new URL(
  "../../supabase/migrations/20260825090000_server_authoritative_submission.sql",
  import.meta.url,
);

function readMigration() {
  return readFileSync(fileURLToPath(migrationPath), "utf8");
}

function buildExpectedPolicySnapshot() {
  return (["default", "uc"] as const).flatMap((catalogId) =>
    getCourseCatalogFor(catalogId).map((course) => ({
      catalog_id: catalogId,
      course_code: course.code,
      course_title: course.title,
      english_proficiency_policy: getEnglishProficiencyRequirements(course).map(
        (requirement) => ({
          params: {
            acceptedPathways: requirement.params.acceptedPathways,
          },
        }),
      ),
      requires_english_proficiency: courseRequiresEnglishProficiency(course),
      section2_submission_policy: buildSection2SubmissionPolicy(course),
    })),
  );
}

describe("server-authoritative submission policy contract", () => {
  it("keeps the database-owned course-policy snapshot aligned with both catalogs", () => {
    const sql = readMigration();
    const snapshotMatch = sql.match(
      /\$course_submission_policies\$\s*([\s\S]*?)\s*\$course_submission_policies\$::jsonb/,
    );

    expect(snapshotMatch?.[1]).toBeDefined();

    const snapshot = JSON.parse(snapshotMatch?.[1] ?? "[]") as unknown[];
    const expected = buildExpectedPolicySnapshot();

    expect(snapshot).toEqual(expected);
    expect(new Set(expected.map(({ catalog_id, course_code }) => `${catalog_id}:${course_code}`)).size)
      .toBe(expected.length);
  });

  it("reserves the submitted transition and application-number generator for the RPC", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /create or replace function public\.submit_application[\s\S]*?security definer[\s\S]*?set search_path = public, pg_catalog/,
    );
    expect(sql).toContain(
      "revoke execute on function public.generate_application_number()",
    );
    expect(sql).toContain("and status = 'draft'");
    expect(sql).toContain("application_number is null");
    expect(sql).toContain("submitted_at is null");
  });

  it("makes submitted child records and stored evidence read-only for applicants", () => {
    const sql = readMigration();
    const protectedTables = [
      "application_documents",
      "tertiary_qualifications",
      "employment_experiences",
      "professional_accreditations",
      "secondary_qualifications",
      "language_tests",
    ];

    for (const table of protectedTables) {
      expect(sql).toContain(`('${table}',`);
    }

    expect(sql).toContain("private.enforce_draft_application_child_mutation()");
    expect(sql).toContain("private.enforce_draft_application_storage_mutation()");
    expect(sql).toContain(
      'create policy "Applicants read their own application document objects"',
    );
    expect(sql).not.toContain(
      'create policy "Users manage their own applications"',
    );
  });
});
