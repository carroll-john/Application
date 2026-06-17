import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./check-leaked-password";

function get(prefix: string) {
  return handler.fetch(
    new Request(`https://app.test/api/check-leaked-password?prefix=${prefix}`, {
      method: "GET",
      headers: { "x-forwarded-for": "203.0.113.1" },
    }),
  );
}

describe("check-leaked-password handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-GET methods", async () => {
    const response = await handler.fetch(
      new Request("https://app.test/api/check-leaked-password?prefix=ABCDE", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(405);
  });

  it("rejects a malformed hash prefix without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await get("XYZ");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies the prefix to the Pwned Passwords range API with padding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await get("abcde");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("0018A45C4D1DEF81644B54AB7F969B88D65:1");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.pwnedpasswords.com/range/ABCDE");
    expect((init as RequestInit).headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("returns 502 when the upstream responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    const response = await get("ABCDE");
    expect(response.status).toBe(502);
  });

  it("returns 502 when the upstream request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const response = await get("ABCDE");
    expect(response.status).toBe(502);
  });
});
