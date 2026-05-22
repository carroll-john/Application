#!/usr/bin/env node
/**
 * Verify Resend domain + sender readiness for Supabase auth email delivery.
 * Mirrors the Resend MCP workflow when RESEND_API_KEY is configured.
 *
 * Usage:
 *   RESEND_API_KEY=re_... npm run verify-resend
 *   RESEND_API_KEY=re_... npm run verify-resend -- --smoke-test john.carroll@keypathedu.com.au
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREFERRED_DOMAIN = "carroll.consulting";
const SENDER = `Applications <noreply@${PREFERRED_DOMAIN}>`;
const SUPABASE_SMTP = {
  host: "smtp.resend.com",
  port: "465",
  username: "resend",
  password: "<your Resend API key>",
  senderEmail: `noreply@${PREFERRED_DOMAIN}`,
};

function loadApiKey() {
  if (process.env.RESEND_API_KEY?.trim()) {
    return process.env.RESEND_API_KEY.trim();
  }

  const envLocalPath = resolve(rootDir, ".env.local");
  if (!existsSync(envLocalPath)) {
    return null;
  }

  for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
    const match = line.match(/^RESEND_API_KEY=(.+)$/);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return null;
}

async function resendFetch(apiKey, path, options = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return body;
}

function printSupabaseSmtpBlock() {
  console.log("\nSupabase Auth → SMTP (project weyxnhykyyetquqprfnu):");
  console.log(`  Host:         ${SUPABASE_SMTP.host}`);
  console.log(`  Port:         ${SUPABASE_SMTP.port}`);
  console.log(`  Username:     ${SUPABASE_SMTP.username}`);
  console.log(`  Password:     ${SUPABASE_SMTP.password}`);
  console.log(`  Sender email: ${SUPABASE_SMTP.senderEmail}`);
  console.log(
    "  Dashboard:    https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/smtp",
  );
}

function findPreferredDomain(domains) {
  const items = domains?.data ?? [];
  return items.find(
    (domain) =>
      domain.name === PREFERRED_DOMAIN || domain.name === "carroll.consulting",
  );
}

async function ensureDomain(apiKey) {
  const listed = await resendFetch(apiKey, "/domains");
  const existing = findPreferredDomain(listed);

  if (existing) {
    console.log(`Found domain: ${existing.name} (${existing.status})`);
    const detail = await resendFetch(apiKey, `/domains/${existing.id}`);
    return detail;
  }

  console.log(`Creating domain ${PREFERRED_DOMAIN}...`);
  const created = await resendFetch(apiKey, "/domains", {
    method: "POST",
    body: JSON.stringify({
      name: PREFERRED_DOMAIN,
      region: "ap-northeast-1",
      customReturnPath: "bounce",
      openTracking: false,
      clickTracking: false,
    }),
  });

  console.log(`Created domain ${created.name} (${created.status})`);
  return created;
}

async function maybeVerifyDomain(apiKey, domain) {
  if (domain.status === "verified") {
    return domain;
  }

  console.log("Triggering domain verification...");
  await resendFetch(apiKey, `/domains/${domain.id}/verify`, { method: "POST" });
  const refreshed = await resendFetch(apiKey, `/domains/${domain.id}`);
  console.log(`Domain status after verify: ${refreshed.status}`);
  return refreshed;
}

function printDnsRecords(domain) {
  const records = domain.records ?? [];
  if (records.length === 0) {
    return;
  }

  console.log("\nDNS records to add at your registrar:");
  for (const record of records) {
    console.log(
      `  ${record.type.padEnd(6)} ${record.name} → ${record.value} (${record.status ?? "pending"})`,
    );
  }
}

async function sendSmokeTest(apiKey, recipient) {
  console.log(`\nSending smoke test to ${recipient}...`);
  const result = await resendFetch(apiKey, "/emails", {
    method: "POST",
    body: JSON.stringify({
      from: SENDER,
      to: [recipient],
      subject: "Applications — Resend smoke test",
      text: "Resend is configured for Applications auth email delivery.",
      html: "<p>Resend is configured for <strong>Applications</strong> auth email delivery.</p>",
    }),
  });

  console.log(`Smoke test queued. Email id: ${result.id}`);
  return result.id;
}

async function main() {
  const smokeRecipient = process.argv.includes("--smoke-test")
    ? process.argv[process.argv.indexOf("--smoke-test") + 1]
    : null;

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error(
      [
        "RESEND_API_KEY is not configured.",
        "",
        "Cursor Resend MCP: Settings → Plugins → Resend → set RESEND_API_KEY",
        "CLI / this script: export RESEND_API_KEY=re_... or add to .env.local",
        "",
        "Create a key at https://resend.com/api-keys then re-run:",
        "  RESEND_API_KEY=re_... npm run verify-resend",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(`Using sender: ${SENDER}`);

  let domain = await ensureDomain(apiKey);
  printDnsRecords(domain);
  domain = await maybeVerifyDomain(apiKey, domain);

  if (domain.status !== "verified") {
    console.log(
      "\nDomain is not verified yet. Add the DNS records above, wait for propagation, then re-run.",
    );
    printSupabaseSmtpBlock();
    process.exit(2);
  }

  console.log("\nDomain verified. Ready for Supabase custom SMTP.");
  printSupabaseSmtpBlock();

  if (smokeRecipient) {
    await sendSmokeTest(apiKey, smokeRecipient);
    console.log("\nCheck delivery with Resend MCP list-emails / list-logs.");
  } else {
    console.log(
      "\nOptional smoke test:",
      "npm run verify-resend -- --smoke-test john.carroll@keypathedu.com.au",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
