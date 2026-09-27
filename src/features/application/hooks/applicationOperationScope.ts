/** Account lifetime and active-application selection are separate boundaries. */
export function createApplicationOperationScope() {
  let active = true;
  let lifetime = 0;
  let selection = 0;

  const captureSession = () => {
    const capturedLifetime = lifetime;
    return () => active && lifetime === capturedLifetime;
  };
  const captureSelection = () => {
    const isCurrentSession = captureSession();
    const capturedSelection = selection;
    return () => isCurrentSession() && selection === capturedSelection;
  };

  return {
    captureSession,
    captureSelection,
    beginSelection: () => {
      selection += 1;
      return captureSelection();
    },
    activate: () => { active = true; },
    dispose: () => {
      active = false;
      lifetime += 1;
      selection += 1;
    },
  };
}

export type ApplicationOperationScope = ReturnType<typeof createApplicationOperationScope>;

export function assertCurrentApplicationOperation(isCurrent: () => boolean) {
  if (!isCurrent()) {
    throw new Error("The active account or application changed. Please try again.");
  }
}
