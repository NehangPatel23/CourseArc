// src/pages/CourseHomePage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import { mockCourses } from "../data/mockData";

import { loadModulesFromStorage, extractPageItems } from "../utils/modules";
import { loadFilesMeta, formatBytes } from "../utils/files";
import { announcementPreview } from "../utils/announcements";

import { ClipboardList, Megaphone, Plus, Trash2 } from "lucide-react";

/** ---------------------------
 * Small utilities
 * --------------------------*/
function safeUUID(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/** ---------------------------
 * Global Student View helpers
 * --------------------------*/
function studentViewStorageKey(courseId: string) {
  return `canvasClone:studentView:${courseId}`;
}
function readStudentView(courseId: string) {
  try {
    const raw = window.localStorage.getItem(studentViewStorageKey(courseId));
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

/** ---------------------------
 * Home Page “content page” integration
 * --------------------------*/
const HOME_PAGE_ID = "course-home";

// ✅ MUST match PageEditorPage.tsx
function PAGE_STORAGE_KEY(courseId: string, pageId: string) {
  return `canvasClone:page:${courseId}:${pageId}`;
}

function loadPagePayload(
  courseId: string,
  pageId: string,
): {
  title?: string;
  content?: string;
} {
  try {
    const raw = window.localStorage.getItem(PAGE_STORAGE_KEY(courseId, pageId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadPageHtmlContent(courseId: string, pageId: string) {
  const payload = loadPagePayload(courseId, pageId);
  return typeof payload.content === "string" ? payload.content : "";
}

/** ---------------------------
 * Assignments (local prototype)
 * --------------------------*/
type Assignment = {
  id: string;
  title: string;
  dueAt?: number; // epoch ms
  points?: number;
  published?: boolean;
};

function assignmentsKey(courseId: string) {
  return `canvasClone:assignments:${courseId}`;
}

function loadAssignments(courseId: string): Assignment[] {
  try {
    const raw = window.localStorage.getItem(assignmentsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    return dedupeById(arr);
  } catch {
    return [];
  }
}

function saveAssignments(courseId: string, items: Assignment[]) {
  try {
    const deduped = dedupeById(items);
    window.localStorage.setItem(
      assignmentsKey(courseId),
      JSON.stringify(deduped),
    );
    window.dispatchEvent(new Event("canvasClone:assignmentsChanged"));
  } catch {
    // no-op
  }
}

function parseDatetimeLocalToMs(v: string) {
  const s = v.trim();
  if (!s) return undefined;

  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return undefined;

  const [yStr, mStr, dStr] = datePart.split("-");
  const [hhStr, mmStr] = timePart.split(":");

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    return undefined;
  }

  const ms = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function AddAssignmentModal(props: {
  onClose: () => void;
  onAdd: (a: Omit<Assignment, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(""); // datetime-local string
  const [points, setPoints] = useState<string>("");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-[#2D3B45]">
            Add assignment
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homework 1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#2D3B45] focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">
                Due date & time (optional)
              </div>

              <div className="relative">
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={[
                    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#2D3B45]",
                    "bg-white",
                    "focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300",
                  ].join(" ")}
                />
              </div>

              <div className="mt-1 text-[11px] text-gray-500">
                Time uses your local timezone.
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">
                Points (optional)
              </div>
              <input
                type="number"
                min={0}
                step={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#2D3B45] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                Leave blank if ungraded.
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const trimmed = title.trim();
              if (!trimmed) return;

              const dueAt = parseDatetimeLocalToMs(due);

              const ptsRaw = points.trim();
              const pts =
                ptsRaw.length === 0 ? undefined : Number.parseInt(ptsRaw, 10);

              props.onAdd({
                title: trimmed,
                dueAt,
                points:
                  typeof pts === "number" && Number.isFinite(pts)
                    ? pts
                    : undefined,
                published: true,
              });

              props.onClose();
            }}
            className="px-3 py-2 text-sm font-medium rounded-md bg-[#008EE2] hover:bg-[#0079C2] text-white"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------------------------
 * Announcements (local prototype)
 * --------------------------*/
type AnnouncementStatus = "draft" | "published";

type Announcement = {
  id: string;
  title: string;
  body?: string;
  postedAt: number;
  publishedAt?: number;
  status: AnnouncementStatus;
  pinned?: boolean;
};

function announcementsKey(courseId: string) {
  return `canvasClone:announcements:${courseId}`;
}

function normalizeAnnouncement(raw: any): Announcement | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const postedAt =
    typeof raw.postedAt === "number" && Number.isFinite(raw.postedAt)
      ? raw.postedAt
      : Date.now();

  if (!id || !title) return null;

  const status: AnnouncementStatus =
    raw.status === "draft" || raw.status === "published"
      ? raw.status
      : raw.published === false
        ? "draft"
        : "published";

  const publishedAt =
    typeof raw.publishedAt === "number" && Number.isFinite(raw.publishedAt)
      ? raw.publishedAt
      : status === "published"
        ? postedAt
        : undefined;

  return {
    id,
    title,
    body:
      typeof raw.body === "string" && raw.body.trim() ? raw.body : undefined,
    postedAt,
    publishedAt,
    status,
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : undefined,
  };
}

function loadAnnouncements(courseId: string): Announcement[] {
  try {
    const raw = window.localStorage.getItem(announcementsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];

    const normalized = arr
      .map(normalizeAnnouncement)
      .filter((x): x is Announcement => !!x);

    return dedupeById(normalized);
  } catch {
    return [];
  }
}

function saveAnnouncements(courseId: string, items: Announcement[]) {
  try {
    const deduped = dedupeById(items);
    window.localStorage.setItem(
      announcementsKey(courseId),
      JSON.stringify(deduped),
    );
    window.dispatchEvent(new Event("canvasClone:announcementsChanged"));
  } catch {
    // no-op
  }
}

/** ---------------------------
 * Widgets (right sidebar)
 * --------------------------*/
function WidgetCard(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-[#2D3B45]">
          {props.title}
        </div>
      </div>
      <div className="px-5 py-4">{props.children}</div>
    </div>
  );
}

export default function CourseHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";

  const course = mockCourses.find((c) => String(c.id) === courseId);

  const [studentView, setStudentView] = useState<boolean>(() =>
    readStudentView(effectiveCourseId),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === studentViewStorageKey(effectiveCourseId)) {
        setStudentView(readStudentView(effectiveCourseId));
      }
    };
    const onCustom = () => setStudentView(readStudentView(effectiveCourseId));

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:studentViewChanged", onCustom as any);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:studentViewChanged",
        onCustom as any,
      );
    };
  }, [effectiveCourseId]);

  const modules = useMemo(() => loadModulesFromStorage(), []);
  const pages = useMemo(() => extractPageItems(modules), [modules]);

  const files = useMemo(() => {
    if (!courseId) return [];
    return loadFilesMeta(courseId);
  }, [courseId]);

  const recentFiles = useMemo(() => {
    return [...files].sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 5);
  }, [files]);

  const totalModuleItems = useMemo(() => {
    return modules.reduce((sum, m) => sum + (m.items?.length ?? 0), 0);
  }, [modules]);

  // ✅ Home content (must use PageEditorPage storage key)
  const [homeContent, setHomeContent] = useState<string>(() =>
    loadPageHtmlContent(effectiveCourseId, HOME_PAGE_ID),
  );

  useEffect(() => {
    const refresh = () =>
      setHomeContent(loadPageHtmlContent(effectiveCourseId, HOME_PAGE_ID));

    const onStorage = (e: StorageEvent) => {
      if (e.key === PAGE_STORAGE_KEY(effectiveCourseId, HOME_PAGE_ID))
        refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:pageContentChanged", refresh as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:pageContentChanged",
        refresh as any,
      );
    };
  }, [effectiveCourseId]);

  const hasHomeContent = homeContent.trim().length > 0;

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    loadAssignments(effectiveCourseId),
  );
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    loadAnnouncements(effectiveCourseId),
  );

  // Keep both in sync across tabs + same-tab custom events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === assignmentsKey(effectiveCourseId)) {
        setAssignments(loadAssignments(effectiveCourseId));
      }
      if (e.key === announcementsKey(effectiveCourseId)) {
        setAnnouncements(loadAnnouncements(effectiveCourseId));
      }
    };

    const onAssignmentsChanged = () =>
      setAssignments(loadAssignments(effectiveCourseId));
    const onAnnouncementsChanged = () =>
      setAnnouncements(loadAnnouncements(effectiveCourseId));

    window.addEventListener("storage", onStorage);
    window.addEventListener(
      "canvasClone:assignmentsChanged",
      onAssignmentsChanged as any,
    );
    window.addEventListener(
      "canvasClone:announcementsChanged",
      onAnnouncementsChanged as any,
    );

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:assignmentsChanged",
        onAssignmentsChanged as any,
      );
      window.removeEventListener(
        "canvasClone:announcementsChanged",
        onAnnouncementsChanged as any,
      );
    };
  }, [effectiveCourseId]);

  // Centralized persist helpers
  const persistAnnouncements = (next: Announcement[]) => {
    const deduped = dedupeById(next);
    setAnnouncements(deduped);
    saveAnnouncements(effectiveCourseId, deduped);
  };

  const persistAssignments = (next: Assignment[]) => {
    const deduped = dedupeById(next);
    setAssignments(deduped);
    saveAssignments(effectiveCourseId, deduped);
  };

  const upcomingAssignments = useMemo(() => {
    return [...assignments]
      .filter((a) => a.published !== false)
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 5);
  }, [assignments]);

  const recentAnnouncements = useMemo(() => {
    const published = [...announcements].filter(
      (a) => a.status === "published",
    );

    const pinned = published
      .filter((a) => !!a.pinned)
      .sort(
        (a, b) => (b.publishedAt ?? b.postedAt) - (a.publishedAt ?? a.postedAt),
      );

    const unpinned = published
      .filter((a) => !a.pinned)
      .sort(
        (a, b) => (b.publishedAt ?? b.postedAt) - (a.publishedAt ?? a.postedAt),
      );

    return [...pinned, ...unpinned].slice(0, 3);
  }, [announcements]);

  if (!course) return <div className="p-10">Course not found.</div>;

  const AnnouncementsCard = (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-gray-500" />
          <div className="text-sm font-semibold text-[#2D3B45]">
            Announcements
          </div>
        </div>

        {!studentView && (
          <button
            type="button"
            onClick={() => {
              if (!courseId) return;
              navigate(`/courses/${courseId}/announcements/new`, {
                state: { from: location.pathname + location.search },
              });
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            + Add
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {recentAnnouncements.length === 0 ? (
          <div className="text-sm text-gray-600">No announcements yet.</div>
        ) : (
          <div className="space-y-2">
            {recentAnnouncements.map((a) => {
              const p = a.body ? announcementPreview(a.body, 200) : null;

              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-gray-200 bg-white overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!courseId) return;
                        navigate(`/courses/${courseId}/announcements/${a.id}`, {
                          state: { from: location.pathname + location.search },
                        });
                      }}
                      className={[
                        "min-w-0 flex-1 text-left",
                        "rounded-md px-2 py-1",
                        "bg-white hover:bg-gray-50 transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-blue-200",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-[#2D3B45] truncate">
                        {a.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(a.publishedAt ?? a.postedAt).toLocaleString()}
                      </div>

                      {p ? (
                        <div className="mt-3 relative">
                          <div
                            className={[
                              "text-sm text-gray-700 whitespace-pre-wrap line-clamp-3",
                              p.containsCode
                                ? "font-mono text-[12px] bg-gray-50 border border-gray-200 rounded-md p-3"
                                : "",
                            ].join(" ")}
                          >
                            {p.text}
                          </div>

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />

                          {p.truncated && (
                            <div className="mt-1 text-xs font-medium text-[#008EE2]">
                              View more →
                            </div>
                          )}
                        </div>
                      ) : null}
                    </button>

                    {!studentView && (
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => {
                          persistAnnouncements(
                            announcements.filter((x) => x.id !== a.id),
                          );
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-red-50 text-sm text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const AssignmentsCard = (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          <div className="text-sm font-semibold text-[#2D3B45]">
            Upcoming Assignments
          </div>
        </div>

        {!studentView && (
          <button
            type="button"
            onClick={() => setAddAssignmentOpen(true)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            + Add
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {upcomingAssignments.length === 0 ? (
          <div className="text-sm text-gray-600">No upcoming assignments.</div>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 bg-white"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#2D3B45] truncate">
                    {a.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.dueAt
                      ? `Due ${new Date(a.dueAt).toLocaleString()}`
                      : "No due date"}
                    {typeof a.points === "number" ? ` • ${a.points} pts` : ""}
                  </div>
                </div>

                {!studentView && (
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => {
                      persistAssignments(
                        assignments.filter((x) => x.id !== a.id),
                      );
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-red-50 text-sm text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const CenterArea = (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-canvas-grayDark truncate">
            {hasHomeContent ? "Home" : `Welcome to ${course.title}`}
          </h2>
          {!hasHomeContent && (
            <p className="text-gray-600 leading-relaxed mt-2">
              Quick access to your course content.
            </p>
          )}
        </div>

        {!studentView && (
          <button
            type="button"
            onClick={() => {
              if (!courseId) return;
              navigate(`/courses/${courseId}/pages/${HOME_PAGE_ID}`);
            }}
            className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            Edit Home Page
          </button>
        )}
      </div>

      <div className="h-px bg-gray-200" />

      {hasHomeContent ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-5">
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: homeContent }}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Modules</div>
            <div className="mt-1 text-2xl font-semibold text-[#2D3B45]">
              {modules.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {totalModuleItems} item{totalModuleItems === 1 ? "" : "s"} total
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/modules`)}
              className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
            >
              Open Modules
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Pages</div>
            <div className="mt-1 text-2xl font-semibold text-[#2D3B45]">
              {pages.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Pages currently referenced in modules
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/pages`)}
              className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
            >
              Open Pages
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Files</div>
            <div className="mt-1 text-2xl font-semibold text-[#2D3B45]">
              {files.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Stored locally in IndexedDB for this prototype
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/files`)}
              className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
            >
              Open Files
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const RightSidebar = (
    <div className="space-y-4">
      {!studentView && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-semibold text-[#2D3B45]">
              Instructor Tools
            </div>
          </div>
          <div className="px-5 py-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                if (!courseId) return;
                navigate(`/courses/${courseId}/announcements/new`, {
                  state: { from: location.pathname + location.search },
                });
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            >
              <Megaphone className="w-4 h-4" />
              Add Announcement
            </button>

            <button
              type="button"
              onClick={() => setAddAssignmentOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Assignment
            </button>

            <button
              type="button"
              onClick={() => {
                if (!courseId) return;
                navigate(`/courses/${courseId}/pages/${HOME_PAGE_ID}`);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
            >
              Edit Home Page
            </button>
          </div>
        </div>
      )}

      {AnnouncementsCard}
      {AssignmentsCard}

      <WidgetCard title="To Do">
        <div className="text-sm text-gray-600">
          (Prototype placeholder) Later we can populate this from assignments,
          module requirements, and missing “must view” items.
        </div>
      </WidgetCard>

      <WidgetCard title="Coming Up">
        {upcomingAssignments.length === 0 ? (
          <div className="text-sm text-gray-600">No upcoming items.</div>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map((a) => (
              <div key={a.id} className="text-sm">
                <div className="font-semibold text-[#2D3B45] truncate">
                  {a.title}
                </div>
                <div className="text-xs text-gray-500">
                  {a.dueAt
                    ? `Due ${new Date(a.dueAt).toLocaleString()}`
                    : "No due date"}
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#2D3B45]">
              Recent Files
            </div>
            <div className="text-xs text-gray-500">Latest uploads</div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}/files`)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            View all
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {recentFiles.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-600 bg-gray-50">
              No files uploaded yet.
            </div>
          ) : (
            recentFiles.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/courses/${courseId}/files/${f.id}`)}
                className={[
                  "w-full text-left px-5 py-3 transition-colors",
                  "bg-transparent border-0 shadow-none rounded-none",
                  "hover:bg-gray-50",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#2D3B45] truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(f.uploadedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 flex-shrink-0">
                    {formatBytes(f.size)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <WidgetCard title="Course Links">
        <div className="space-y-1">
          <button
            type="button"
            className={[
              "w-full text-left px-3 py-2 rounded-md text-sm text-gray-700",
              "bg-transparent border-0 shadow-none",
              "hover:bg-gray-50",
              "focus:outline-none focus:ring-0",
            ].join(" ")}
            onClick={() => navigate(`/courses/${courseId}/modules`)}
          >
            Modules →
          </button>

          <button
            type="button"
            className={[
              "w-full text-left px-3 py-2 rounded-md text-sm text-gray-700",
              "bg-transparent border-0 shadow-none",
              "hover:bg-gray-50",
              "focus:outline-none focus:ring-0",
            ].join(" ")}
            onClick={() => navigate(`/courses/${courseId}/pages`)}
          >
            Pages →
          </button>

          <button
            type="button"
            className={[
              "w-full text-left px-3 py-2 rounded-md text-sm text-gray-700",
              "bg-transparent border-0 shadow-none",
              "hover:bg-gray-50",
              "focus:outline-none focus:ring-0",
            ].join(" ")}
            onClick={() => navigate(`/courses/${courseId}/files`)}
          >
            Files →
          </button>

          <button
            type="button"
            className={[
              "w-full text-left px-3 py-2 rounded-md text-sm text-gray-700",
              "bg-transparent border-0 shadow-none",
              "hover:bg-gray-50",
              "focus:outline-none focus:ring-0",
            ].join(" ")}
            onClick={() => navigate(`/courses/${courseId}/announcements`)}
          >
            Announcements →
          </button>
        </div>
      </WidgetCard>
    </div>
  );

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="max-w-6xl">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">{CenterArea}</div>
            <div className="col-span-12 lg:col-span-4">{RightSidebar}</div>
          </div>

          <div className="mt-10 text-xs text-gray-500">
            Tip: Next, we can add “Recent Feedback” once Grades exist and wire
            “To Do” to missing requirements.
          </div>
        </div>
      </div>

      {!studentView && addAssignmentOpen && (
        <AddAssignmentModal
          onClose={() => setAddAssignmentOpen(false)}
          onAdd={(a) => {
            const newItem: Assignment = {
              id: safeUUID("a"),
              ...a,
            };
            persistAssignments([newItem, ...assignments]);
          }}
        />
      )}
    </div>
  );
}
