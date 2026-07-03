import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";

interface Identifiable {
  id: string;
}

/**
 * Re-applies `initialRecord` to local form state when the route's record
 * genuinely changes, or when the record finishes loading asynchronously
 * after mount (e.g. a hard reload, where `existing` starts out undefined
 * while application data is still hydrating). Only fires once per record —
 * a later background refetch that resolves the same id again won't re-sync
 * and clobber in-progress edits.
 */
export function useSyncRecordOnHydrate<T>(
  id: string | undefined,
  existing: T | undefined,
  initialRecord: T,
  onSync: (record: T) => void,
) {
  const syncedIdRef = useRef(id);
  const hydratedRef = useRef(Boolean(existing));

  useEffect(() => {
    const idChanged = syncedIdRef.current !== id;

    if (idChanged) {
      syncedIdRef.current = id;
      hydratedRef.current = Boolean(existing);
      onSync(initialRecord);
      return;
    }

    if (existing && !hydratedRef.current) {
      hydratedRef.current = true;
      onSync(initialRecord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, existing, initialRecord]);
}

export function resolveEditableRecord<T extends Identifiable>(
  items: T[],
  id: string | undefined,
  createDefault: () => T,
) {
  const existing = id ? items.find((item) => item.id === id) : undefined;

  return {
    existing,
    isEditing: Boolean(existing),
    initialRecord: existing ?? createDefault(),
  };
}

export function useEditableRecord<T extends Identifiable>(
  items: T[],
  createDefault: () => T,
) {
  const { id } = useParams();
  const { existing, initialRecord, isEditing } = useMemo(
    () => resolveEditableRecord(items, id, createDefault),
    [createDefault, id, items],
  );

  return {
    existing,
    id,
    isEditing,
    initialRecord,
  };
}
