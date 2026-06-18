import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSuggestApp } from "../../../suggest-service/src/server.mjs";
import { handleInstitutionSuggest } from "./proxy.js";

let server;
let baseUrl;

beforeAll(async () => {
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

describe("suggest proxy integration", () => {
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
