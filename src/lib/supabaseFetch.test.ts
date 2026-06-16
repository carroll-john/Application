import { describe, expect, it, vi } from "vitest";
import {
  createFetchWithRetry,
  isIdempotentRequest,
  isTransientFetchError,
} from "./supabaseFetch";

function okResponse(body = "ok"): Response {
  return new Response(body, { status: 200 });
}

describe("isTransientFetchError", () => {
  it("treats TypeError (the browser 'Failed to fetch') as transient", () => {
    expect(isTransientFetchError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not treat a plain Error or an AbortError as transient", () => {
    expect(isTransientFetchError(new Error("boom"))).toBe(false);
    expect(
      isTransientFetchError(new DOMException("aborted", "AbortError")),
    ).toBe(false);
  });
});

describe("isIdempotentRequest", () => {
  it("treats reads and idempotent writes as retryable", () => {
    expect(isIdempotentRequest("https://example.test")).toBe(true); // defaults to GET
    expect(isIdempotentRequest("https://example.test", { method: "get" })).toBe(true);
    expect(isIdempotentRequest("https://example.test", { method: "DELETE" })).toBe(true);
    expect(isIdempotentRequest("https://example.test", { method: "HEAD" })).toBe(true);
  });

  it("treats POST and PATCH as non-retryable", () => {
    expect(isIdempotentRequest("https://example.test", { method: "POST" })).toBe(false);
    expect(isIdempotentRequest("https://example.test", { method: "PATCH" })).toBe(false);
  });
});

describe("createFetchWithRetry", () => {
  it("returns the first response without retrying on success", async () => {
    const response = okResponse();
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });
    const result = await fetchWithRetry("https://example.test");

    expect(result).toBe(response);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries transient failures with exponential back-off, then succeeds", async () => {
    const response = okResponse();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(response);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({
      fetchImpl,
      sleep,
      baseDelayMs: 300,
    });
    const result = await fetchWithRetry("https://example.test");

    expect(result).toBe(response);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[300], [600]]);
  });

  it("throws the last error after exhausting all attempts", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({
      fetchImpl,
      sleep,
      maxAttempts: 3,
    });

    await expect(fetchWithRetry("https://example.test")).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-network errors", async () => {
    const error = new Error("server logic error");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });

    await expect(fetchWithRetry("https://example.test")).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry an HTTP error response — it resolves normally", async () => {
    const serverError = new Response("nope", { status: 500 });
    const fetchImpl = vi.fn().mockResolvedValue(serverError);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });
    const result = await fetchWithRetry("https://example.test");

    expect(result).toBe(serverError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry a non-idempotent POST even on a transient error", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });

    await expect(
      fetchWithRetry("https://example.test", { method: "POST" }),
    ).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry a PATCH (not guaranteed idempotent)", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });

    await expect(
      fetchWithRetry("https://example.test", { method: "patch" }),
    ).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries idempotent writes such as DELETE", async () => {
    const response = okResponse();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(response);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });
    const result = await fetchWithRetry("https://example.test", {
      method: "DELETE",
    });

    expect(result).toBe(response);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reads the method from a Request object", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });

    await expect(
      fetchWithRetry(new Request("https://example.test", { method: "POST" })),
    ).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the caller's signal is already aborted", async () => {
    const error = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    controller.abort();

    const fetchWithRetry = createFetchWithRetry({ fetchImpl, sleep });

    await expect(
      fetchWithRetry("https://example.test", { signal: controller.signal }),
    ).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
