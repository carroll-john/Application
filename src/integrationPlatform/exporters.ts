import type {
  CanonicalApplicationV1,
  MappingTransform,
  SecureHandoffDescriptor,
  SchemaVersion,
  TransferArtifact,
  TransferPackageManifestV1,
} from "./contracts";
import {
  isBackwardCompatibleVersion,
  transferPackageManifestSchemaDefaults,
} from "./contracts";
import type { DecisionRecordV1 } from "./provisioning";
import {
  type ValidationResult,
  validateTransferPackageManifest,
} from "./validation";

export type StructuredExportFormat = "csv" | "xml";
export const EXPORT_MAPPING_CONFIG_SCHEMA_VERSION = "1.0.0";

export interface ExportFieldMappingConfig {
  sourcePath: string;
  outputKey: string;
  required: boolean;
  transform?: MappingTransform;
  defaultValue?: string;
}

export type ExportTemplateField = ExportFieldMappingConfig;

export interface UniversityExportMappingConfigV1 {
  schema: "UniversityExportMappingConfigV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  configId: string;
  configVersion: SchemaVersion;
  partnerId: string;
  partnerName: string;
  overlayId: string;
  mappingProfileId: string;
  format: StructuredExportFormat;
  filenameStem: string;
  rootElementName?: string;
  rowElementName?: string;
  documentBasePath?: string;
  fields: ExportFieldMappingConfig[];
  handoff: Omit<SecureHandoffDescriptor, "idempotencyKey">;
  metadata?: Record<string, string>;
}

export const universityExportMappingConfigSchemaDefaults: Pick<
  UniversityExportMappingConfigV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "UniversityExportMappingConfigV1",
  schemaVersion: EXPORT_MAPPING_CONFIG_SCHEMA_VERSION,
  compatibilityVersion: EXPORT_MAPPING_CONFIG_SCHEMA_VERSION,
};

export type UniversityExportTemplate = UniversityExportMappingConfigV1;

export interface StructuredExportTraceability {
  configId: string;
  configVersion: SchemaVersion;
  overlayId: string;
  mappingProfileId: string;
  provisioningJobId?: string;
}

export interface GeneratedStructuredExport {
  filename: string;
  content: string;
  artifact: TransferArtifact;
  manifest: TransferPackageManifestV1;
  idempotencyKey: string;
  traceability: StructuredExportTraceability;
  configValidation: ValidationResult;
  formatValidation: ValidationResult;
  manifestValidation: ValidationResult;
  reusedExistingArtifact: boolean;
}

export interface StructuredExportArtifactReference {
  idempotencyKey: string;
  decisionId: string;
  applicationId: string;
  partnerId: string;
  filename: string;
  content: string;
  artifact: TransferArtifact;
  manifest: TransferPackageManifestV1;
  traceability: StructuredExportTraceability;
}

export interface StructuredExportArtifactStore {
  getByIdempotencyKey(
    idempotencyKey: string,
  ): StructuredExportArtifactReference | undefined;
  save(reference: StructuredExportArtifactReference): void;
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

const XML_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9._-]*$/;
const VALID_TRANSFORMS = new Set<MappingTransform>([
  "identity",
  "uppercase",
  "lowercase",
  "date-iso",
  "boolean-yes-no",
  "join-lines",
]);

function cloneArtifact(artifact: TransferArtifact): TransferArtifact {
  return {
    ...artifact,
  };
}

function cloneManifest(
  manifest: TransferPackageManifestV1,
): TransferPackageManifestV1 {
  return {
    ...manifest,
    artifacts: manifest.artifacts.map((artifact) => cloneArtifact(artifact)),
    documents: manifest.documents.map((document) => ({ ...document })),
    handoff: {
      ...manifest.handoff,
    },
    metadata: manifest.metadata ? { ...manifest.metadata } : undefined,
  };
}

function cloneTraceability(
  traceability: StructuredExportTraceability,
): StructuredExportTraceability {
  return {
    ...traceability,
  };
}

function cloneStoredReference(
  reference: StructuredExportArtifactReference,
): StructuredExportArtifactReference {
  return {
    ...reference,
    artifact: cloneArtifact(reference.artifact),
    manifest: cloneManifest(reference.manifest),
    traceability: cloneTraceability(reference.traceability),
  };
}

export class InMemoryStructuredExportArtifactStore
  implements StructuredExportArtifactStore
{
  private readonly references = new Map<
    string,
    StructuredExportArtifactReference
  >();

  getByIdempotencyKey(
    idempotencyKey: string,
  ): StructuredExportArtifactReference | undefined {
    const existing = this.references.get(idempotencyKey);
    return existing ? cloneStoredReference(existing) : undefined;
  }

  save(reference: StructuredExportArtifactReference): void {
    this.references.set(
      reference.idempotencyKey,
      cloneStoredReference(reference),
    );
  }
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function tokenizePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const tokenRegex = /[^.[\]]+|\[(\d+)\]/g;

  for (const match of path.matchAll(tokenRegex)) {
    if (match[1] !== undefined) {
      tokens.push(Number(match[1]));
    } else {
      tokens.push(match[0]);
    }
  }

  return tokens;
}

function getPathValue(source: unknown, path: string): unknown {
  return tokenizePath(path).reduce<unknown>((current, token) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof token === "number") {
      return Array.isArray(current) ? current[token] : undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[token];
  }, source);
}

function normalizePrimitiveValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePrimitiveValue(item)).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizePrimitiveValue(item))
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

function applyTransform(value: string, transform: MappingTransform | undefined): string {
  if (!transform || transform === "identity") {
    return value;
  }

  if (transform === "uppercase") {
    return value.toUpperCase();
  }

  if (transform === "lowercase") {
    return value.toLowerCase();
  }

  if (transform === "date-iso") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
  }

  if (transform === "boolean-yes-no") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1"
      ? "Yes"
      : "No";
  }

  if (transform === "join-lines") {
    return value.replace(/\r?\n/g, " | ");
  }

  return value;
}

function validateXmlTagName(
  value: string | undefined,
  field: string,
  errors: string[],
): void {
  if (value && !XML_NAME_REGEX.test(value)) {
    errors.push(`${field} must be a valid XML element name.`);
  }
}

export function validateUniversityExportMappingConfig(
  config: UniversityExportMappingConfigV1,
): ValidationResult {
  const errors: string[] = [];

  if (config.schema !== "UniversityExportMappingConfigV1") {
    errors.push("schema must equal UniversityExportMappingConfigV1.");
  }

  if (
    !isBackwardCompatibleVersion(
      config.schemaVersion,
      config.compatibilityVersion,
    )
  ) {
    errors.push(
      "compatibilityVersion must be backward compatible with schemaVersion.",
    );
  }

  if (!hasValue(config.configId)) {
    errors.push("configId is required.");
  }

  if (!hasValue(config.partnerId)) {
    errors.push("partnerId is required.");
  }

  if (!hasValue(config.partnerName)) {
    errors.push("partnerName is required.");
  }

  if (!hasValue(config.overlayId)) {
    errors.push("overlayId is required.");
  }

  if (!hasValue(config.mappingProfileId)) {
    errors.push("mappingProfileId is required.");
  }

  if (!hasValue(config.filenameStem)) {
    errors.push("filenameStem is required.");
  }

  if (config.fields.length === 0) {
    errors.push("At least one export field mapping is required.");
  }

  validateXmlTagName(config.rootElementName, "rootElementName", errors);
  validateXmlTagName(config.rowElementName, "rowElementName", errors);

  if (!hasValue(config.handoff.destinationRef)) {
    errors.push("handoff.destinationRef is required.");
  }

  const seenOutputKeys = new Set<string>();

  config.fields.forEach((field, index) => {
    if (!hasValue(field.sourcePath)) {
      errors.push(`fields[${index}].sourcePath is required.`);
    }

    if (!hasValue(field.outputKey)) {
      errors.push(`fields[${index}].outputKey is required.`);
    }

    if (field.outputKey && seenOutputKeys.has(field.outputKey)) {
      errors.push(`fields[${index}].outputKey must be unique within a config.`);
    }

    if (field.outputKey) {
      seenOutputKeys.add(field.outputKey);
    }

    if (config.format === "xml") {
      validateXmlTagName(
        field.outputKey,
        `fields[${index}].outputKey`,
        errors,
      );
    }

    if (
      field.transform !== undefined &&
      !VALID_TRANSFORMS.has(field.transform)
    ) {
      errors.push(`fields[${index}].transform is not supported.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function resolveSourceValue(
  application: CanonicalApplicationV1,
  decision: DecisionRecordV1,
  field: ExportTemplateField,
): string {
  const [root, relativePath] = field.sourcePath.startsWith("decision.")
    ? [decision, field.sourcePath.slice("decision.".length)]
    : field.sourcePath.startsWith("application.")
      ? [application, field.sourcePath.slice("application.".length)]
      : [application, field.sourcePath];

  const rawValue = getPathValue(root, relativePath);
  const normalizedValue = normalizePrimitiveValue(rawValue);
  const resolved = hasValue(normalizedValue) ? normalizedValue : field.defaultValue ?? "";

  if (field.required && !hasValue(resolved)) {
    throw new Error(`Missing required export value for ${field.sourcePath}.`);
  }

  return applyTransform(resolved, field.transform);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function renderCsv(fields: ExportTemplateField[], values: string[]): string {
  const header = fields.map((field) => csvEscape(field.outputKey)).join(",");
  const row = values.map((value) => csvEscape(value)).join(",");
  return `${header}\n${row}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderXml(
  template: UniversityExportTemplate,
  fields: ExportTemplateField[],
  values: string[],
): string {
  const rootElementName = template.rootElementName ?? "ImportPackage";
  const rowElementName = template.rowElementName ?? "Application";
  const fieldLines = fields
    .map((field, index) => `    <${field.outputKey}>${xmlEscape(values[index])}</${field.outputKey}>`)
    .join("\n");

  return [
    `<${rootElementName}>`,
    `  <${rowElementName}>`,
    fieldLines,
    `  </${rowElementName}>`,
    `</${rootElementName}>`,
  ].join("\n");
}

async function sha256Hex(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function validateCsvContent(
  template: UniversityExportTemplate,
  content: string,
): ValidationResult {
  const [headerLine, rowLine] = content.replaceAll("\r\n", "\n").split("\n");
  const expectedHeaders = template.fields.map((field) => field.outputKey);

  if (!headerLine || !rowLine) {
    return {
      valid: false,
      errors: ["CSV export must contain exactly one header row and one data row."],
    };
  }

  const headers = parseCsvLine(headerLine);
  const rowValues = parseCsvLine(rowLine);
  const errors: string[] = [];

  if (headers.join("|") !== expectedHeaders.join("|")) {
    errors.push("CSV headers do not match the configured export template.");
  }

  if (rowValues.length !== expectedHeaders.length) {
    errors.push("CSV row width does not match the configured export template.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateXmlContent(
  template: UniversityExportTemplate,
  content: string,
): ValidationResult {
  const rootElementName = template.rootElementName ?? "ImportPackage";
  const rowElementName = template.rowElementName ?? "Application";
  const errors: string[] = [];

  if (!content.startsWith(`<${rootElementName}>`)) {
    errors.push(`XML export must start with <${rootElementName}>.`);
  }

  if (!content.includes(`<${rowElementName}>`)) {
    errors.push(`XML export must include <${rowElementName}>.`);
  }

  template.fields.forEach((field) => {
    if (!content.includes(`<${field.outputKey}>`)) {
      errors.push(`XML export is missing <${field.outputKey}>.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateStructuredExportContent(
  template: UniversityExportTemplate,
  content: string,
): ValidationResult {
  return template.format === "csv"
    ? validateCsvContent(template, content)
    : validateXmlContent(template, content);
}

export function createStructuredExportIdempotencyKey(
  decision: DecisionRecordV1,
  template: UniversityExportTemplate,
): string {
  return `${decision.decisionId}:${template.partnerId}:${template.configId}:${template.configVersion}`;
}

export async function generateStructuredExport(input: {
  application: CanonicalApplicationV1;
  decision: DecisionRecordV1;
  template: UniversityExportTemplate;
  generatedAt: string;
  artifactStore?: StructuredExportArtifactStore;
  provisioningJobId?: string;
}): Promise<GeneratedStructuredExport> {
  const {
    application,
    decision,
    template,
    generatedAt,
    artifactStore,
    provisioningJobId,
  } = input;
  const configValidation = validateUniversityExportMappingConfig(template);

  if (!configValidation.valid) {
    throw new Error(
      `Invalid export mapping config. ${configValidation.errors.join(" ")}`,
    );
  }

  if (decision.partnerId !== template.partnerId) {
    throw new Error("Decision partnerId must match the export template partnerId.");
  }

  const idempotencyKey = createStructuredExportIdempotencyKey(decision, template);
  const existingReference = artifactStore?.getByIdempotencyKey(idempotencyKey);

  if (existingReference) {
    return {
      filename: existingReference.filename,
      content: existingReference.content,
      artifact: cloneArtifact(existingReference.artifact),
      manifest: cloneManifest(existingReference.manifest),
      idempotencyKey,
      traceability: cloneTraceability(existingReference.traceability),
      configValidation,
      formatValidation: validateStructuredExportContent(
        template,
        existingReference.content,
      ),
      manifestValidation: validateTransferPackageManifest(
        existingReference.manifest,
      ),
      reusedExistingArtifact: true,
    };
  }

  const values = template.fields.map((field) =>
    resolveSourceValue(application, decision, field),
  );
  const content =
    template.format === "csv"
      ? renderCsv(template.fields, values)
      : renderXml(template, template.fields, values);
  const checksumSha256 = await sha256Hex(content);
  const filename = `${template.filenameStem}-${sanitizeToken(decision.decisionId)}.${template.format}`;
  const artifact: TransferArtifact = {
    artifactId: `artifact-${sanitizeToken(decision.decisionId)}-${sanitizeToken(template.configId)}-${sanitizeToken(template.configVersion)}-${template.format}`,
    artifactType: template.format,
    filename,
    checksumSha256,
    byteSize: new TextEncoder().encode(content).byteLength,
    generatedAt,
  };
  const traceability: StructuredExportTraceability = {
    configId: template.configId,
    configVersion: template.configVersion,
    overlayId: template.overlayId,
    mappingProfileId: template.mappingProfileId,
    provisioningJobId,
  };
  const manifestMetadata: Record<string, string> = {
    ...(template.metadata ?? {}),
    exportConfigId: traceability.configId,
    exportConfigVersion: traceability.configVersion,
    overlayId: traceability.overlayId,
    mappingProfileId: traceability.mappingProfileId,
  };

  if (traceability.provisioningJobId) {
    manifestMetadata.provisioningJobId = traceability.provisioningJobId;
  }

  const manifest: TransferPackageManifestV1 = {
    ...transferPackageManifestSchemaDefaults,
    manifestId: `manifest-${sanitizeToken(decision.decisionId)}-${sanitizeToken(template.configId)}-${sanitizeToken(template.configVersion)}`,
    applicationId: application.applicationId,
    decisionId: decision.decisionId,
    partnerId: template.partnerId,
    partnerName: template.partnerName,
    generatedAt,
    artifacts: [artifact],
    documents: application.documents.map((document) => ({
      documentId: document.documentId,
      logicalPath: `${template.documentBasePath ?? "documents"}/${document.category}/${document.filename}`,
      filename: document.filename,
      checksumSha256: document.checksumSha256,
      byteSize: document.sizeBytes,
      category: document.category,
    })),
    handoff: {
      ...template.handoff,
      idempotencyKey,
    },
    metadata: manifestMetadata,
  };

  const formatValidation = validateStructuredExportContent(template, content);
  const manifestValidation = validateTransferPackageManifest(manifest);

  artifactStore?.save({
    idempotencyKey,
    decisionId: decision.decisionId,
    applicationId: application.applicationId,
    partnerId: template.partnerId,
    filename,
    content,
    artifact: cloneArtifact(artifact),
    manifest: cloneManifest(manifest),
    traceability: cloneTraceability(traceability),
  });

  return {
    filename,
    content,
    artifact,
    manifest,
    idempotencyKey,
    traceability,
    configValidation,
    formatValidation,
    manifestValidation,
    reusedExistingArtifact: false,
  };
}
