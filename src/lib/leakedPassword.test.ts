import { afterEach, describe, expect, it, vi } from "vitest";
import { hashSuffixIsListed, isPasswordLeaked } from "./leakedPassword";

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_PREFIX = "5BAA6";
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

describe("hashSuffixIsListed", () => {
  it("matches a suffix with a breach count greater than zero", () => {
    const body = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${PASSWORD_SUFFIX}:99`;
    expect(hashSuffixIsListed(body, PASSWORD_SUFFIX)).toBe(true);
  });

  it("treats padding entries (count 0) as not leaked", () => {
    const body = `${PASSWORD_SUFFIX}:0\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0`;
    expect(hashSuffixIsListed(body, PASSWORD_SUFFIX)).toBe(false);
  });

  it("is case-insensitive and tolerates whitespace", () => {
    const body = `${PASSWORD_SUFFIX.toLowerCase()}:3  `;
    expect(hashSuffixIsListed(body, PASSWORD_SUFFIX)).toBe(true);
  });

  it("returns false when the suffix is absent", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:9";
    expect(hashSuffixIsListed(body, PASSWORD_SUFFIX)).toBe(false);
  });
});

describe("isPasswordLeaked", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false for an empty password without calling the endpoint", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(isPasswordLeaked("")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the 5-char hash prefix and flags a leaked password", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(`${PASSWORD_SUFFIX}:42`, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isPasswordLeaked("password")).resolves.toBe(true);

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain(`prefix=${PASSWORD_PREFIX}`);
    expect(requestedUrl).not.toContain(PASSWORD_SUFFIX);
  });

  it("returns false when the suffix is not present in the range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isPasswordLeaked("password")).resolves.toBe(false);
  });

  it("fails open when the endpoint returns a non-200 status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(isPasswordLeaked("password")).resolves.toBe(false);
  });

  it("fails open when the request throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(isPasswordLeaked("password")).resolves.toBe(false);
  });
});
