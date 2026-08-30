import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSettings } from "../hooks/useSettings";
import { AUTH_CHANGED_EVENT, isAuthenticated } from "../utils/userStore";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const settings = useSettings();
  const [authed, setAuthed] = useState(isAuthenticated);

  useEffect(() => {
    const refresh = () => setAuthed(isAuthenticated());
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    window.addEventListener("canvasClone:userChanged", refresh);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
      window.removeEventListener("canvasClone:userChanged", refresh);
    };
  }, []);

  if (settings.requireLogin && !authed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
