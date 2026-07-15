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
  transformApplication?: (
    application: ApplicationData,
    previous: ApplicationData,
  ) => ApplicationData;
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
  const transform = config.transformApplication ?? ((application: ApplicationData) => application);

  return {
    add: (item: T) =>
      updateDataWithEvent(
        (current) => transform({
          ...current,
          [collectionKey]: [
            ...(current[collectionKey] as T[]),
            item,
          ],
        }, current),
        savedEvent,
        (nextData) => ({
          action: "created",
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
    update: (id: string, item: T) =>
      updateDataWithEvent(
        (current) => transform({
          ...current,
          [collectionKey]: replaceItemById(
            current[collectionKey] as T[],
            id,
            item,
          ),
        }, current),
        savedEvent,
        (nextData) => ({
          action: "updated",
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
    remove: (id: string) =>
      updateDataWithEvent(
        (current) => transform({
          ...current,
          [collectionKey]: (current[collectionKey] as T[]).filter(
            (entry) => entry.id !== id,
          ),
        }, current),
        removedEvent,
        (nextData) => ({
          total_count: (nextData[collectionKey] as T[]).length,
        }),
      ),
  };
}
