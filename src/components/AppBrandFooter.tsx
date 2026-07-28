/**
 * Application flows intentionally do not render the StudyNext marketing footer.
 * Keep this shared boundary so public pages can opt into a footer later without
 * restoring partner-specific chrome.
 */
export function AppBrandFooter() {
  return null;
}
