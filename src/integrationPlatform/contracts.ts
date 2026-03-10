export const CANONICAL_APPLICATION_SCHEMA_VERSION = "1.0.0";
export const TRANSFER_PACKAGE_MANIFEST_SCHEMA_VERSION = "1.0.0";
export const UNIVERSITY_MAPPING_OVERLAY_SCHEMA_VERSION = "1.0.0";

export type SchemaVersion = `${number}.${number}.${number}`;

export interface SchemaContractVersion {
  currentVersion: SchemaVersion;
  minimumReaderVersion: SchemaVersion;
  policy: string;
}

interface ParsedSchemaVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseSchemaVersion(version: SchemaVersion): ParsedSchemaVersion {
  const [major, minor, patch] = version.split(".").map(Number);

  return {
    major,
    minor,
    patch,
  };
}

export function isBackwardCompatibleVersion(
  currentVersion: SchemaVersion,
  candidateVersion: SchemaVersion,
): boolean {
  const current = parseSchemaVersion(currentVersion);
  const candidate = parseSchemaVersion(candidateVersion);

  if (current.major !== candidate.major) {
    return false;
  }

  if (candidate.minor > current.minor) {
    return false;
  }

  if (candidate.minor === current.minor && candidate.patch > current.patch) {
    return false;
  }

  return true;
}

export const canonicalApplicationVersion: SchemaContractVersion = {
  currentVersion: CANONICAL_APPLICATION_SCHEMA_VERSION,
  minimumReaderVersion: "1.0.0",
  policy:
    "Minor and patch updates must remain additive. Major version changes may remove or reinterpret fields.",
};

export const transferPackageManifestVersion: SchemaContractVersion = {
  currentVersion: TRANSFER_PACKAGE_MANIFEST_SCHEMA_VERSION,
  minimumReaderVersion: "1.0.0",
  policy:
    "Manifest readers must ignore unknown metadata fields and preserve deterministic checksum semantics across patch releases.",
};

export const universityMappingOverlayVersion: SchemaContractVersion = {
  currentVersion: UNIVERSITY_MAPPING_OVERLAY_SCHEMA_VERSION,
  minimumReaderVersion: "1.0.0",
  policy:
    "Mapping overlays may add new transforms or destinations in minor releases but cannot redefine existing canonical paths without a major version bump.",
};

export type CanonicalApplicationStatus =
  | "draft"
  | "submitted"
  | "assessed"
  | "decisioned";

export type QualificationLevel =
  | "secondary"
  | "certificate"
  | "diploma"
  | "bachelor"
  | "graduate-certificate"
  | "graduate-diploma"
  | "masters"
  | "doctorate";

export interface CanonicalContactAddress {
  formattedAddress: string;
  streetAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country: string;
}

export interface CanonicalDocumentReference {
  documentId: string;
  category:
    | "transcript"
    | "certificate"
    | "cv"
    | "language-test"
    | "supporting"
    | "identity";
  filename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  sourceUri: string;
  uploadedAt: string;
  requiredForSubmission?: boolean;
}

export interface CanonicalPersonalDetails {
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  email: string;
  phone?: string;
  citizenshipStatus?: string;
}

export interface CanonicalCourseSelection {
  courseCode: string;
  courseTitle: string;
  providerCode: string;
  providerName: string;
  intakeCode: string;
  intakeLabel: string;
  studyMode?: "online" | "on-campus" | "blended";
}

export interface CanonicalQualification {
  qualificationId: string;
  level: QualificationLevel;
  institutionName: string;
  country: string;
  courseName: string;
  startDate?: string;
  endDate?: string;
  completed: boolean;
  gradingScheme?: string;
  gradeAverage?: string;
  documentIds: string[];
}

export interface CanonicalEmploymentExperience {
  experienceId: string;
  employerName: string;
  title: string;
  employmentType?: "full-time" | "part-time" | "casual" | "contract";
  startDate?: string;
  endDate?: string;
  currentRole: boolean;
  dutiesSummary?: string;
}

export interface CanonicalLanguageTest {
  testId: string;
  provider: string;
  testName: string;
  completedAt?: string;
  overallScore?: string;
  documentIds: string[];
}

export interface CanonicalApplicationV1 {
  schema: "CanonicalApplicationV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  applicationId: string;
  applicantId: string;
  sourceSystem: "application-prototype";
  submittedAt?: string;
  status: CanonicalApplicationStatus;
  personalDetails: CanonicalPersonalDetails;
  residentialAddress?: CanonicalContactAddress;
  postalAddress?: CanonicalContactAddress;
  selectedCourse: CanonicalCourseSelection;
  qualifications: CanonicalQualification[];
  employmentHistory: CanonicalEmploymentExperience[];
  languageTests: CanonicalLanguageTest[];
  documents: CanonicalDocumentReference[];
  metadata?: Record<string, string>;
}

export const canonicalApplicationSchemaDefaults: Pick<
  CanonicalApplicationV1,
  "schema" | "schemaVersion" | "compatibilityVersion" | "sourceSystem"
> = {
  schema: "CanonicalApplicationV1" as const,
  schemaVersion: CANONICAL_APPLICATION_SCHEMA_VERSION,
  compatibilityVersion: CANONICAL_APPLICATION_SCHEMA_VERSION,
  sourceSystem: "application-prototype" as const,
};

export interface TransferArtifact {
  artifactId: string;
  artifactType: "csv" | "xml" | "json" | "pdf" | "zip";
  filename: string;
  checksumSha256: string;
  byteSize: number;
  generatedAt: string;
}

export interface ManifestDocumentEntry {
  documentId: string;
  logicalPath: string;
  filename: string;
  checksumSha256: string;
  byteSize: number;
  category: string;
}

export interface SecureHandoffDescriptor {
  handoffMode: "sftp" | "portal-upload" | "api-ingest" | "manual-import";
  destinationRef: string;
  encryptionProfile: "none" | "pgp" | "zip-aes256";
  idempotencyKey: string;
}

export interface TransferPackageManifestV1 {
  schema: "TransferPackageManifestV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  manifestId: string;
  applicationId: string;
  decisionId: string;
  partnerId: string;
  partnerName: string;
  generatedAt: string;
  artifacts: TransferArtifact[];
  documents: ManifestDocumentEntry[];
  handoff: SecureHandoffDescriptor;
  metadata?: Record<string, string>;
}

export const transferPackageManifestSchemaDefaults: Pick<
  TransferPackageManifestV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "TransferPackageManifestV1" as const,
  schemaVersion: TRANSFER_PACKAGE_MANIFEST_SCHEMA_VERSION,
  compatibilityVersion: TRANSFER_PACKAGE_MANIFEST_SCHEMA_VERSION,
};

export type MappingTransform =
  | "identity"
  | "uppercase"
  | "lowercase"
  | "date-iso"
  | "boolean-yes-no"
  | "join-lines";

export interface MappingRule {
  canonicalPath: string;
  destinationPath: string;
  required: boolean;
  transform: MappingTransform;
  defaultValue?: string;
}

export interface UniversityCapabilityProfile {
  transportMode: "api" | "file" | "import-workflow" | "portal-rpa" | "edge";
  acceptsDocumentsInline: boolean;
  manifestFormat: "json" | "xml";
  duplicateCheckStrategy: "source-application-id" | "email-and-course";
}

export interface UniversityMappingOverlayV1 {
  schema: "UniversityMappingOverlayV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  overlayId: string;
  partnerId: string;
  partnerName: string;
  mappingProfileId: string;
  activeFrom: string;
  capabilityProfile: UniversityCapabilityProfile;
  fieldMappings: MappingRule[];
  metadata?: Record<string, string>;
}

export const universityMappingOverlaySchemaDefaults: Pick<
  UniversityMappingOverlayV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "UniversityMappingOverlayV1" as const,
  schemaVersion: UNIVERSITY_MAPPING_OVERLAY_SCHEMA_VERSION,
  compatibilityVersion: UNIVERSITY_MAPPING_OVERLAY_SCHEMA_VERSION,
};
