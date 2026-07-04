import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginAs, isAuthenticated } from "../utils/userStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  useEffect(() => {
    if (isAuthenticated()) navigate(from, { replace: true });
  }, [navigate, from]);

  const signIn = (persona: "student" | "instructor") => {
    loginAs(persona);
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-grayDark px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-canvas-grayDark">Sign in to CourseArc</h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose a demo persona to explore the platform.
        </p>
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => signIn("student")}
            className="w-full rounded-xl bg-canvas-blue px-4 py-3 text-sm font-medium text-white hover:bg-canvas-blue/90"
          >
            Continue as Student
          </button>
          <button
            type="button"
            onClick={() => signIn("instructor")}
            className="w-full rounded-xl border border-canvas-border px-4 py-3 text-sm font-medium text-canvas-grayDark hover:bg-canvas-grayLight"
          >
            Continue as Instructor
          </button>
        </div>
      </div>
    </div>
  );
}
