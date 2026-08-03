import { afterEach, describe, expect, it, vi } from "vitest";
import { AssessmentApiError } from "./server.js";
import { scanAssessmentDocument } from "./scanner.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("assessment malware scanner", () => {
  it("allows the explicit local-only bypass", async () => {
    delete process.env.VERCEL_ENV;
    delete process.env.ASSESSMENT_MALWARE_SCANNER_URL;
    process.env.ASSESSMENT_ALLOW_LOCAL_SCAN_BYPASS = "true";

    await expect(
      scanAssessmentDocument(new ArrayBuffer(1), "application/pdf"),
    ).resolves.toMatchObject({ clean: true, provider: "local-bypass" });
  });

  it("fails closed in a deployed environment without an authenticated HTTPS scanner", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ASSESSMENT_MALWARE_SCANNER_URL = "http://scanner.internal/scan";
    delete process.env.ASSESSMENT_MALWARE_SCANNER_TOKEN;

    await expect(
      scanAssessmentDocument(new ArrayBuffer(1), "application/pdf"),
    ).rejects.toMatchObject<Partial<AssessmentApiError>>({
      code: "ASSESSMENT_SCANNER_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("uses the authenticated scanner response", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ASSESSMENT_MALWARE_SCANNER_URL = "https://scanner.example/scan";
    process.env.ASSESSMENT_MALWARE_SCANNER_TOKEN = "scanner-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ clean: true, reference: "scan-123" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      scanAssessmentDocument(new ArrayBuffer(1), "application/pdf"),
    ).resolves.toEqual({
      clean: true,
      provider: "scanner.example",
      reference: "scan-123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://scanner.example/scan"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer scanner-secret" }),
      }),
    );
  });
});
