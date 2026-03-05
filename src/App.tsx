import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ApplicationProvider } from "./context/ApplicationContext";
import { AuthProvider } from "./context/AuthContext";
import { AnalyticsConsentBanner } from "./components/AnalyticsConsentBanner";

export default function App() {
  return (
    <AuthProvider>
      <ApplicationProvider>
        <RouterProvider router={router} />
        <AnalyticsConsentBanner />
      </ApplicationProvider>
    </AuthProvider>
  );
}
