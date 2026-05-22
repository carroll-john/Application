import { describe, expect, it, vi } from "vitest";
import { getSection1Step } from "../lib/section1Steps";
import { createSection1ShellNavigation } from "./section1Navigation";

describe("createSection1ShellNavigation", () => {
  it("navigates along the configured wizard chain when not returning from review", () => {
    const navigate = vi.fn();
    const persist = vi.fn();
    const definition = getSection1Step("personal-contact");

    const shellProps = createSection1ShellNavigation({
      definition,
      fromReview: false,
      navigate,
      persist,
      previousLabel: "Previous",
      returnPath: (path) => path,
    });

    shellProps.onPrevious();
    shellProps.onContinue();
    shellProps.onSaveAndExit?.();

    expect(persist).toHaveBeenCalledTimes(3);
    expect(navigate).toHaveBeenNthCalledWith(1, definition.previousPath);
    expect(navigate).toHaveBeenNthCalledWith(2, definition.continuePath);
    expect(navigate).toHaveBeenNthCalledWith(3, "/dashboard");
    expect(shellProps.continueLabel).toBe("Continue");
  });

  it("returns to review and hides save-and-exit when editing from review", () => {
    const navigate = vi.fn();
    const persist = vi.fn();
    const definition = getSection1Step("address");

    const shellProps = createSection1ShellNavigation({
      definition,
      fromReview: true,
      navigate,
      persist,
      previousLabel: "Cancel",
      returnPath: (path) => (path === definition.continuePath ? "/review" : path),
    });

    shellProps.onContinue();

    expect(shellProps.onSaveAndExit).toBeUndefined();
    expect(shellProps.continueLabel).toBe("Save & Return to Review");
    expect(navigate).toHaveBeenCalledWith("/review");
  });
});
