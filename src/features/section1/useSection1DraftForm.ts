import { useState } from "react";

/**
 * Section 1 copies the draft into local state so typing is not interrupted by
 * later saves. On a hard reload that copy happens while hydration is still
 * empty, and Continue persists it. Adopt the loaded draft during render — once
 * — so the action bar cannot save the blank snapshot. Later hydration restarts
 * (token refresh, retry) must not discard edits that are already on screen.
 */
export function useSection1DraftForm<T>(source: T, isHydrating: boolean) {
  const [formData, setFormData] = useState(source);
  const [adopted, setAdopted] = useState(!isHydrating);

  if (!isHydrating && !adopted) {
    setAdopted(true);
    setFormData(source);
  }

  return [formData, setFormData] as const;
}
