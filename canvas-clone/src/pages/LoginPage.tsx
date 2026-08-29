import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, UserCheck } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { loginAs, isAuthenticated, loadStoredUser } from "../utils/userStore";
import {
  demoStudentWorkHint,
  getPersonaAvatar,
  isDemoSelfPersona,
  listDemoPersonasForPicker,
} from "../utils/demoPersona";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  useEffect(() => {
    if (isAuthenticated()) navigate(from, { replace: true });
  }, [navigate, from]);

  const stored = loadStoredUser();
  const students = listDemoPersonasForPicker();

  const enter = (persona: "student" | "instructor" | "ta", studentPersonaId?: string) => {
    loginAs(persona, studentPersonaId);
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-grayDark px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-canvas-grayDark">Sign in to CourseArc</h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose a demo persona to explore the platform.
        </p>

        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Students
          </h2>
          <div className="mt-2 space-y-2">
            {students.map((student) => {
              const av = getPersonaAvatar(student.id, stored);
              const you = isDemoSelfPersona(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => enter("student", student.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    you
                      ? "bg-canvas-blue text-white hover:bg-canvas-blue/90"
                      : "border border-canvas-border text-canvas-grayDark hover:bg-canvas-grayLight"
                  }`}
                >
                  <UserAvatar
                    name={student.name}
                    initials={av.initials}
                    color={av.color}
                    imageUrl={av.imageUrl}
                    doodleId={av.doodleId}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{student.name}</span>
                      {you && (
                        <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          You
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${you ? "text-white/80" : "text-gray-500"}`}
                    >
                      {demoStudentWorkHint(student.id)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Staff
          </h2>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => enter("ta")}
              className="flex w-full items-center gap-3 rounded-xl border border-canvas-border px-3 py-2.5 text-left text-canvas-grayDark transition hover:bg-canvas-grayLight"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <UserCheck className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Taylor Kim</span>
                <span className="mt-0.5 block text-xs text-gray-500">Teaching assistant</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => enter("instructor")}
              className="flex w-full items-center gap-3 rounded-xl border border-canvas-border px-3 py-2.5 text-left text-canvas-grayDark transition hover:bg-canvas-grayLight"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{stored.name}</span>
                <span className="mt-0.5 block text-xs text-gray-500">Instructor</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
