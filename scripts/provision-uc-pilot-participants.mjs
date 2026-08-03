import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FROZEN_UC_DEMO } from "./verify-uc-mvp-isolation.mjs";

const PARTNER_ID = "university-of-canberra";
const PARTICIPANT_COUNT = 100;
const PILOT_DAYS = 42;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() ?? "" : "";
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedRoster(input) {
  if (!Array.isArray(input) || input.length !== PARTICIPANT_COUNT) {
    throw new Error(`Roster must contain exactly ${PARTICIPANT_COUNT} participants.`);
  }
  const roster = input.map((item, index) => {
    const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
    const userId = typeof item?.userId === "string" ? item.userId.trim() : "";
    if (!email || !userId) throw new Error(`Roster item ${index + 1} needs email and userId.`);
    return { email, userId };
  });
  if (new Set(roster.map((item) => item.email)).size !== roster.length) {
    throw new Error("Roster emails must be unique.");
  }
  if (new Set(roster.map((item) => item.userId)).size !== roster.length) {
    throw new Error("Roster user IDs must be unique.");
  }
  return roster;
}

async function main() {
  const inputPath = argument("--input");
  const outputPath = argument("--output");
  const start = new Date(argument("--start"));
  if (!inputPath || !outputPath || !Number.isFinite(start.getTime())) {
    throw new Error(
      "Use --input roster.json --output invitations.json --start 2026-09-01T00:00:00Z.",
    );
  }

  const projectRef = required("UC_MVP_SUPABASE_PROJECT_REF");
  const demoProjectRef = required("UC_DEMO_SUPABASE_PROJECT_REF");
  const supabaseUrl = required("UC_MVP_SUPABASE_URL");
  const serviceRoleKey = required("UC_MVP_SUPABASE_SERVICE_ROLE_KEY");
  const allocationSalt = required("UC_PILOT_ALLOCATION_SALT");
  const invitationBaseUrl = required("UC_PILOT_INVITATION_BASE_URL");
  const urlProjectRef = new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  if (projectRef === demoProjectRef || urlProjectRef !== projectRef) {
    throw new Error("Participant provisioning is blocked for the frozen demo project.");
  }
  const base = new URL(invitationBaseUrl);
  if (
    base.hostname === FROZEN_UC_DEMO.alias ||
    base.hostname === FROZEN_UC_DEMO.directUrl
  ) {
    throw new Error("Participant invitations cannot point to the frozen demo.");
  }

  const roster = normalizedRoster(
    JSON.parse(readFileSync(resolve(inputPath), "utf8")),
  ).sort((left, right) =>
    createHmac("sha256", allocationSalt)
      .update(left.userId)
      .digest("hex")
      .localeCompare(
        createHmac("sha256", allocationSalt).update(right.userId).digest("hex"),
      ),
  );
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const verified = await Promise.all(
    roster.map(async (participant) => {
      const { data, error } = await admin.auth.admin.getUserById(participant.userId);
      const user = data.user;
      if (
        error ||
        !user ||
        user.email?.trim().toLowerCase() !== participant.email ||
        !user.email_confirmed_at
      ) {
        throw new Error(
          `Pilot account ${participant.userId} is missing, mismatched, or unconfirmed.`,
        );
      }
      return participant;
    }),
  );

  const expiresAt = new Date(start.getTime() + PILOT_DAYS * 24 * 60 * 60 * 1_000);
  const invitations = verified.map((participant, index) => {
    const token = randomBytes(32).toString("base64url");
    const url = new URL("/assessment", base);
    url.searchParams.set("invite", token);
    return {
      cohort: index < PARTICIPANT_COUNT / 2 ? "control" : "treatment",
      email: participant.email,
      emailHash: sha256(`${allocationSalt}:${participant.email}`),
      expiresAt: expiresAt.toISOString(),
      invitationTokenHash: sha256(token),
      invitationUrl: url.toString(),
      userId: participant.userId,
    };
  });

  writeFileSync(
    resolve(outputPath),
    `${JSON.stringify(
      invitations.map(({ email, cohort, invitationUrl, userId }) => ({
        cohort,
        email,
        invitationUrl,
        userId,
      })),
      null,
      2,
    )}\n`,
    { flag: "wx", mode: 0o600 },
  );

  const { error } = await admin.from("pilot_participants").insert(
    invitations.map((invitation) => ({
      cohort: invitation.cohort,
      email_hash: invitation.emailHash,
      expires_at: invitation.expiresAt,
      invitation_token_hash: invitation.invitationTokenHash,
      invited_user_id: invitation.userId,
      partner_id: PARTNER_ID,
    })),
  );
  if (error) throw error;

  process.stdout.write(
    `Provisioned 100 confirmed pilot accounts (50 control, 50 treatment); invitation file permissions are owner-only.\n`,
  );
}

await main();
