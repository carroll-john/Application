import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalApplicationSnapshotV1,
  transferPackageManifestSnapshotV1,
  validateSchemaCompatibility,
  type SchemaCompatibilityFixture,
  type SchemaCompatibilityResult,
  type SchemaSnapshot,
} from "./schemaCompatibility.ts";

export interface SchemaCompatibilityFixtureResult {
  fixture: SchemaCompatibilityFixture;
  result: SchemaCompatibilityResult;
  matchedExpectation: boolean;
  missingExpectedMessages: string[];
}

const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "schemaCompatibility",
);

function loadSnapshotFixture(fileName: string): SchemaSnapshot {
  return JSON.parse(
    readFileSync(resolve(fixtureDirectory, fileName), "utf8"),
  ) as SchemaSnapshot;
}

const canonicalApplicationFrozenFixture = loadSnapshotFixture(
  "canonical-application-v1.json",
);
const transferPackageManifestFrozenFixture = loadSnapshotFixture(
  "transfer-package-manifest-v1.json",
);

function cloneSnapshot(snapshot: SchemaSnapshot): SchemaSnapshot {
  return {
    ...snapshot,
    fields: snapshot.fields.map((field) => ({ ...field })),
  };
}

function replaceField(
  snapshot: SchemaSnapshot,
  path: string,
  updater: (current: SchemaSnapshot["fields"][number]) => SchemaSnapshot["fields"][number],
): SchemaSnapshot {
  return {
    ...snapshot,
    fields: snapshot.fields.map((field) =>
      field.path === path ? updater(field) : { ...field },
    ),
  };
}

function removeField(snapshot: SchemaSnapshot, path: string): SchemaSnapshot {
  return {
    ...snapshot,
    fields: snapshot.fields
      .filter((field) => field.path !== path)
      .map((field) => ({ ...field })),
  };
}

export const schemaCompatibilityFixtures: SchemaCompatibilityFixture[] = [
  {
    name: "canonical-current-v1-remains-compatible",
    description:
      "The current canonical schema stays backward compatible with the frozen V1 fixture.",
    baseline: canonicalApplicationFrozenFixture,
    candidate: canonicalApplicationSnapshotV1,
    expectedCompatible: true,
  },
  {
    name: "canonical-additive-optional-field",
    description:
      "Adding a new optional field in a minor release remains backward compatible.",
    baseline: canonicalApplicationFrozenFixture,
    candidate: {
      ...cloneSnapshot(canonicalApplicationSnapshotV1),
      version: "1.1.0",
      fields: [
        ...canonicalApplicationSnapshotV1.fields.map((field) => ({ ...field })),
        {
          path: "personalDetails.preferredPronouns",
          type: "string",
          required: false,
        },
      ],
    },
    expectedCompatible: true,
  },
  {
    name: "canonical-optional-field-became-required",
    description:
      "Making an existing optional field required is a breaking change.",
    baseline: canonicalApplicationFrozenFixture,
    candidate: {
      ...replaceField(
        canonicalApplicationSnapshotV1,
        "personalDetails.phone",
        (field) => ({ ...field, required: true }),
      ),
      version: "1.0.1",
    },
    expectedCompatible: false,
    expectedIssueMessages: [
      'Field "personalDetails.phone" became required but was optional in the baseline schema.',
    ],
  },
  {
    name: "manifest-current-v1-remains-compatible",
    description:
      "The current transfer package manifest stays backward compatible with the frozen V1 fixture.",
    baseline: transferPackageManifestFrozenFixture,
    candidate: transferPackageManifestSnapshotV1,
    expectedCompatible: true,
  },
  {
    name: "manifest-removed-idempotency-key",
    description:
      "Removing a previously supported manifest field is a breaking change.",
    baseline: transferPackageManifestFrozenFixture,
    candidate: {
      ...removeField(
        transferPackageManifestSnapshotV1,
        "handoff.idempotencyKey",
      ),
      version: "1.0.1",
    },
    expectedCompatible: false,
    expectedIssueMessages: [
      'Missing previously supported field "handoff.idempotencyKey".',
    ],
  },
  {
    name: "manifest-byte-size-type-changed",
    description:
      "Changing the type of an existing manifest field is a breaking change.",
    baseline: transferPackageManifestFrozenFixture,
    candidate: {
      ...replaceField(
        transferPackageManifestSnapshotV1,
        "artifacts[].byteSize",
        (field) => ({ ...field, type: "string" }),
      ),
      version: "1.0.1",
    },
    expectedCompatible: false,
    expectedIssueMessages: [
      'Field "artifacts[].byteSize" changed type from number to string.',
    ],
  },
  {
    name: "minimum-reader-version-became-stricter",
    description:
      "Raising the minimum reader version without a coordinated major boundary is a breaking change.",
    baseline: canonicalApplicationFrozenFixture,
    candidate: {
      ...cloneSnapshot(canonicalApplicationSnapshotV1),
      version: "1.0.1",
      minimumReaderVersion: "1.1.0",
    },
    expectedCompatible: false,
    expectedIssueMessages: [
      "Candidate minimumReaderVersion 1.1.0 is stricter than baseline 1.0.0.",
    ],
  },
];

export function runSchemaCompatibilityFixtures(): SchemaCompatibilityFixtureResult[] {
  return schemaCompatibilityFixtures.map((fixture) => {
    const result = validateSchemaCompatibility(
      fixture.baseline,
      fixture.candidate,
    );
    const missingExpectedMessages = (fixture.expectedIssueMessages ?? []).filter(
      (message) =>
        !result.issues.some((issue) => issue.message === message),
    );

    return {
      fixture,
      result,
      matchedExpectation:
        result.compatible === fixture.expectedCompatible &&
        missingExpectedMessages.length === 0,
      missingExpectedMessages,
    };
  });
}
