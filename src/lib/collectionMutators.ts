import type { ApplicationData } from "./applicationData";

function replaceItemById<T extends { id: string }>(
  items: T[],
  id: string,
  nextItem: T,
) {
  return items.map((item) => (item.id === id ? nextItem : item));
}

interface CollectionMutatorConfig<EventName extends string> {
  collectionKey: keyof ApplicationData;
  savedEvent: EventName;
  removedEvent: EventName;
}

type UpdateDataWithEvent<EventName extends string> = (
  updater: (current: ApplicationData) => ApplicationData,
  eventName: EventName,
  properties?:
    | Record<string, unknown>
    | ((application: ApplicationData) => Record<string, unknown>),
) => Promise<void>;

export function createCollectionMutators<
  T extends { id: string },
  EventName extends string = string,
>(
  config: CollectionMutatorConfig<EventName>,
  updateDataWithEvent: UpdateDataWithEvent<EventName>,
) {
  const { collectionKey, savedEvent, removedEvent } = config;

  return {
    add: (item: T) =>
      updateDataWithEvent(
        (current) => ({
          ...current,
          [collectionKey]: [
            ...(current[collectionKey] as T[]),
            item,
          ],
        }),
        savedEvent,
        (nextData) => ({
          action: "created",
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
    update: (id: string, item: T) =>
      updateDataWithEvent(
        (current) => ({
          ...current,
          [collectionKey]: replaceItemById(
            current[collectionKey] as T[],
            id,
            item,
          ),
        }),
        savedEvent,
        (nextData) => ({
          action: "updated",
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
    remove: (id: string) =>
      updateDataWithEvent(
        (current) => ({
          ...current,
          [collectionKey]: (current[collectionKey] as T[]).filter(
            (entry) => entry.id !== id,
          ),
        }),
        removedEvent,
        (nextData) => ({
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
  };
}
