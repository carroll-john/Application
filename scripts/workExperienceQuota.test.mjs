// Run explicitly with WORK_QUOTA_TEST_CONTAINER=<local Postgres container>
// node --test scripts/workExperienceQuota.test.mjs. Uses a disposable database;
// never changes an application database or a hosted environment.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const exec = promisify(execFile);
test("durable quota: permissions, parallel users/instances, exhaustion and rollover", async () => {
  const container = process.env.WORK_QUOTA_TEST_CONTAINER;
  assert.ok(container, "Set WORK_QUOTA_TEST_CONTAINER to a local PostgreSQL container");
  const db = `work_quota_test_${process.pid}`;
  const sql = async (query, database = db) => {
    const { stdout } = await exec("docker", ["exec", container, "psql", "-U", "postgres", "-d", database,
      "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query], { maxBuffer: 1024 * 1024 });
    return stdout.trim();
  };
  const user = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const reserve = (id) => sql(`set role service_role; select public.reserve_work_experience_quota('${id}'::uuid);`);
  await sql(`create database ${db};`, "postgres");
  try {
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const file = (await readdir(directory)).find((file) => file.endsWith("_work_experience_resource_quota.sql"));
    assert.ok(file);
    await sql(await readFile(new URL(file, directory), "utf8"));
    assert.equal(await sql("select relrowsecurity from pg_class where oid = 'public.work_experience_quota'::regclass;"), "t");
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(sql(`set role ${role}; select public.reserve_work_experience_quota('${user}');`), /permission denied/);
      await assert.rejects(sql(`set role ${role}; select * from public.work_experience_quota;`), /permission denied/);
      await assert.rejects(sql(`set role ${role}; delete from public.work_experience_quota;`), /permission denied/);
    }
    assert.equal(await reserve(user), "t");
    await sql(`update public.work_experience_quota set reserved_attempts = 38 where quota_key = 'user:${user}';`);
    const race = await Promise.all(Array.from({ length: 8 }, () => reserve(user)));
    assert.equal(race.filter((r) => r === "t").length, 1);
    assert.equal(await sql(`select reserved_attempts from public.work_experience_quota where quota_key = 'user:${user}';`), "40");
    assert.equal(await sql("select reserved_attempts from public.work_experience_quota where quota_key = 'project';"), "4");
    assert.equal(await reserve(other), "t");
    await sql("update public.work_experience_quota set reserved_attempts = 998 where quota_key = 'project';");
    const projectRace = await Promise.all([reserve(other), reserve("00000000-0000-0000-0000-000000000003")]);
    assert.deepEqual(projectRace.sort(), ["f", "t"]);
    assert.equal(await sql("select reserved_attempts from public.work_experience_quota where quota_key = 'project';"), "1000");
    assert.equal(await reserve("00000000-0000-0000-0000-000000000004"), "f");
    await sql("update public.work_experience_quota set window_started_at = clock_timestamp() - interval '25 hours';");
    assert.equal(await reserve(user), "t");
    assert.equal(await sql("select reserved_attempts from public.work_experience_quota where quota_key = 'project';"), "2");
    assert.equal(await sql(`select reserved_attempts from public.work_experience_quota where quota_key = 'user:${user}';`), "2");
    assert.equal(await sql("select count(*) from public.work_experience_quota;"), "2");
    await assert.rejects(sql("set role service_role; select public.reserve_work_experience_quota(null);"), /User required/);
  } finally {
    await sql(`drop database ${db} with (force);`, "postgres");
  }
});
