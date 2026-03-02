import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_STORAGE_PREFIX = "route-chunk-retry:";
const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
] as const;

function getRetryStorageKey(routeKey: string) {
  return `${RETRY_STORAGE_PREFIX}${routeKey}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function isRecoverableRouteChunkError(error: unknown) {
  const message = getErrorMessage(error).trim().toLowerCase();

  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function retryRouteChunkLoad(
  routeKey: string,
  reload: () => void = () => window.location.reload(),
) {
  if (typeof window === "undefined") {
    return false;
  }

  const storageKey = getRetryStorageKey(routeKey);

  try {
    if (window.sessionStorage.getItem(storageKey) === "1") {
      return false;
    }

    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // If storage is unavailable, still try a hard refresh once.
  }

  reload();
  return true;
}

export function clearRouteChunkRetry(routeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(getRetryStorageKey(routeKey));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  routeKey: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importer();
      clearRouteChunkRetry(routeKey);
      return module;
    } catch (error) {
      if (
        isRecoverableRouteChunkError(error) &&
        retryRouteChunkLoad(routeKey)
      ) {
        return new Promise<{ default: T }>(() => {});
      }

      throw error;
    }
  });
}
