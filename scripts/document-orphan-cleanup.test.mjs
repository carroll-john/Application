import { describe, expect, it } from "vitest";
import {
  buildCleanupReport,
  classifyDocumentOrphans,
  parseArgs,
} from "./document-orphan-cleanup.mjs";

const documents = [
  {
    application_id: "app-1",
    created_at: "2026-07-01T00:00:00Z",
    file_name: "kept.pdf",
    id: "doc-kept",
    kind: "cv",
    size_bytes: 1000,
    storage_bucket: "application-documents",
    storage_path: "user-1/app-1/cv/doc-kept-kept.pdf",
  },
  {
    application_id: "app-1",
    created_at: "2026-07-01T00:01:00Z",
    file_name: "missing.pdf",
    id: "doc-missing",
    kind: "tertiary_transcript",
    size_bytes: 2000,
    storage_bucket: "application-documents",
    storage_path: "user-1/app-1/tertiary_transcript/doc-missing-missing.pdf",
  },
  {
    application_id: "app-2",
    created_at: "2026-07-01T00:02:00Z",
    file_name: "other.pdf",
    id: "doc-other",
    kind: "cv",
    size_bytes: 3000,
    storage_bucket: "other-bucket",
    storage_path: "user-2/app-2/cv/doc-other-other.pdf",
  },
];

const objects = [
  {
    bucket: "application-documents",
    id: "object-kept",
    name: "user-1/app-1/cv/doc-kept-kept.pdf",
    size: 1000,
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    bucket: "application-documents",
    id: "object-orphan",
    name: "user-1/app-1/cv/object-orphan-extra.pdf",
    size: 4000,
    updatedAt: "2026-07-01T00:03:00Z",
  },
  {
    bucket: "application-documents",
    id: "object-out-of-prefix",
    name: "user-2/app-2/cv/object-out-of-prefix.pdf",
    size: 5000,
    updatedAt: "2026-07-01T00:04:00Z",
  },
];

describe("document orphan cleanup helpers", () => {
  it("parses dry-run defaults and explicit execute options", () => {
    expect(parseArgs([])).toMatchObject({
      bucket: "application-documents",
      execute: false,
      pageSize: 1000,
      prefix: "",
      sampleSize: 25,
    });
    expect(
      parseArgs([
        "--execute",
        "--bucket",
        "custom-bucket",
        "--prefix=user-1/app-1",
        "--page-size",
        "10",
        "--sample-size=2",
      ]),
    ).toMatchObject({
      bucket: "custom-bucket",
      execute: true,
      pageSize: 10,
      prefix: "user-1/app-1",
      sampleSize: 2,
    });
  });

  it("classifies metadata rows and storage objects that are missing their counterpart", () => {
    const classification = classifyDocumentOrphans({
      bucket: "application-documents",
      documents,
      objects,
    });

    expect(classification.scanned).toEqual({ documents: 2, objects: 3 });
    expect(classification.metadataWithoutStorage.map((row) => row.id)).toEqual([
      "doc-missing",
    ]);
    expect(classification.storageWithoutMetadata.map((object) => object.name)).toEqual([
      "user-1/app-1/cv/object-orphan-extra.pdf",
      "user-2/app-2/cv/object-out-of-prefix.pdf",
    ]);
  });

  it("limits classification to an optional storage prefix", () => {
    const classification = classifyDocumentOrphans({
      bucket: "application-documents",
      documents,
      objects,
      prefix: "user-1/app-1",
    });

    expect(classification.scanned).toEqual({ documents: 2, objects: 2 });
    expect(classification.metadataWithoutStorage.map((row) => row.id)).toEqual([
      "doc-missing",
    ]);
    expect(classification.storageWithoutMetadata.map((object) => object.name)).toEqual([
      "user-1/app-1/cv/object-orphan-extra.pdf",
    ]);
  });

  it("builds a bounded dry-run report", () => {
    const classification = classifyDocumentOrphans({
      bucket: "application-documents",
      documents,
      objects,
    });
    const report = buildCleanupReport(classification, {
      bucket: "application-documents",
      execute: false,
      prefix: "",
      sampleSize: 1,
    });

    expect(report).toMatchObject({
      bucket: "application-documents",
      dryRun: true,
      prefix: null,
      scanned: { documents: 2, objects: 3 },
      summary: {
        metadataWithoutStorage: 1,
        storageWithoutMetadata: 2,
      },
    });
    expect(report.samples.metadataWithoutStorage).toHaveLength(1);
    expect(report.samples.storageWithoutMetadata).toHaveLength(1);
  });
});
