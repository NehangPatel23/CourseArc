import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import UserAvatar from "./UserAvatar";
import {
  DEMO_PERSONA_CHANGED_EVENT,
  ensureDemoRoster,
  getActiveStudentId,
  getPersonaAvatar,
  listDemoPersonasForPicker,
  setActiveStudentId,
} from "../utils/demoPersona";
import { useStudentView } from "../utils/studentView";
import { loadCourses } from "../utils/coursesStore";
import { loadStoredUser } from "../utils/userStore";

const PERSONA_LIST_KEY = "canvasClone:demoPersonaListExpanded";

type Props = {
  compact?: boolean;
};

function readListExpanded(): boolean {
  try {
    const raw = window.localStorage.getItem(PERSONA_LIST_KEY);
    return raw == null ? true : raw === "1";
  } catch {
    return true;
  }
}

export default function DemoPersonaPicker({ compact = false }: Props) {
  const { studentView } = useStudentView();
  const [activeId, setActiveId] = useState(() => getActiveStudentId() ?? "1");
  const [menuOpen, setMenuOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(readListExpanded);
  const [, setTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const course of loadCourses(true)) {
      ensureDemoRoster(course.id);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      setActiveId(getActiveStudentId() ?? "1");
      setTick((n) => n + 1);
    };
    window.addEventListener(DEMO_PERSONA_CHANGED_EVENT, sync);
    window.addEventListener("canvasClone:userChanged", sync);
    return () => {
      window.removeEventListener(DEMO_PERSONA_CHANGED_EVENT, sync);
      window.removeEventListener("canvasClone:userChanged", sync);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PERSONA_LIST_KEY, listExpanded ? "1" : "0");
    } catch {}
  }, [listExpanded]);

  if (!studentView) return null;

  const personas = listDemoPersonasForPicker();
  const active = personas.find((p) => p.id === activeId) ?? personas[0]!;
  const stored = loadStoredUser();
  const activeAvatar = getPersonaAvatar(active.id, stored);

  const select = (id: string) => {
    setActiveStudentId(id);
    setActiveId(id);
    setMenuOpen(false);
  };

  if (compact) {
    return (
      <div ref={rootRef} className="relative mt-2 flex justify-center px-1">
        <button
          type="button"
          title={`${active.name} — switch demo student`}
          aria-label={`Demo student: ${active.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-full ring-2 ring-transparent transition hover:ring-white/30 focus:outline-none focus:ring-canvas-blue/50"
        >
          <UserAvatar
            name={active.name}
            initials={activeAvatar.initials}
            color={activeAvatar.color}
            imageUrl={activeAvatar.imageUrl}
            doodleId={activeAvatar.doodleId}
            size="sm"
          />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 flex-col gap-1.5 rounded-xl border border-white/10 bg-canvas-grayDark p-2 shadow-lg">
            {personas.map((p) => {
              const av = getPersonaAvatar(p.id, stored);
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.name}
                  onClick={() => select(p.id)}
                  className={`relative rounded-full ${
                    selected
                      ? "ring-2 ring-canvas-blue"
                      : "ring-2 ring-transparent hover:ring-white/30"
                  }`}
                >
                  <UserAvatar
                    name={p.name}
                    initials={av.initials}
                    color={av.color}
                    imageUrl={av.imageUrl}
                    doodleId={av.doodleId}
                    size="sm"
                  />
                  {selected && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-canvas-blue text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
      <button
        type="button"
        onClick={() => setListExpanded((v) => !v)}
        aria-expanded={listExpanded}
        className="flex w-full items-center gap-1 px-1 pb-1.5 text-left"
      >
        <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Demo student
        </span>
        {listExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        )}
      </button>

      {!listExpanded ? (
        <button
          type="button"
          onClick={() => setListExpanded(true)}
          title="Expand to switch demo student"
          className="flex w-full items-center gap-2.5 rounded-lg bg-canvas-blue/90 px-2 py-1.5 text-left text-white"
        >
          <UserAvatar
            name={active.name}
            initials={activeAvatar.initials}
            color={activeAvatar.color}
            imageUrl={activeAvatar.imageUrl}
            doodleId={activeAvatar.doodleId}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{active.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
        </button>
      ) : (
        <>
          <ul className="space-y-1">
            {personas.map((p) => {
              const av = getPersonaAvatar(p.id, stored);
              const selected = p.id === activeId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                      selected
                        ? "bg-canvas-blue/90 text-white"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <UserAvatar
                      name={p.name}
                      initials={av.initials}
                      color={av.color}
                      imageUrl={av.imageUrl}
                      doodleId={av.doodleId}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 px-1 text-[10px] leading-snug text-gray-500">
            Customize your avatar in Settings.
          </p>
        </>
      )}
    </div>
  );
}
