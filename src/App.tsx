import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ApplicationProvider } from "./context/ApplicationContext";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  // The singleton is initialised imperatively in main.tsx; passing it as
  // `client` means the provider reuses that instance (no re-init) and only
  // exposes the posthog-js/react flag hooks to the tree.
  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>
        <ApplicationProvider>
          <RouterProvider router={router} />
        </ApplicationProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
