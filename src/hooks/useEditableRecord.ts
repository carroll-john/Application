import { useMemo } from "react";
import { useParams } from "react-router-dom";

interface Identifiable {
  id: string;
}

export function useEditableRecord<T extends Identifiable>(
  items: T[],
  createDefault: () => T,
) {
  const { id } = useParams();
  const existing = useMemo(
    () => items.find((item) => item.id === id),
    [id, items],
  );

  return {
    existing,
    isEditing: Boolean(existing),
    initialRecord: existing ?? createDefault(),
  };
}
