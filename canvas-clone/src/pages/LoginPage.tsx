import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "../icons/Icon";
import AppLogo from "../components/AppLogo";
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
  }, [from, navigate]);

  const stored = loadStoredUser();
  const students = listDemoPersonasForPicker();

  const enter = (persona: "student" | "instructor" | "ta", studentPersonaId?: string) => {
    loginAs(persona, studentPersonaId);
    navigate(from, { replace: true });
  };

  return (
    <div className="paper-grain flex min-h-screen items-center justify-center bg-arc-paper px-4 py-10">
      <div className="w-full max-w-md bg-arc-moss p-[3px] shadow-lift">
      <div className="bg-arc-ivory p-8">
        <div className="flex items-center gap-3">
          <AppLogo size={36} variant="mark" />
          <div>
            <p className="kicker text-arc-copper">Studio</p>
            <h1 className="font-display text-2xl font-medium italic text-arc-ink">CourseArc</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-arc-ink/65">Choose a demo persona to enter the studio.</p>

        <section className="mt-8">
          <h2 className="kicker">Students</h2>
          <div className="mt-3 space-y-2">
            {students.map((student) => {
              const av = getPersonaAvatar(student.id, stored);
              const you = isDemoSelfPersona(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => enter("student", student.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    you
                      ? "bg-arc-copper text-white"
                      : "bg-arc-paper/80 text-arc-ink ring-1 ring-arc-ink/10 hover:bg-arc-paper"
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
                        <span className="kicker shrink-0 text-white/80">You</span>
                      )}
                    </span>
                    <span className={`mt-0.5 block text-xs ${you ? "text-white/80" : "text-arc-mute"}`}>
                      {demoStudentWorkHint(student.id)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="kicker">Staff</h2>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => enter("ta")}
              className="flex w-full items-center gap-3 bg-arc-paper/80 px-3 py-2.5 text-left text-arc-ink ring-1 ring-arc-ink/10 transition hover:bg-arc-paper"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-arc-sage/15 text-arc-sage">
                <Icon name="ta" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Taylor Kim</span>
                <span className="mt-0.5 block text-xs text-arc-mute">Teaching assistant</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => enter("instructor")}
              className="flex w-full items-center gap-3 bg-arc-paper/80 px-3 py-2.5 text-left text-arc-ink ring-1 ring-arc-ink/10 transition hover:bg-arc-paper"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-arc-copper/10 text-arc-copper">
                <Icon name="cap" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{stored.name}</span>
                <span className="mt-0.5 block text-xs text-arc-mute">Instructor</span>
              </span>
            </button>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
