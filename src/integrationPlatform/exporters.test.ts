import { describe, expect, it } from "vitest";
import { canonicalApplicationSamples } from "./examples";
import type { DecisionRecordV1 } from "./provisioning";
import { decisionRecordSchemaDefaults } from "./provisioning";
import {
  generateStructuredExport,
  type UniversityExportTemplate,
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
  it("generates repeatable CSV exports with deterministic manifests", async () => {
    const template: UniversityExportTemplate = {
      templateId: "southern-coast-csv-v1",
      partnerId: "SCU",
      partnerName: "Southern Coast University",
      format: "csv",
      filenameStem: "southern-coast-application",
      fields: [
        {
          sourcePath: "personalDetails.firstName",
          outputKey: "ApplicantFirstName",
          required: true,
        },
        {
          sourcePath: "personalDetails.lastName",
          outputKey: "ApplicantLastName",
          required: true,
        },
        {
          sourcePath: "selectedCourse.courseCode",
          outputKey: "CourseCode",
          required: true,
          transform: "uppercase",
        },
        {
          sourcePath: "decision.outcome.status",
          outputKey: "DecisionStatus",
          required: true,
        },
      ],
      handoff: {
        handoffMode: "sftp",
        destinationRef: "sftp://scu.example.edu/imports",
        encryptionProfile: "zip-aes256",
      },
    };

    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      template,
      generatedAt: "2026-03-10T13:00:00Z",
    };

    const first = await generateStructuredExport(input);
    const second = await generateStructuredExport(input);

    expect(first.content).toBe(second.content);
    expect(first.artifact.checksumSha256).toBe(second.artifact.checksumSha256);
    expect(first.manifest).toEqual(second.manifest);
    expect(first.formatValidation.valid).toBe(true);
    expect(first.manifestValidation.valid).toBe(true);
    expect(first.content).toContain("ApplicantFirstName,ApplicantLastName,CourseCode,DecisionStatus");
  });

  it("generates XML exports for import workflows and includes document references", async () => {
    const template: UniversityExportTemplate = {
      templateId: "tasman-import-xml-v1",
      partnerId: "TIU",
      partnerName: "Tasman Institute of Technology",
      format: "xml",
      filenameStem: "tasman-import-package",
      rootElementName: "ImportPackage",
      rowElementName: "ApplicationRecord",
      documentBasePath: "attachments",
      fields: [
        {
          sourcePath: "personalDetails.email",
          outputKey: "ApplicantEmail",
          required: true,
          transform: "lowercase",
        },
        {
          sourcePath: "selectedCourse.courseCode",
          outputKey: "CourseCode",
          required: true,
        },
        {
          sourcePath: "languageTests[0].overallScore",
          outputKey: "IELTSScore",
          required: true,
        },
      ],
      handoff: {
        handoffMode: "manual-import",
        destinationRef: "tasman-import-template-v3",
        encryptionProfile: "none",
      },
    };

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
    const template: UniversityExportTemplate = {
      templateId: "harbour-health-csv-v1",
      partnerId: "HHI",
      partnerName: "Harbour Health Institute",
      format: "csv",
      filenameStem: "harbour-health-nursing",
      fields: [
        {
          sourcePath: "personalDetails.middleName",
          outputKey: "MiddleName",
          required: true,
          defaultValue: "NOT_PROVIDED",
        },
        {
          sourcePath: "postalAddress.formattedAddress",
          outputKey: "PostalAddress",
          required: true,
        },
        {
          sourcePath: "decision.outcome.status",
          outputKey: "DecisionStatus",
          required: true,
        },
      ],
      handoff: {
        handoffMode: "portal-upload",
        destinationRef: "harbour-health-admissions-portal",
        encryptionProfile: "pgp",
      },
    };

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

  it("rejects templates that do not match the decision partner", async () => {
    const template: UniversityExportTemplate = {
      templateId: "mismatch-template",
      partnerId: "SCU",
      partnerName: "Southern Coast University",
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
});
