// The only piece of application state still kept in the browser. After a page
// reload we reopen whichever application the user last had active; everything
// else (the application content itself) lives only in the remote account.

export const ACTIVE_APPLICATION_ID_STORAGE_KEY =
  "application-prototype:active-application-id";

export function loadLocalActiveApplicationId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_APPLICATION_ID_STORAGE_KEY);
}

export function saveLocalActiveApplicationId(applicationId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!applicationId) {
    window.localStorage.removeItem(ACTIVE_APPLICATION_ID_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_APPLICATION_ID_STORAGE_KEY, applicationId);
}
