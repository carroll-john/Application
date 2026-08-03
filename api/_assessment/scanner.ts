import { AssessmentApiError } from "./server.js";

export async function scanAssessmentDocument(
  fileBuffer: ArrayBuffer,
  mimeType: string,
) {
  const scannerUrl = process.env.ASSESSMENT_MALWARE_SCANNER_URL?.trim();
  const scannerToken = process.env.ASSESSMENT_MALWARE_SCANNER_TOKEN?.trim();
  const isDeployed = ["preview", "production"].includes(
    process.env.VERCEL_ENV?.trim().toLowerCase() ?? "",
  );

  if (!scannerUrl) {
    if (!isDeployed && process.env.ASSESSMENT_ALLOW_LOCAL_SCAN_BYPASS === "true") {
      return { clean: true, provider: "local-bypass", reference: "local-development" };
    }
    throw new AssessmentApiError(
      "ASSESSMENT_SCANNER_NOT_CONFIGURED",
      "Document scanning is unavailable. The file remains quarantined.",
      503,
    );
  }

  let scannerEndpoint: URL;
  try {
    scannerEndpoint = new URL(scannerUrl);
  } catch {
    throw new AssessmentApiError(
      "ASSESSMENT_SCANNER_NOT_CONFIGURED",
      "Document scanning is unavailable. The file remains quarantined.",
      503,
    );
  }
  if (
    scannerEndpoint.protocol !== "https:" ||
    (isDeployed && !scannerToken)
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_SCANNER_NOT_CONFIGURED",
      "Document scanning is unavailable. The file remains quarantined.",
      503,
    );
  }

  const response = await fetch(scannerEndpoint, {
    body: fileBuffer,
    headers: {
      "content-type": mimeType,
      ...(scannerToken ? { authorization: `Bearer ${scannerToken}` } : {}),
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { clean?: boolean; reference?: string }
    | null;

  if (!response.ok || typeof payload?.clean !== "boolean") {
    throw new AssessmentApiError(
      "ASSESSMENT_SCANNER_UNAVAILABLE",
      "Document scanning could not be completed. The file remains quarantined.",
      503,
    );
  }

  return {
    clean: payload.clean,
    provider: scannerEndpoint.hostname,
    reference: payload.reference ?? null,
  };
}
