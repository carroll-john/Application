import type { RequirementInstance, WorkExperienceRoleInput } from "@johncarroll/eligibility-rules";

type WorkRequirement = Extract<RequirementInstance, { kind: "work_experience" }>;
export const MAX_WORK_REQUEST_BYTES = 512 * 1024;
export const MAX_WORK_MODEL_BYTES = 256 * 1024;

export class WorkInputError extends Error {}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkInputError();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new WorkInputError();
  return record;
}

function text(value: unknown, max = 5_000): value is string {
  return typeof value === "string" && value.length <= max;
}

function years(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function requirement(value: unknown): WorkRequirement {
  const r = object(value, ["id", "kind", "params", "sourceText", "weight", "alternativeGroupId", "pathwayBundleId"]);
  if (r.kind !== "work_experience" || !text(r.id, 256) || !r.id.trim() ||
      !text(r.sourceText) || typeof r.weight !== "string" ||
      !["mandatory", "alternative", "conditional"].includes(r.weight)) {
    throw new WorkInputError();
  }
  for (const key of ["alternativeGroupId", "pathwayBundleId"]) {
    if (r[key] !== undefined && !text(r[key], 256)) throw new WorkInputError();
  }
  const p = object(r.params, ["minYears", "relevantTo", "qualifyingRoleCriteria"]);
  if (!years(p.minYears) || (p.relevantTo !== undefined && !text(p.relevantTo))) throw new WorkInputError();
  if (p.qualifyingRoleCriteria !== undefined) {
    const c = object(p.qualifyingRoleCriteria, ["description", "minYears"]);
    if (!text(c.description) || !c.description.trim() || (c.minYears !== undefined && !years(c.minYears))) {
      throw new WorkInputError();
    }
  }
  // Preserve every declared field for the client's assessment fingerprint. All nested
  // fields have been checked; unknown state is rejected rather than truncated.
  return r as unknown as WorkRequirement;
}

function role(value: unknown): WorkExperienceRoleInput {
  const r = object(value, ["id", "position", "duties", "startMonth", "startYear", "endMonth", "endYear", "currentRole"]);
  if (!text(r.id, 256) || !r.id.trim()) throw new WorkInputError();
  for (const key of ["position", "duties", "startMonth", "startYear", "endMonth", "endYear"]) {
    if (r[key] !== undefined && !text(r[key])) throw new WorkInputError();
  }
  if (r.currentRole !== undefined && typeof r.currentRole !== "boolean") throw new WorkInputError();
  const clean = (key: string) => typeof r[key] === "string" ? r[key].trim() : "";
  return { id: r.id.trim(), position: clean("position"), duties: clean("duties"),
    startMonth: clean("startMonth"), startYear: clean("startYear"), endMonth: clean("endMonth"),
    endYear: clean("endYear"), currentRole: r.currentRole === true };
}

export function parseWorkInput(value: unknown) {
  const r = object(value, ["requirements", "roles"]);
  if (!Array.isArray(r.requirements) || r.requirements.length < 1 || r.requirements.length > 12 ||
      !Array.isArray(r.roles) || r.roles.length > 30) throw new WorkInputError();
  const requirements = r.requirements.map(requirement);
  const roles = r.roles.map(role);
  if (new Set(requirements.map((r) => r.id)).size !== requirements.length ||
      new Set(roles.map((r) => r.id)).size !== roles.length) throw new WorkInputError();
  const modelText = JSON.stringify({
    requirements: requirements.map(({ id, params, sourceText }) => ({ id, params, sourceText })),
    roles: roles.map(({ id, position, duties }) => ({ id, position, duties })),
  });
  if (Buffer.byteLength(modelText, "utf8") > MAX_WORK_MODEL_BYTES) throw new WorkInputError();
  return { requirements, roles, modelText };
}

export async function readWorkBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_WORK_REQUEST_BYTES)) throw new WorkInputError();
  if (!request.body) throw new WorkInputError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new WorkInputError());
    }, 10_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_WORK_REQUEST_BYTES) throw new WorkInputError();
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
