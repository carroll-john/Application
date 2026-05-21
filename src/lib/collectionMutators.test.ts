import { describe, expect, it, vi } from "vitest";
import type { ApplicationData } from "./applicationData";
import { createCollectionMutators } from "./collectionMutators";

describe("createCollectionMutators", () => {
  it("adds, updates, and removes items by id", async () => {
    let current: ApplicationData = {
      employmentExperiences: [{ id: "a", company: "Acme" } as never],
    } as ApplicationData;

    const updateDataWithEvent = vi.fn(
      async (
        updater: (previous: ApplicationData) => ApplicationData,
        eventName: string,
      ) => {
        current = updater(current);
        return eventName;
      },
    );

    const { add, update, remove } = createCollectionMutators(
      {
        collectionKey: "employmentExperiences",
        savedEvent: "employment_saved",
        removedEvent: "employment_removed",
      },
      updateDataWithEvent,
    );

    await add({ id: "b", company: "Beta" } as never);
    expect(current.employmentExperiences).toHaveLength(2);

    await update("a", { id: "a", company: "Updated" } as never);
    expect(current.employmentExperiences[0]).toMatchObject({
      id: "a",
      company: "Updated",
    });

    await remove("b");
    expect(current.employmentExperiences).toHaveLength(1);
    expect(updateDataWithEvent).toHaveBeenCalledWith(
      expect.any(Function),
      "employment_removed",
      expect.any(Function),
    );
  });
});
