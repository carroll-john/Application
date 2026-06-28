/**
 * Serializes application-data writes so rapid successive edits accumulate and are
 * persisted in order, instead of racing on a stale snapshot.
 *
 * The persistence layer reads the current data, applies an update, then upserts the
 * *whole* record asynchronously and only afterwards updates in-memory state. When two
 * edits fire faster than that persist + re-render cycle completes (e.g. a user — or a
 * bot — clicking through steps quickly), the naive approach has both edits read the
 * same stale data and the later upsert overwrites the earlier one, silently dropping
 * the first edit. (This is exactly how a citizenship value could vanish when the next
 * step was reached within a second.)
 *
 * This queue fixes that:
 * - while writes are in flight, each edit is applied synchronously onto an in-memory
 *   accumulator, so later edits build on earlier ones rather than on stale state;
 * - the underlying persists run one after another in submission order, so the final
 *   stored snapshot is the fully-accumulated one;
 * - when the queue is idle it re-seeds the accumulator from the latest committed data,
 *   so changes made outside the queue (hydration, opening another application) are
 *   picked up — unless committed has not yet caught up to the last persisted result,
 *   in which case it re-seeds from that result instead (see `reseed`).
 */
export interface ApplicationUpdateQueue<T> {
  /** Queue an update; resolves with the persisted result of this update. */
  enqueue(updater: (current: T) => T): Promise<T>;
}

interface CreateApplicationUpdateQueueOptions<T> {
  /** The latest committed data, read when the queue is idle. */
  getCommitted: () => T;
  /** Persist a full snapshot; resolves with the stored result. */
  persist: (next: T) => Promise<T>;
}

export function createApplicationUpdateQueue<T>({
  getCommitted,
  persist,
}: CreateApplicationUpdateQueueOptions<T>): ApplicationUpdateQueue<T> {
  // `chain` serializes the async persists; `accumulator` is the synchronous, in-memory
  // running snapshot the next edit builds on; `inFlight` tracks how many writes are
  // queued so we know when the queue has drained and should re-seed.
  let chain: Promise<unknown> = Promise.resolve();
  let accumulator: T = getCommitted();
  let inFlight = 0;
  // `lastSeedBase` is the committed snapshot we last seeded from; `lastPersistedResult`
  // is the most recent value `persist` resolved with. Together they let us tell a stale
  // committed snapshot apart from a genuine external change when re-seeding.
  let lastSeedBase: T = accumulator;
  let lastPersistedResult: T | undefined;

  // Choose the base for the next burst of edits when the queue is idle.
  //
  // Normally we re-seed from the latest committed data so external changes (hydration,
  // opening another application) are picked up. But `persist` only updates committed
  // state asynchronously (via React state + a re-render), so in the window between a
  // write resolving and that state landing, `getCommitted()` still returns the
  // *pre-persist* snapshot. Seeding from it would drop the fields persistence just
  // produced — most importantly a freshly-assigned recordId — making the next write
  // INSERT a duplicate row and silently lose the edit. When committed is still that
  // stale reference, prefer the last persisted result. A genuine external change
  // replaces committed with a different reference and is still honoured.
  const reseed = (): T => {
    const committed = getCommitted();
    const seed =
      lastPersistedResult !== undefined && committed === lastSeedBase
        ? lastPersistedResult
        : committed;
    lastSeedBase = committed;
    return seed;
  };

  const enqueue = (updater: (current: T) => T): Promise<T> => {
    // Re-seed whenever the queue is idle, then apply this edit on top synchronously so
    // a burst of edits accumulates instead of clobbering.
    if (inFlight === 0) {
      accumulator = reseed();
    }
    accumulator = updater(accumulator);
    const snapshot = accumulator;
    inFlight += 1;

    const result = chain.then(() => persist(snapshot));
    // Keep the chain alive (and ordered) even if a write rejects.
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    result.then(
      (persisted) => {
        lastPersistedResult = persisted;
        inFlight -= 1;
      },
      () => {
        inFlight -= 1;
      },
    );

    return result;
  };

  return { enqueue };
}
