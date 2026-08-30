import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../../icons/Icon";
import { useSettings } from "../../hooks/useSettings";

const DONE_KEY = "canvasClone:atelierTourDone";
const LEGACY_KEY = "canvasClone:dashboardTourDone";
const SEEN_KEY = "canvasClone:atelierTourSeen";

const STEPS = [
  {
    id: "studio",
    target: '[data-tour="dashboard"]',
    title: "Your studio",
    body: "This is the catalog — courses on the left, the week’s desk on the right.",
  },
  {
    id: "catalog-grid",
    target: '[data-tour="course-grid"]',
    title: "The catalog",
    body: "Switch between cards and a list, pin favorites, and filter by term.",
  },
  {
    id: "roles",
    target: '[data-tour="role-toggle"]',
    title: "Student / TA / Instructor",
    body: "Use Viewing as in the sidebar to switch between student, TA, and instructor studios.",
  },
  {
    id: "search",
    target: '[data-tour="nav-search"]',
    title: "Search",
    body: "Search courses here, or press ⌘K for global search across all content.",
  },
  {
    id: "catalog-page",
    target: '[data-tour="catalog"]',
    title: "The full catalog",
    body: "Every course lives here as plates and an index — pin, nickname, and compose a new one.",
  },
  {
    id: "desk",
    target: '[data-tour="desk-rituals"]',
    title: "This week’s studio hours",
    body: "Due work and booked office hours for this course, on one desk plate.",
  },
  {
    id: "compose",
    target: '[data-tour="inbox-compose"]',
    title: "Desk mail",
    body: "Compose a thread to a student, the class, or a group. Press C from Inbox.",
  },
];

function readSeen(): string[] {
  try {
    if (window.localStorage.getItem(DONE_KEY) || window.localStorage.getItem(LEGACY_KEY)) {
      return STEPS.map((s) => s.id);
    }
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    if (STEPS.every((s) => ids.includes(s.id))) {
      window.localStorage.setItem(DONE_KEY, "1");
    }
  } catch {}
}

function markDone() {
  try {
    window.localStorage.setItem(DONE_KEY, "1");
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(STEPS.map((s) => s.id)));
  } catch {}
}

export default function StudioTour() {
  const location = useLocation();
  const settings = useSettings();
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSeen()));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  if (settings.reduceMotion) return null;
  if (!ready) return null;
  if (seen.length >= STEPS.length) return null;
  try {
    if (window.localStorage.getItem(DONE_KEY) || window.localStorage.getItem(LEGACY_KEY)) return null;
  } catch {}

  const pending = STEPS.filter((s) => !seen.includes(s.id) && document.querySelector(s.target));
  const current = pending[0];
  if (!current) return null;

  const finish = () => {
    markDone();
    setSeen(STEPS.map((s) => s.id));
  };

  const next = () => {
    const ids = [...new Set([...seen, current.id])];
    writeSeen(ids);
    setSeen(ids);
  };

  const remaining = STEPS.filter((s) => !seen.includes(s.id) && s.id !== current.id).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-arc-moss/45 p-4 sm:items-center">
      <div className="paper-grain w-full max-w-md bg-arc-paper p-7 shadow-lift ring-1 ring-arc-ink/10">
        <div className="mb-3 flex items-start justify-between">
          <p className="kicker text-arc-copper">Atelier</p>
          <button type="button" onClick={finish} className="text-arc-mute hover:text-arc-ink">
            <Icon name="close" size={14} />
          </button>
        </div>
        <h3 className="font-display text-2xl font-medium text-arc-ink">{current.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-arc-ink/70">{current.body}</p>
        <div className="mt-6 flex items-center justify-between border-t border-arc-ink/10 pt-4">
          <button type="button" onClick={finish} className="text-sm text-arc-mute hover:text-arc-ink">
            Skip
          </button>
          <button type="button" onClick={next} className="btn-canvas-primary">
            {remaining === 0 ? "Enter the studio" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
