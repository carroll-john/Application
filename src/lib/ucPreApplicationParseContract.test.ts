import { describe, expect, it } from "vitest";
import {
  addUcPreApplicationParseFlow,
  isUcPreApplicationParseRequest,
} from "./ucPreApplicationParseContract";

describe("UC pre-application parser contract", () => {
  it("adds the public assessment flow without replacing existing query values", () => {
    expect(addUcPreApplicationParseFlow("/api/parse-cv")).toBe(
      "/api/parse-cv?flow=uc-pre-application",
    );
    expect(addUcPreApplicationParseFlow("/api/parse-cv?source=demo")).toBe(
      "/api/parse-cv?source=demo&flow=uc-pre-application",
    );
  });

  it("recognises only the explicit UC pre-application flow", () => {
    expect(
      isUcPreApplicationParseRequest(
        new Request("https://example.test/api/parse-cv?flow=uc-pre-application"),
      ),
    ).toBe(true);
    expect(
      isUcPreApplicationParseRequest(
        new Request("https://example.test/api/parse-cv"),
      ),
    ).toBe(false);
    expect(
      isUcPreApplicationParseRequest(
        new Request("https://example.test/api/parse-cv?flow=other"),
      ),
    ).toBe(false);
  });
});
