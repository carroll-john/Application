import { useEffect, useRef } from "react";
import { createApplicationOperationScope } from "./applicationOperationScope";

export function useApplicationOperationScope(ownerId: string | null) {
  const ref = useRef({ ownerId, scope: createApplicationOperationScope() });
  if (ref.current.ownerId !== ownerId) {
    // Invalidate before children can observe the new identity, not in a later effect.
    ref.current.scope.dispose();
    ref.current = { ownerId, scope: createApplicationOperationScope() };
  }
  const { scope } = ref.current;
  useEffect(() => {
    scope.activate();
    return () => scope.dispose();
  }, [scope]);
  return scope;
}
