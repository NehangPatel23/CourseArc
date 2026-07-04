import { useEffect, useState } from "react";
import AppLogo from "./AppLogo";

const SPLASH_KEY = "splashShown";
const DISPLAY_MS = 1800;
const FADE_MS = 400;

export default function SplashScreen() {
  const [visible, setVisible] = useState(
    () => !sessionStorage.getItem(SPLASH_KEY)
  );
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const fadeTimer = setTimeout(() => setExiting(true), DISPLAY_MS);
    const hideTimer = setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, "true");
      setVisible(false);
    }, DISPLAY_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas-grayDark ${
        exiting ? "animate-splashOut" : "animate-splashIn"
      }`}
    >
      <div
        className={`flex flex-col items-center ${exiting ? "" : "animate-splashLogoIn"}`}
      >
        <AppLogo size={72} variant="mark" />
        <h1 className="mt-6 text-2xl font-semibold text-white tracking-tight">
          CourseArc
        </h1>
        <p
          className={`mt-2 text-sm text-gray-400 opacity-0 ${exiting ? "opacity-100" : "animate-splashTaglineIn"}`}
        >
          Your courses, organized.
        </p>
      </div>
    </div>
  );
}
