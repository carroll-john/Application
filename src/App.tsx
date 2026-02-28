import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ApplicationProvider } from "./context/ApplicationContext";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <ApplicationProvider>
        <RouterProvider router={router} />
      </ApplicationProvider>
    </AuthProvider>
  );
}
