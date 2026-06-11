import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildApplicationDocumentStoragePath,
  getApplicationDocumentObjectPrefix,
  parseApplicationDocumentStoragePath,
  resolveStorageUploadOwnerUserId,
  sanitizeDocumentFileName,
} from "./documentStoragePath";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(testDir, "../../supabase/migrations");

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

describe("documentStoragePath", () => {
  const userId = "7713bc50-7fb5-4c79-8d6a-d5e5f0d9e821";
  const applicationId = "11de45ba-4aa0-45bd-b37b-9d7773474162";
  const documentId = "606808ad-08af-41d3-8077-c7ad7feab6dc";

  it("builds remote paths with the signed-in user as the first segment", () => {
    const storagePath = buildApplicationDocumentStoragePath({
      userId,
      applicationId,
      kind: "cv",
      documentId,
      fileName: "John-Carroll-Canva.pdf",
    });

    expect(storagePath).toBe(
      `${userId}/${applicationId}/cv/${documentId}-John-Carroll-Canva.pdf`,
    );
    expect(parseApplicationDocumentStoragePath(storagePath).ownerUserId).toBe(
      userId,
    );
  });

  it("sanitizes unsafe file names in the storage path", () => {
    expect(sanitizeDocumentFileName("John Carroll CV (final).pdf")).toBe(
      "John-Carroll-CV--final-.pdf",
    );
  });

  it("derives the object prefix used by upload limit checks", () => {
    expect(
      getApplicationDocumentObjectPrefix({ userId, applicationId }),
    ).toBe(`${userId}/${applicationId}/`);
  });

  it("round-trips parsed path segments", () => {
    const storagePath = buildApplicationDocumentStoragePath({
      userId,
      applicationId,
      kind: "cv",
      documentId,
      fileName: "resume.pdf",
    });

    expect(parseApplicationDocumentStoragePath(storagePath)).toEqual({
      ownerUserId: userId,
      applicationId,
      kind: "cv",
      documentId,
      fileName: "resume.pdf",
    });
  });

  it("rejects owner mismatch when auth context is available", () => {
    expect(() =>
      resolveStorageUploadOwnerUserId(userId, "00000000-0000-4000-8000-000000000001"),
    ).toThrow("UPLOAD_STORAGE_OWNER_MISMATCH");
  });

  it("uses the path owner when auth.uid() is unavailable in storage triggers", () => {
    expect(resolveStorageUploadOwnerUserId(userId, null)).toBe(userId);
    expect(resolveStorageUploadOwnerUserId(userId, undefined)).toBe(userId);
  });
});

describe("storage upload migration regressions", () => {
  const privateHelpersMigration = readMigration(
    "20260611123849_revoke_internal_upload_limit_function_grants.sql",
  );
  const authenticatedRevokeMigration = readMigration(
    "20260611132055_revoke_authenticated_private_upload_helper_grants.sql",
  );
  const privateTriggerWrappersMigration = readMigration(
    "20260611132230_move_upload_trigger_wrappers_to_private.sql",
  );

  it("keeps internal upload helpers in private schema as security definer", () => {
    expect(privateHelpersMigration).toContain(
      "private.enforce_application_document_storage_exists",
    );
    expect(privateHelpersMigration).toContain(
      "private.check_application_upload_limits",
    );
    expect(privateHelpersMigration).toContain(
      "private.check_application_storage_upload_limits",
    );
    expect(privateHelpersMigration).toMatch(
      /private\.check_application_storage_upload_limits[\s\S]*security definer/,
    );
    expect(privateHelpersMigration).toMatch(
      /private\.check_application_upload_limits[\s\S]*security definer/,
    );
    expect(privateHelpersMigration).toContain("storage.objects");
  });

  it("revokes anon RPC access and drops public helper functions", () => {
    expect(privateHelpersMigration).toMatch(
      /revoke all on function private\.check_application_upload_limits\(uuid, bigint\) from public, anon/,
    );
    expect(privateHelpersMigration).toMatch(
      /revoke all on function private\.check_application_storage_upload_limits\(uuid, uuid, text, bigint\)[\s\S]*from public, anon/,
    );
    expect(privateHelpersMigration).toMatch(
      /revoke all on function private\.enforce_application_document_storage_exists\(\) from public, anon/,
    );
    expect(privateHelpersMigration).toContain(
      "drop function if exists public.check_application_upload_limits(uuid, bigint)",
    );
    expect(privateHelpersMigration).toContain(
      "drop function if exists public.check_application_storage_upload_limits(uuid, uuid, text, bigint)",
    );
    expect(privateHelpersMigration).toContain(
      "drop function if exists public.enforce_application_document_storage_exists()",
    );
  });

  it("uses the path owner instead of auth.uid() for storage trigger limit checks", () => {
    expect(privateHelpersMigration).toContain(
      "owner_user_id := parsed.owner_user_id::uuid",
    );
    expect(privateHelpersMigration).toContain("auth.uid() is not null");
    expect(privateHelpersMigration).toMatch(
      /perform private\.check_application_storage_upload_limits\([\s\S]*owner_user_id,/,
    );
    expect(privateHelpersMigration).not.toMatch(
      /perform private\.check_application_storage_upload_limits\([\s\S]*auth\.uid\(\),/,
    );
  });

  it("revokes authenticated access to private upload helpers (DIS-127)", () => {
    expect(authenticatedRevokeMigration).toMatch(
      /revoke execute on function private\.check_application_upload_limits\(uuid, bigint\) from authenticated/,
    );
    expect(authenticatedRevokeMigration).toMatch(
      /revoke execute on function private\.check_application_storage_upload_limits\(uuid, uuid, text, bigint\)[\s\S]*from authenticated/,
    );
    expect(authenticatedRevokeMigration).toMatch(
      /revoke execute on function private\.enforce_application_document_storage_exists\(\) from authenticated/,
    );
    expect(authenticatedRevokeMigration).toContain(
      "revoke usage on schema private from authenticated",
    );
    expect(authenticatedRevokeMigration).not.toMatch(
      /grant execute on function private\./,
    );
  });

  it("moves upload trigger wrappers to private schema and drops public RPC copies", () => {
    expect(privateTriggerWrappersMigration).toMatch(
      /private\.enforce_application_document_upload_limits\(\)[\s\S]*security definer/,
    );
    expect(privateTriggerWrappersMigration).toMatch(
      /private\.enforce_application_storage_upload_limits\(\)[\s\S]*security definer/,
    );
    expect(privateTriggerWrappersMigration).toMatch(
      /revoke all on function private\.enforce_application_document_upload_limits\(\) from public, anon, authenticated/,
    );
    expect(privateTriggerWrappersMigration).toMatch(
      /revoke all on function private\.enforce_application_storage_upload_limits\(\) from public, anon, authenticated/,
    );
    expect(privateTriggerWrappersMigration).toContain(
      "execute function private.enforce_application_document_upload_limits()",
    );
    expect(privateTriggerWrappersMigration).toContain(
      "execute function private.enforce_application_storage_upload_limits()",
    );
    expect(privateTriggerWrappersMigration).toContain(
      "drop function if exists public.enforce_application_document_upload_limits()",
    );
    expect(privateTriggerWrappersMigration).toContain(
      "drop function if exists public.enforce_application_storage_upload_limits()",
    );
  });
});
