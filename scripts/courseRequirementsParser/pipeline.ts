import type { CourseRequirementsV2 } from "../../src/lib/eligibility/courseRequirementsV2.js";
import type { RequirementInstance } from "../../src/lib/eligibility/requirements.js";
import {
  consolidateCourseRequirementsV2,
  validateCourseRequirementsV2,
  wrapFlatRequirementsAsV2,
} from "../../src/lib/eligibility/courseRequirementsV2.js";
import { buildParserKindInstructions } from "../../src/lib/eligibility/requirementKindRegistry.js";

export const DEFAULT_PARSER_MODEL = "gpt-4.1-mini";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export interface ParsedClause {
  text: string;
  sectionLabel?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  v2?: CourseRequirementsV2;
}

const STRUCTURE_INSTRUCTIONS = `You structure classified requirement leaves into CourseRequirementsV2:
- version: 2
- global: requirements applying to every pathway (typically English proficiency)
- pathways: array of { id, label?, requirements[] } where each pathway is one entry route (OR across pathways, AND within a pathway)
- Use alternativeGroupId only for genuine OR within the same pathway (e.g. WAM OR experience)
- Never put requirements from different entry routes into the same pathway
- Every pathway id must be unique kebab-case`;

export function buildSegmentInstructions(): string {
  return `Split university course entry-requirement text into atomic clauses.
Each clause should be one assessable requirement sentence or bullet.
Preserve verbatim text. Include sectionLabel when the source names an entry level or credit-point route.`;
}

export function buildClassifyInstructions(): string {
  return `Convert each clause into RequirementInstance objects.

Allowed kinds (exhaustive):
${buildParserKindInstructions()}

Rules:
- One RequirementInstance per atomic requirement per clause
- sourceText must be verbatim from the clause
- weight: mandatory unless genuinely interchangeable (alternative) or waivable (conditional)
- Do not invent requirements not evidenced in the clause
- Do not emit both qualification_completed and qualification_level for the same clause; prefer qualification_level when a minimum level is stated (e.g. bachelor degree)`;
}

export function buildStructureInstructions(): string {
  return STRUCTURE_INSTRUCTIONS;
}

export function buildRepairInstructions(errors: string[]): string {
  return `Fix the structured course requirements. Validation errors:\n${errors.map((error) => `- ${error}`).join("\n")}\n\n${STRUCTURE_INSTRUCTIONS}`;
}

function buildLeafSchema() {
  const pathway = {
    anyOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "countries"],
        properties: {
          type: { type: "string", enum: ["completion_in_country"] },
          countries: { type: "array", items: { type: "string" } },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "test", "minOverall", "minBand"],
        properties: {
          type: { type: "string", enum: ["english_test"] },
          test: { type: "string", enum: ["IELTS", "TOEFL_iBT", "PTE", "CAE", "OET"] },
          minOverall: { type: "number" },
          minBand: { type: ["number", "null"] },
        },
      },
    ],
  };

  const instance = {
    type: "object",
    additionalProperties: false,
    required: ["id", "kind", "params", "sourceText", "weight", "alternativeGroupId"],
    properties: {
      id: { type: "string" },
      kind: {
        type: "string",
        enum: [
          "qualification_completed",
          "qualification_level",
          "academic_threshold",
          "english_proficiency",
          "work_experience",
          "field_of_study",
        ],
      },
      params: { type: "object" },
      sourceText: { type: "string" },
      weight: { type: "string", enum: ["mandatory", "alternative", "conditional"] },
      alternativeGroupId: { type: ["string", "null"] },
    },
  };

  return { instance, pathway };
}

export function buildSegmentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["clauses"],
    properties: {
      clauses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "sectionLabel"],
          properties: {
            text: { type: "string" },
            sectionLabel: { type: ["string", "null"] },
          },
        },
      },
    },
  };
}

export function buildClassifySchema() {
  const { instance } = buildLeafSchema();
  return {
    type: "object",
    additionalProperties: false,
    required: ["leaves"],
    properties: {
      leaves: { type: "array", items: instance },
    },
  };
}

export function buildStructureSchema() {
  const { instance } = buildLeafSchema();
  return {
    type: "object",
    additionalProperties: false,
    required: ["version", "global", "pathways"],
    properties: {
      version: { type: "number", enum: [2] },
      global: { type: "array", items: instance },
      pathways: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "requirements"],
          properties: {
            id: { type: "string" },
            label: { type: ["string", "null"] },
            requirements: { type: "array", items: instance },
          },
        },
      },
    },
  };
}

export async function callOpenAiStructured<T>(options: {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const body = {
    model: options.model,
    max_output_tokens: 4000,
    instructions: options.instructions,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: options.input }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    output_parsed?: T;
    output_text?: string;
  };

  if (payload.output_parsed) {
    return payload.output_parsed;
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return JSON.parse(payload.output_text) as T;
  }

  throw new Error("OpenAI response did not contain structured output.");
}

export function validateStructuredRequirements(
  value: unknown,
): ValidationResult {
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Structured output is not an object."] };
  }

  const candidate = value as CourseRequirementsV2;
  if (candidate.version !== 2) {
    return { ok: false, errors: ["Expected version 2 requirements."] };
  }

  const issues = validateCourseRequirementsV2(candidate);
  if (issues.length > 0) {
    return {
      ok: false,
      errors: issues.map((issue) => `${issue.code}: ${issue.message}`),
    };
  }

  return { ok: true, errors: [], v2: candidate };
}

export function leavesToDefaultStructure(leaves: RequirementInstance[]): CourseRequirementsV2 {
  return wrapFlatRequirementsAsV2(leaves);
}

export interface PipelineResult {
  v2: CourseRequirementsV2;
  stages: {
    clauses: ParsedClause[];
    leaves: RequirementInstance[];
    repairAttempts: number;
  };
}

export async function runExtractionPipeline(options: {
  apiKey: string;
  model: string;
  courseName: string;
  providerName: string;
  entryText: string;
  maxRepairAttempts?: number;
}): Promise<PipelineResult> {
  if (!options.entryText.trim()) {
    return {
      v2: { version: 2, global: [], pathways: [] },
      stages: { clauses: [], leaves: [], repairAttempts: 0 },
    };
  }

  const header = `Course: ${options.courseName}\nProvider: ${options.providerName}\n\nEntry requirements text:\n${options.entryText}`;
  let repairAttempts = 0;
  const maxRepairAttempts = options.maxRepairAttempts ?? 2;

  const segmentResult = await callOpenAiStructured<{ clauses: ParsedClause[] }>({
    apiKey: options.apiKey,
    model: options.model,
    instructions: buildSegmentInstructions(),
    input: header,
    schemaName: "course_requirement_clauses",
    schema: buildSegmentSchema(),
  });

  const classifyResult = await callOpenAiStructured<{ leaves: RequirementInstance[] }>({
    apiKey: options.apiKey,
    model: options.model,
    instructions: buildClassifyInstructions(),
    input: `${header}\n\nClauses:\n${segmentResult.clauses.map((clause) => `- [${clause.sectionLabel ?? "general"}] ${clause.text}`).join("\n")}`,
    schemaName: "course_requirement_leaves",
    schema: buildClassifySchema(),
  });

  let structureResult = await callOpenAiStructured<CourseRequirementsV2>({
    apiKey: options.apiKey,
    model: options.model,
    instructions: buildStructureInstructions(),
    input: `${header}\n\nLeaves:\n${JSON.stringify(classifyResult.leaves, null, 2)}`,
    schemaName: "course_requirements_v2",
    schema: buildStructureSchema(),
  });

  let validation = validateStructuredRequirements(structureResult);

  while (!validation.ok && repairAttempts < maxRepairAttempts) {
    repairAttempts += 1;
    structureResult = await callOpenAiStructured<CourseRequirementsV2>({
      apiKey: options.apiKey,
      model: options.model,
      instructions: buildRepairInstructions(validation.errors),
      input: `${header}\n\nPrevious output:\n${JSON.stringify(structureResult, null, 2)}`,
      schemaName: "course_requirements_v2_repair",
      schema: buildStructureSchema(),
    });
    validation = validateStructuredRequirements(structureResult);
  }

  if (!validation.ok || !validation.v2) {
    throw new Error(
      `Validation failed after ${repairAttempts} repair attempts: ${validation.errors.join("; ")}`,
    );
  }

  return {
    v2: consolidateCourseRequirementsV2(validation.v2),
    stages: {
      clauses: segmentResult.clauses,
      leaves: classifyResult.leaves,
      repairAttempts,
    },
  };
}
