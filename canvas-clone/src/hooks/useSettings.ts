import { useEffect, useState } from "react";
import { loadSettings, type AppSettings } from "../utils/settingsStore";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    const refresh = () => setSettings(loadSettings());
    window.addEventListener("canvasClone:settingsChanged", refresh);
    return () => window.removeEventListener("canvasClone:settingsChanged", refresh);
  }, []);

  return settings;
}
