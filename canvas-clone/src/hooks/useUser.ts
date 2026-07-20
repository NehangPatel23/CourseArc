import { useEffect, useState } from "react";
import { DEMO_PERSONA_CHANGED_EVENT } from "../utils/demoPersona";
import { loadUser, type UserProfile } from "../utils/userStore";
import { studentViewEventName } from "../utils/studentView";

const USER_CHANGED = "canvasClone:userChanged";

/** Effective user (includes demo persona overlay). Re-renders on persona / profile / view changes. */
export function useUser(): UserProfile {
  const [user, setUser] = useState<UserProfile>(() => loadUser());

  useEffect(() => {
    const refresh = () => setUser(loadUser());
    window.addEventListener(USER_CHANGED, refresh);
    window.addEventListener(DEMO_PERSONA_CHANGED_EVENT, refresh);
    window.addEventListener(studentViewEventName, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(USER_CHANGED, refresh);
      window.removeEventListener(DEMO_PERSONA_CHANGED_EVENT, refresh);
      window.removeEventListener(studentViewEventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return user;
}

/** Convenience: current effective user id (demo persona when student view is on). */
export function useUserId(): string {
  return useUser().id;
}
