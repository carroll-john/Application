import { describe, expect, it } from "vitest";
import { createApplicationUpdateQueue } from "./applicationUpdateQueue";

interface Snapshot {
  a: number;
  b: number;
  c: number;
}

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createApplicationUpdateQueue", () => {
  it("accumulates rapid successive updates instead of clobbering earlier ones", async () => {
    let committed: Snapshot = { a: 0, b: 0, c: 0 };
    const persisted: Snapshot[] = [];

    const queue = createApplicationUpdateQueue<Snapshot>({
      getCommitted: () => committed,
      // Simulate an async upsert that only updates in-memory state after the round-trip.
      persist: async (next) => {
        await tick();
        committed = next;
        persisted.push(next);
        return next;
      },
    });

    // Fire three edits back-to-back, without awaiting or letting `committed` update
    // between them — the scenario that previously dropped the first edit.
    const writes = Promise.all([
      queue.enqueue((current) => ({ ...current, a: 1 })),
      queue.enqueue((current) => ({ ...current, b: 2 })),
      queue.enqueue((current) => ({ ...current, c: 3 })),
    ]);
    await writes;

    // The final stored state contains all three edits...
    expect(committed).toEqual({ a: 1, b: 2, c: 3 });
    // ...and each write was applied in order, building on the previous one.
    expect(persisted).toEqual([
      { a: 1, b: 0, c: 0 },
      { a: 1, b: 2, c: 0 },
      { a: 1, b: 2, c: 3 },
    ]);
  });

  it("re-seeds from committed data once the queue has drained", async () => {
    let committed: Snapshot = { a: 0, b: 0, c: 0 };
    const queue = createApplicationUpdateQueue<Snapshot>({
      getCommitted: () => committed,
      persist: async (next) => {
        committed = next;
        return next;
      },
    });

    await queue.enqueue((current) => ({ ...current, a: 1 }));
    // An external change (e.g. hydration) lands while the queue is idle.
    committed = { ...committed, b: 9 };
    await queue.enqueue((current) => ({ ...current, c: 3 }));

    expect(committed).toEqual({ a: 1, b: 9, c: 3 });
  });

  it("keeps processing after a failed write", async () => {
    let committed: Snapshot = { a: 0, b: 0, c: 0 };
    let shouldFail = true;
    const queue = createApplicationUpdateQueue<Snapshot>({
      getCommitted: () => committed,
      persist: async (next) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("network blip");
        }
        committed = next;
        return next;
      },
    });

    await expect(queue.enqueue((current) => ({ ...current, a: 1 }))).rejects.toThrow(
      "network blip",
    );
    // The next write recovers from committed data rather than wedging the queue.
    await queue.enqueue((current) => ({ ...current, b: 2 }));
    expect(committed).toEqual({ a: 0, b: 2, c: 0 });
  });
});
