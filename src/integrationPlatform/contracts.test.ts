import { describe, expect, it } from "vitest";
import {
  isBackwardCompatibleVersion,
} from "./contracts";
import {
  canonicalApplicationSamples,
  transferPackageManifestSamples,
  universityMappingOverlaySamples,
} from "./examples";
import {
  validateCanonicalApplication,
  validateTransferPackageManifest,
  validateUniversityMappingOverlay,
} from "./validation";

describe("integration platform contract baseline", () => {
  it("accepts all canonical application samples", () => {
    for (const sample of canonicalApplicationSamples) {
      expect(validateCanonicalApplication(sample)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("accepts all transfer package manifest samples", () => {
    for (const sample of transferPackageManifestSamples) {
      expect(validateTransferPackageManifest(sample)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("accepts all mapping overlay samples", () => {
    for (const sample of universityMappingOverlaySamples) {
      expect(validateUniversityMappingOverlay(sample)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("rejects duplicate overlay destination paths", () => {
    const sample = {
      ...universityMappingOverlaySamples[0],
      fieldMappings: [
        universityMappingOverlaySamples[0].fieldMappings[0],
        {
          ...universityMappingOverlaySamples[0].fieldMappings[1],
          destinationPath:
            universityMappingOverlaySamples[0].fieldMappings[0].destinationPath,
        },
      ],
    };

    expect(validateUniversityMappingOverlay(sample)).toEqual({
      valid: false,
      errors: [
        "fieldMappings[1].destinationPath must be unique within an overlay.",
      ],
    });
  });

  it("rejects qualification document references that are missing from the application", () => {
    const sample = {
      ...canonicalApplicationSamples[0],
      qualifications: [
        {
          ...canonicalApplicationSamples[0].qualifications[0],
          documentIds: ["missing-doc"],
        },
      ],
    };

    expect(validateCanonicalApplication(sample)).toEqual({
      valid: false,
      errors: ["qualifications[0] references missing documentId missing-doc."],
    });
  });

  it("treats patch-level versions as backward compatible but blocks major changes", () => {
    expect(isBackwardCompatibleVersion("1.2.3", "1.2.2")).toBe(true);
    expect(isBackwardCompatibleVersion("1.2.3", "1.1.9")).toBe(true);
    expect(isBackwardCompatibleVersion("1.2.3", "2.0.0")).toBe(false);
  });
});
