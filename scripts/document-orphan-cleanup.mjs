#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const DEFAULT_BUCKET = "application-documents";
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_SAMPLE_SIZE = 25;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const ROW_DELETE_CHUNK_SIZE = 100;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizePrefix(value) {
  return (value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function readOption(argv, name) {
  const exactIndex = argv.indexOf(name);
  if (exactIndex >= 0) {
    return argv[exactIndex + 1];
  }

  const prefix = `${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseArgs(argv) {
  return {
    bucket: readOption(argv, "--bucket")?.trim() || DEFAULT_BUCKET,
    execute: argv.includes("--execute"),
    help: argv.includes("--help") || argv.includes("-h"),
    pageSize: parsePositiveInteger(readOption(argv, "--page-size"), DEFAULT_PAGE_SIZE),
    prefix: normalizePrefix(readOption(argv, "--prefix")),
    sampleSize: parsePositiveInteger(readOption(argv, "--sample-size"), DEFAULT_SAMPLE_SIZE),
  };
}

function printHelp() {
  console.log(`Usage: npm run documents:cleanup -- [options]

Dry-runs by default. Add --execute to delete orphaned records/objects.

Options:
  --execute              Delete the orphaned rows/objects found by the scan.
  --bucket <name>        Storage bucket to scan. Default: ${DEFAULT_BUCKET}
  --prefix <path>        Optional storage path prefix to limit the scan.
  --page-size <number>   Pagination size for Supabase reads. Default: ${DEFAULT_PAGE_SIZE}
  --sample-size <number> Number of sample rows/objects to print. Default: ${DEFAULT_SAMPLE_SIZE}
`);
}

function readRequiredEnv() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ""
  ).trim();

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or VITE_SUPABASE_URL is required.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required so cleanup can bypass applicant RLS safely.",
    );
  }

  return {
    serviceRoleKey,
    supabaseUrl: trimTrailingSlash(supabaseUrl),
  };
}

function createAdminClient() {
  const { serviceRoleKey, supabaseUrl } = readRequiredEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function fetchAllApplicationDocuments(client, { pageSize, prefix }) {
  const rows = [];
  let offset = 0;

  while (true) {
    const upper = offset + pageSize - 1;
    let query = client
      .from("application_documents")
      .select(
        "id, application_id, kind, storage_bucket, storage_path, file_name, size_bytes, created_at",
      )
      .order("created_at", { ascending: true })
      .range(offset, upper);

    if (prefix) {
      query = query.like("storage_path", `${prefix}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function isStorageFolder(item) {
  return (
    item &&
    typeof item === "object" &&
    (item.id === null || item.id === undefined) &&
    item.metadata === null
  );
}

async function listStorageObjects(client, { bucket, pageSize, prefix }) {
  const objects = [];

  async function walk(path) {
    let offset = 0;

    while (true) {
      const { data, error } = await client.storage.from(bucket).list(path, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        throw error;
      }

      const entries = data ?? [];

      for (const entry of entries) {
        const fullPath = path ? `${path}/${entry.name}` : entry.name;

        if (isStorageFolder(entry)) {
          await walk(fullPath);
          continue;
        }

        objects.push({
          bucket,
          createdAt: entry.created_at ?? null,
          id: entry.id ?? null,
          name: fullPath,
          size: typeof entry.metadata?.size === "number" ? entry.metadata.size : null,
          updatedAt: entry.updated_at ?? null,
        });
      }

      if (entries.length < pageSize) {
        break;
      }

      offset += pageSize;
    }
  }

  await walk(prefix);
  return objects;
}

function pathKey(bucket, path) {
  return `${bucket}/${path}`;
}

function compactDocument(row) {
  return {
    applicationId: row.application_id,
    bucket: row.storage_bucket,
    createdAt: row.created_at,
    fileName: row.file_name,
    id: row.id,
    kind: row.kind,
    path: row.storage_path,
    sizeBytes: row.size_bytes,
  };
}

function compactObject(object) {
  return {
    bucket: object.bucket,
    id: object.id,
    path: object.name,
    sizeBytes: object.size,
    updatedAt: object.updatedAt,
  };
}

export function classifyDocumentOrphans({ documents, objects, bucket, prefix = "" }) {
  const normalizedPrefix = normalizePrefix(prefix);
  const inScopeDocument = (document) =>
    document.storage_bucket === bucket &&
    (!normalizedPrefix || document.storage_path.startsWith(normalizedPrefix));
  const inScopeObject = (object) =>
    object.bucket === bucket &&
    (!normalizedPrefix || object.name.startsWith(normalizedPrefix));

  const scopedDocuments = documents.filter(inScopeDocument);
  const scopedObjects = objects.filter(inScopeObject);
  const objectPaths = new Set(
    scopedObjects.map((object) => pathKey(object.bucket, object.name)),
  );
  const documentPaths = new Set(
    scopedDocuments.map((document) =>
      pathKey(document.storage_bucket, document.storage_path),
    ),
  );

  return {
    metadataWithoutStorage: scopedDocuments.filter(
      (document) => !objectPaths.has(pathKey(document.storage_bucket, document.storage_path)),
    ),
    scanned: {
      documents: scopedDocuments.length,
      objects: scopedObjects.length,
    },
    storageWithoutMetadata: scopedObjects.filter(
      (object) => !documentPaths.has(pathKey(object.bucket, object.name)),
    ),
  };
}

function sample(values, sampleSize, mapper) {
  return values.slice(0, sampleSize).map(mapper);
}

export function buildCleanupReport(classification, { bucket, execute, prefix, sampleSize }) {
  return {
    bucket,
    dryRun: !execute,
    prefix: prefix || null,
    samples: {
      metadataWithoutStorage: sample(
        classification.metadataWithoutStorage,
        sampleSize,
        compactDocument,
      ),
      storageWithoutMetadata: sample(
        classification.storageWithoutMetadata,
        sampleSize,
        compactObject,
      ),
    },
    scanned: classification.scanned,
    summary: {
      metadataWithoutStorage: classification.metadataWithoutStorage.length,
      storageWithoutMetadata: classification.storageWithoutMetadata.length,
    },
  };
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function deleteStorageObjects(client, storageWithoutMetadata) {
  const deleted = [];
  const byBucket = new Map();

  for (const object of storageWithoutMetadata) {
    const bucketObjects = byBucket.get(object.bucket) ?? [];
    bucketObjects.push(object.name);
    byBucket.set(object.bucket, bucketObjects);
  }

  for (const [bucket, paths] of byBucket.entries()) {
    for (const pathChunk of chunk(paths, STORAGE_REMOVE_CHUNK_SIZE)) {
      const { error } = await client.storage.from(bucket).remove(pathChunk);

      if (error) {
        throw error;
      }

      deleted.push(...pathChunk.map((path) => ({ bucket, path })));
    }
  }

  return deleted;
}

async function deleteMetadataRows(client, metadataWithoutStorage) {
  const ids = metadataWithoutStorage.map((document) => document.id);
  const deleted = [];

  for (const idChunk of chunk(ids, ROW_DELETE_CHUNK_SIZE)) {
    const { error } = await client
      .from("application_documents")
      .delete()
      .in("id", idChunk);

    if (error) {
      throw error;
    }

    deleted.push(...idChunk);
  }

  return deleted;
}

async function run(options) {
  const client = createAdminClient();
  const [documents, objects] = await Promise.all([
    fetchAllApplicationDocuments(client, options),
    listStorageObjects(client, options),
  ]);
  const classification = classifyDocumentOrphans({
    bucket: options.bucket,
    documents,
    objects,
    prefix: options.prefix,
  });
  const report = buildCleanupReport(classification, options);

  if (options.execute) {
    report.deleted = {
      metadataRows: await deleteMetadataRows(client, classification.metadataWithoutStorage),
      storageObjects: await deleteStorageObjects(client, classification.storageWithoutMetadata),
    };
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const report = await run(options);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
