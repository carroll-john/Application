import { useMemo } from "react";
import { useParams } from "react-router-dom";

interface Identifiable {
  id: string;
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
    isEditing,
    initialRecord,
  };
}
