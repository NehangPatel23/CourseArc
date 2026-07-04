import { Navigate, useLocation } from "react-router-dom";
import { loadSettings } from "../utils/settingsStore";
import { isAuthenticated } from "../utils/userStore";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const settings = loadSettings();

  if (settings.requireLogin && !isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
