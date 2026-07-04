// src/pages/CourseHomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import RichContentViewer from "../components/RichContentViewer";
import CoursePickerModal, { pickCourseOrRun } from "../components/CoursePickerModal";
import { getCourseById, loadCourses } from "../utils/coursesStore";
import {
  isCourseNavItemVisibleToStudents,
  type CourseNavItemId,
} from "../utils/courseNavigation";
import { getGradeSnapshot } from "../data/mockData";

import { loadModulesFromStorage, extractPageItems } from "../utils/modules";
import { loadFilesMeta, formatBytes } from "../utils/files";
import { ClipboardList, GraduationCap, Home, Megaphone, MessageSquare, Plus, Trash2 } from "lucide-react";

import { useStudentView } from "../utils/studentView";
import {
  announcementPreview,
  autoPublishIfNeeded,
  isStudentVisibleAnnouncement,
  loadAnnouncements,
  saveAnnouncements,
  announcementsKey,
  type Announcement,
} from "../utils/announcements";
import {
  loadAssignments,
  saveAssignments,
  assignmentsKey,
  isStudentVisibleAssignment,
  type Assignment,
} from "../utils/assignments";
import { isStudentVisibleTopic, loadTopics } from "../utils/discussions";

/** ---------------------------
 * Small utilities
 * --------------------------*/
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
 * Home Page “content page” integration
 * --------------------------*/
const HOME_PAGE_ID = "course-home";

// MUST match PageEditorPage.tsx
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
 * Widgets (right sidebar)
 * --------------------------*/
function WidgetCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-canvas-grayDark">
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

  const course = courseId ? getCourseById(courseId) : null;

  const { studentView } = useStudentView(effectiveCourseId);

  const navListVisible = (navId: CourseNavItemId) =>
    !studentView || isCourseNavItemVisibleToStudents(navId, course);

  type InstructorAction = "announcement" | "assignment" | "editHome";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<InstructorAction | null>(null);
  const courses = loadCourses().filter((c) => !c.archived);

  const runInstructorAction = (action: InstructorAction, targetCourseId: string) => {
    if (action === "announcement") {
      navigate(`/courses/${targetCourseId}/announcements/new`, {
        state: { from: location.pathname + location.search },
      });
    } else if (action === "assignment") {
      navigate(`/courses/${targetCourseId}/assignments/new`, {
        state: { from: location.pathname + location.search },
      });
    } else {
      navigate(`/courses/${targetCourseId}/pages/${HOME_PAGE_ID}`);
    }
  };

  const requestInstructorAction = (action: InstructorAction, title: string) => {
    // On a course home page the course is already known, so act on it directly
    // instead of prompting the instructor to pick a course.
    if (courseId) {
      runInstructorAction(action, courseId);
      return;
    }
    pickCourseOrRun(
      courses,
      courseId,
      (id) => runInstructorAction(action, id),
      () => {
        setPendingAction(action);
        setPickerTitle(title);
        setPickerOpen(true);
      },
    );
  };

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

  // Home content (must use PageEditorPage storage key)
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
  // Announcements state (✅ centralized helpers)
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

  // auto-publish tick (same tab)
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();

      setAnnouncements((prev) => {
        const next = prev.map((a) => autoPublishIfNeeded(a, now));

        const changed = next.some(
          (a, i) =>
            a.status !== prev[i]?.status ||
            a.publishedAt !== prev[i]?.publishedAt,
        );

        if (changed) saveAnnouncements(effectiveCourseId, next);
        return changed ? next : prev;
      });
    }, 15000);

    return () => window.clearInterval(id);
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
    const list = studentView
      ? assignments.filter(isStudentVisibleAssignment)
      : assignments.filter((a) => a.status === "published" || a.published);
    return [...list]
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 5);
  }, [assignments, studentView]);

  const gradeSnapshot = getGradeSnapshot(effectiveCourseId);

  const recentDiscussions = useMemo(() => {
    const topics = loadTopics(effectiveCourseId);
    const list = studentView ? topics.filter(isStudentVisibleTopic) : topics.filter((t) => t.published);
    return list.slice(0, 2);
  }, [effectiveCourseId, studentView]);

  const recentAnnouncements = useMemo(() => {
    const now = Date.now();

    const publishedForSidebar = studentView
      ? announcements.filter((a) => isStudentVisibleAnnouncement(a, now))
      : announcements
          .map((a) => autoPublishIfNeeded(a, now))
          .filter((a) => a.status === "published");

    const pinned = publishedForSidebar
      .filter((a) => !!a.pinned)
      .sort(
        (a, b) => (b.publishedAt ?? b.postedAt) - (a.publishedAt ?? a.postedAt),
      );

    const unpinned = publishedForSidebar
      .filter((a) => !a.pinned)
      .sort(
        (a, b) => (b.publishedAt ?? b.postedAt) - (a.publishedAt ?? a.postedAt),
      );

    return [...pinned, ...unpinned].slice(0, 3);
  }, [announcements, studentView]);

  if (!course) return <div className="p-10">Course not found.</div>;

  const AnnouncementsCard = (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-gray-500" />
          <div className="text-sm font-semibold text-canvas-grayDark">
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
            {recentAnnouncements.map((a) => (
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
                    <div className="text-sm font-semibold text-canvas-grayDark truncate">
                      {a.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(a.publishedAt ?? a.postedAt).toLocaleString()}
                    </div>

                    {a.body ? (
                      <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                        {announcementPreview(a.body, 500).text}
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
            ))}
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
          <div className="text-sm font-semibold text-canvas-grayDark">
            Upcoming Assignments
          </div>
        </div>

        {!studentView && (
          <button
            type="button"
            onClick={() => requestInstructorAction("assignment", "Choose a course for this assignment")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            + Add
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {navListVisible("assignments") && (
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}/assignments`)}
            className="mb-2 text-xs text-canvas-blue hover:underline"
          >
            View all assignments →
          </button>
        )}
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
                  <div className="text-sm font-semibold text-canvas-grayDark truncate">
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
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 shrink-0 text-gray-500" />
            <h2 className="text-xl font-semibold text-canvas-grayDark truncate">
              {hasHomeContent ? "Home" : `Welcome to ${course.title}`}
            </h2>
          </div>
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
            <RichContentViewer html={homeContent} courseId={courseId} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {navListVisible("modules") && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Modules</div>
            <div className="mt-1 text-2xl font-semibold text-canvas-grayDark">
              {modules.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {totalModuleItems} item{totalModuleItems === 1 ? "" : "s"} total
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/modules`)}
              className="mt-4 w-full btn-canvas-primary"
            >
              Open Modules
            </button>
          </div>
          )}

          {navListVisible("pages") && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Pages</div>
            <div className="mt-1 text-2xl font-semibold text-canvas-grayDark">
              {pages.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Pages currently referenced in modules
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/pages`)}
              className="mt-4 w-full btn-canvas-primary"
            >
              Open Pages
            </button>
          </div>
          )}

          {navListVisible("files") && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Files</div>
            <div className="mt-1 text-2xl font-semibold text-canvas-grayDark">
              {files.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Stored locally in IndexedDB for this prototype
            </div>
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/files`)}
              className="mt-4 w-full btn-canvas-primary"
            >
              Open Files
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  );

  const RightSidebar = (
    <div className="space-y-4">
      {!studentView && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-semibold text-canvas-grayDark">
              Instructor Tools
            </div>
          </div>
          <div className="px-5 py-4 space-y-2">
            <button
              type="button"
              onClick={() => requestInstructorAction("announcement", "Choose a course for this announcement")}
              className="w-full flex items-center justify-center gap-2 btn-canvas-secondary"
            >
              <Megaphone className="w-4 h-4" />
              Add Announcement
            </button>

            <button
              type="button"
              onClick={() => requestInstructorAction("assignment", "Choose a course for this assignment")}
              className="w-full flex items-center justify-center gap-2 btn-canvas-secondary"
            >
              <Plus className="w-4 h-4" />
              Add Assignment
            </button>

            <button
              type="button"
              onClick={() => requestInstructorAction("editHome", "Choose a course to edit home page")}
              className="w-full flex items-center justify-center gap-2 btn-canvas-primary"
            >
              Edit Home Page
            </button>
          </div>
        </div>
      )}

      {AnnouncementsCard}
      {AssignmentsCard}

      <WidgetCard title="Grades">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-canvas-grayDark">{gradeSnapshot.letter}</p>
            <p className="text-sm text-gray-500">{gradeSnapshot.percent}% overall</p>
          </div>
          <GraduationCap className="h-8 w-8 text-canvas-blue opacity-60" />
        </div>
        {navListVisible("grades") && (
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}/grades`)}
            className="mt-3 text-sm text-canvas-blue hover:underline"
          >
            View grades →
          </button>
        )}
      </WidgetCard>

      {recentDiscussions.length > 0 && (
        <WidgetCard title="Recent Discussions">
          <div className="space-y-2">
            {recentDiscussions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/courses/${courseId}/discussions/${t.id}`)}
                className="block w-full text-left text-sm text-canvas-grayDark hover:text-canvas-blue"
              >
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
                {t.title}
              </button>
            ))}
          </div>
          {navListVisible("discussions") && (
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/discussions`)}
              className="mt-2 text-xs text-canvas-blue hover:underline"
            >
              View all →
            </button>
          )}
        </WidgetCard>
      )}

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
                <div className="font-semibold text-canvas-grayDark truncate">
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
            <div className="text-sm font-semibold text-canvas-grayDark">
              Recent Files
            </div>
            <div className="text-xs text-gray-500">Latest uploads</div>
          </div>
          {navListVisible("files") && (
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/files`)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            >
              View all
            </button>
          )}
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
                    <div className="text-sm font-semibold text-canvas-grayDark truncate">
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
          {(
            [
              ["discussions", "Discussions →"],
              ["assignments", "Assignments →"],
              ["grades", "Grades →"],
              ["modules", "Modules →"],
              ["pages", "Pages →"],
              ["files", "Files →"],
              ["announcements", "Announcements →"],
            ] as const
          )
            .filter(([navId]) => navListVisible(navId))
            .map(([navId, label]) => (
              <button
                key={navId}
                type="button"
                className="w-full rounded-md border-0 bg-transparent px-3 py-2 text-left text-sm text-gray-700 shadow-none hover:bg-gray-50 focus:outline-none focus:ring-0"
                onClick={() => navigate(`/courses/${courseId}/${navId}`)}
              >
                {label}
              </button>
            ))}
        </div>
      </WidgetCard>
    </div>
  );

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-8 py-8 overflow-y-auto bg-white">
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">{CenterArea}</div>
            <div className="col-span-12 lg:col-span-4">{RightSidebar}</div>
          </div>

          <div className="mt-10 text-xs text-gray-500">
            Use the course navigation to explore all tabs — announcements, discussions, assignments, and more.
          </div>
        </div>
      </div>

      <CoursePickerModal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPendingAction(null);
        }}
        title={pickerTitle}
        courses={courses}
        defaultCourseId={courseId}
        onSelect={(id) => {
          if (pendingAction) runInstructorAction(pendingAction, id);
        }}
      />

    </div>
  );
}
