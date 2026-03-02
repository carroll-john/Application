import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRouteChunkRetry,
  isRecoverableRouteChunkError,
  retryRouteChunkLoad,
} from "./routeChunkRecovery";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindowMock() {
  const storage = new Map<string, string>();
  const reload = vi.fn();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        reload,
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  return { reload };
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }

  vi.restoreAllMocks();
});

describe("routeChunkRecovery", () => {
  it("recognizes lazy chunk fetch failures", () => {
    expect(
      isRecoverableRouteChunkError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://example.com/assets/Overview.js",
        ),
      ),
    ).toBe(true);
    expect(
      isRecoverableRouteChunkError(
        new Error("Importing a module script failed."),
      ),
    ).toBe(true);
    expect(isRecoverableRouteChunkError(new Error("Plain application error"))).toBe(
      false,
    );
  });

  it("retries a route chunk load only once until the marker is cleared", () => {
    const { reload } = installWindowMock();

    expect(retryRouteChunkLoad("overview", reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    expect(retryRouteChunkLoad("overview", reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    clearRouteChunkRetry("overview");

    expect(retryRouteChunkLoad("overview", reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
