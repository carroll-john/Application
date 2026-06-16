/**
 * DIS-142: Supabase requests occasionally fail with a transient
 * `TypeError: Failed to fetch` — a dropped connection on the applicant's side,
 * a brief Supabase cold start, or a momentary CORS/network blip. A single such
 * failure surfaced in error tracking as a possible lost-data event. These
 * failures almost always clear on a second attempt, so we wrap the client's
 * `fetch` with a short exponential back-off retry before the error reaches the
 * UI (which already maps it to a friendly "please try again" message).
 *
 * Only network-layer failures — where the browser never received an HTTP
 * response — are retried. A completed request that returns an HTTP error status
 * resolves normally and is left to the caller; we never retry those, and we
 * never retry a request the caller has already aborted.
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export interface FetchWithRetryOptions {
  /** Total attempts including the first try. Defaults to 3 (1 try + 2 retries). */
  maxAttempts?: number;
  /** Delay before the first retry, doubled on each subsequent retry. Defaults to 300ms. */
  baseDelayMs?: number;
  /** Injectable fetch implementation (used in tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable delay (used in tests). Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 300;

/**
 * A thrown `TypeError` from `fetch` means the browser never received an HTTP
 * response — offline, DNS failure, connection reset, CORS rejection, or a
 * Supabase cold start. These are the transient cases worth retrying. Anything
 * else, including an `AbortError` (a `DOMException`) from a caller-initiated
 * cancel, is left untouched.
 */
export function isTransientFetchError(error: unknown): boolean {
  return error instanceof TypeError;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createFetchWithRetry(
  options: FetchWithRetryOptions = {},
): typeof fetch {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  // Keep the literal `fetch(...)` call so the global keeps its `this` binding
  // (a detached `fetch` reference throws "Illegal invocation" in browsers).
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;

  return async function fetchWithRetry(
    input: FetchInput,
    init?: FetchInit,
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchImpl(input, init);
      } catch (error) {
        lastError = error;

        const aborted = init?.signal?.aborted ?? false;
        const isLastAttempt = attempt === maxAttempts;

        if (aborted || isLastAttempt || !isTransientFetchError(error)) {
          throw error;
        }

        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }

    // Unreachable: the loop always returns a Response or throws above.
    throw lastError;
  };
}
