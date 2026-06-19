import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleInstitutionSuggest } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The suggest-service lives in a sibling repo that is only present in
// full-monorepo / local checkouts. When it is absent (e.g. CI checks out only
// this repo) skip the integration test instead of failing the suite at import.
const serverModulePath = path.resolve(
  __dirname,
  "../../../suggest-service/src/server.mjs",
);
const hasSuggestService = existsSync(serverModulePath);

let server;
let baseUrl;

describe.skipIf(!hasSuggestService)("suggest proxy integration", () => {
  beforeAll(async () => {
    const { createSuggestApp } = await import(
      pathToFileURL(serverModulePath).href
    );
    const app = createSuggestApp();
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  });

  it("forwards institution suggest to the configured service", async () => {
    const previousUrl = process.env.SUGGEST_SERVICE_URL;
    process.env.SUGGEST_SERVICE_URL = baseUrl;

    try {
      const response = await handleInstitutionSuggest(
        new Request("http://localhost/api/suggest/institutions?q=monash"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.suggestions?.[0]?.value).toBe("Monash University");
    } finally {
      process.env.SUGGEST_SERVICE_URL = previousUrl;
    }
  });
});
