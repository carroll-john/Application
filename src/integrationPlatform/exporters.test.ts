import { describe, expect, it } from "vitest";
import {
  canonicalApplicationSamples,
  universityExportMappingConfigSamples,
} from "./examples";
import type { DecisionRecordV1 } from "./provisioning";
import { decisionRecordSchemaDefaults } from "./provisioning";
import {
  InMemoryStructuredExportArtifactStore,
  generateStructuredExport,
  validateUniversityExportMappingConfig,
  type UniversityExportTemplate,
  universityExportMappingConfigSchemaDefaults,
} from "./exporters";

function createDecisionRecord(overrides: Partial<DecisionRecordV1> = {}): DecisionRecordV1 {
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: "decision-100",
    applicationId: canonicalApplicationSamples[0].applicationId,
    applicantId: canonicalApplicationSamples[0].applicantId,
    partnerId: "SCU",
    partnerName: "Southern Coast University",
    decidedAt: "2026-03-10T13:00:00Z",
    decidedBy: "admissions.analyst@keypath.com",
    correlationId: "corr-export-100",
    outcome: {
      status: "offer-made",
    },
    ...overrides,
  };
}

describe("generateStructuredExport", () => {
  it("validates pilot export mapping configs and rejects incomplete definitions", () => {
    for (const config of universityExportMappingConfigSamples) {
      expect(validateUniversityExportMappingConfig(config)).toEqual({
        valid: true,
        errors: [],
      });
    }

    const invalidConfig: UniversityExportTemplate = {
      ...universityExportMappingConfigSchemaDefaults,
      configId: "invalid-config",
      configVersion: "1.0.0",
      partnerId: "TIU",
      partnerName: "Tasman Institute of Technology",
      overlayId: "",
      mappingProfileId: "tasman-import-v1",
      format: "xml",
      filenameStem: "tasman-invalid",
      rootElementName: "ImportPackage",
      rowElementName: "ApplicationRecord",
      fields: [
        {
          sourcePath: "personalDetails.email",
          outputKey: "Applicant Email",
          required: true,
        },
        {
          sourcePath: "selectedCourse.courseCode",
          outputKey: "Applicant Email",
          required: true,
        },
      ],
      handoff: {
        handoffMode: "manual-import",
        destinationRef: "",
        encryptionProfile: "none",
      },
    };

    expect(validateUniversityExportMappingConfig(invalidConfig)).toEqual({
      valid: false,
      errors: [
        "overlayId is required.",
        "handoff.destinationRef is required.",
        "fields[0].outputKey must be a valid XML element name.",
        "fields[1].outputKey must be unique within a config.",
        "fields[1].outputKey must be a valid XML element name.",
      ],
    });
  });

  it("generates repeatable CSV exports with deterministic manifests and traceable metadata", async () => {
    const template = universityExportMappingConfigSamples[0];

    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      template,
      generatedAt: "2026-03-10T13:00:00Z",
      provisioningJobId: "prov-decision-100-scu-file",
    };

    const first = await generateStructuredExport(input);
    const second = await generateStructuredExport(input);

    expect(first.content).toBe(second.content);
    expect(first.artifact.checksumSha256).toBe(second.artifact.checksumSha256);
    expect(first.manifest).toEqual(second.manifest);
    expect(first.idempotencyKey).toBe(
      "decision-100:SCU:southern-coast-csv-v1:1.0.0",
    );
    expect(first.manifest.metadata).toEqual({
      deliveryProfile: "southern-coast-standard",
      exportConfigId: "southern-coast-csv-v1",
      exportConfigVersion: "1.0.0",
      overlayId: "overlay-001",
      mappingProfileId: "southern-coast-online-v1",
      provisioningJobId: "prov-decision-100-scu-file",
    });
    expect(first.configValidation.valid).toBe(true);
    expect(first.formatValidation.valid).toBe(true);
    expect(first.manifestValidation.valid).toBe(true);
    expect(first.reusedExistingArtifact).toBe(false);
    expect(first.content).toContain("ApplicantFirstName,ApplicantLastName,CourseCode,DecisionStatus");
  });

  it("generates XML exports for import workflows and includes document references", async () => {
    const template = universityExportMappingConfigSamples[1];

    const result = await generateStructuredExport({
      application: canonicalApplicationSamples[1],
      decision: createDecisionRecord({
        decisionId: "decision-200",
        applicationId: canonicalApplicationSamples[1].applicationId,
        applicantId: canonicalApplicationSamples[1].applicantId,
        partnerId: "TIU",
        partnerName: "Tasman Institute of Technology",
        correlationId: "corr-export-200",
      }),
      template,
      generatedAt: "2026-03-10T13:10:00Z",
    });

    expect(result.content).toContain("<ImportPackage>");
    expect(result.content).toContain("<ApplicationRecord>");
    expect(result.content).toContain("<IELTSScore>7.5</IELTSScore>");
    expect(result.formatValidation.valid).toBe(true);
    expect(result.manifestValidation.valid).toBe(true);
    expect(result.manifest.documents[0].logicalPath).toBe(
      "attachments/transcript/analytics-transcript.pdf",
    );
  });

  it("uses template defaults for missing optional values while keeping the export valid", async () => {
    const template = universityExportMappingConfigSamples[2];

    const result = await generateStructuredExport({
      application: canonicalApplicationSamples[2],
      decision: createDecisionRecord({
        decisionId: "decision-300",
        applicationId: canonicalApplicationSamples[2].applicationId,
        applicantId: canonicalApplicationSamples[2].applicantId,
        partnerId: "HHI",
        partnerName: "Harbour Health Institute",
        correlationId: "corr-export-300",
      }),
      template,
      generatedAt: "2026-03-10T13:20:00Z",
    });

    expect(result.content).toContain("NOT_PROVIDED");
    expect(result.formatValidation.valid).toBe(true);
    expect(result.manifestValidation.valid).toBe(true);
  });

  it("reuses existing artifact references by idempotency key on retry", async () => {
    const artifactStore = new InMemoryStructuredExportArtifactStore();
    const template = universityExportMappingConfigSamples[0];

    const first = await generateStructuredExport({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      template,
      generatedAt: "2026-03-10T13:00:00Z",
      provisioningJobId: "prov-decision-100-scu-file",
      artifactStore,
    });
    const second = await generateStructuredExport({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      template,
      generatedAt: "2026-03-10T13:45:00Z",
      provisioningJobId: "prov-decision-100-scu-file",
      artifactStore,
    });

    expect(second.reusedExistingArtifact).toBe(true);
    expect(second.filename).toBe(first.filename);
    expect(second.content).toBe(first.content);
    expect(second.artifact).toEqual(first.artifact);
    expect(second.manifest).toEqual(first.manifest);
    expect(second.manifest.generatedAt).toBe("2026-03-10T13:00:00Z");
    expect(
      artifactStore.getByIdempotencyKey(first.idempotencyKey)?.traceability,
    ).toEqual({
      configId: "southern-coast-csv-v1",
      configVersion: "1.0.0",
      overlayId: "overlay-001",
      mappingProfileId: "southern-coast-online-v1",
      provisioningJobId: "prov-decision-100-scu-file",
    });
  });

  it("rejects templates that do not match the decision partner", async () => {
    const template: UniversityExportTemplate = {
      ...universityExportMappingConfigSchemaDefaults,
      configId: "mismatch-template",
      configVersion: "1.0.0",
      partnerId: "SCU",
      partnerName: "Southern Coast University",
      overlayId: "overlay-001",
      mappingProfileId: "southern-coast-online-v1",
      format: "csv",
      filenameStem: "invalid",
      fields: [
        {
          sourcePath: "personalDetails.firstName",
          outputKey: "ApplicantFirstName",
          required: true,
        },
      ],
      handoff: {
        handoffMode: "sftp",
        destinationRef: "sftp://scu.example.edu/imports",
        encryptionProfile: "zip-aes256",
      },
    };

    await expect(
      generateStructuredExport({
        application: canonicalApplicationSamples[1],
        decision: createDecisionRecord({
          applicationId: canonicalApplicationSamples[1].applicationId,
          applicantId: canonicalApplicationSamples[1].applicantId,
          partnerId: "TIU",
          partnerName: "Tasman Institute of Technology",
        }),
        template,
        generatedAt: "2026-03-10T13:30:00Z",
      }),
    ).rejects.toThrow("Decision partnerId must match the export template partnerId.");
  });

  it("rejects invalid mapping configs with actionable diagnostics", async () => {
    const invalidTemplate: UniversityExportTemplate = {
      ...universityExportMappingConfigSchemaDefaults,
      configId: "broken-template",
      configVersion: "1.0.0",
      partnerId: "SCU",
      partnerName: "Southern Coast University",
      overlayId: "",
      mappingProfileId: "southern-coast-online-v1",
      format: "csv",
      filenameStem: "broken",
      fields: [],
      handoff: {
        handoffMode: "sftp",
        destinationRef: "",
        encryptionProfile: "zip-aes256",
      },
    };

    await expect(
      generateStructuredExport({
        application: canonicalApplicationSamples[0],
        decision: createDecisionRecord(),
        template: invalidTemplate,
        generatedAt: "2026-03-10T13:35:00Z",
      }),
    ).rejects.toThrow(
      "Invalid export mapping config. overlayId is required. At least one export field mapping is required. handoff.destinationRef is required.",
    );
  });
});
