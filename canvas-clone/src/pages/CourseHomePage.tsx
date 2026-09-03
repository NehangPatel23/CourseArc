// src/pages/CourseHomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import PageIdentityHeader from "../components/PageIdentityHeader";
import RichContentViewer from "../components/RichContentViewer";
import CoursePickerModal, { pickCourseOrRun } from "../components/CoursePickerModal";
import CoursePublishControl from "../components/CoursePublishControl";
import StudentSectionBadge from "../components/StudentSectionBadge";
import Tooltip from "../components/ui/Tooltip";
import { getCourseById, loadCourses } from "../utils/coursesStore";
import {
  isCourseNavItemVisibleToStudents,
  type CourseNavItemId,
} from "../utils/courseNavigation";
import Icon from "../icons/Icon";
import CourseHomeCustomizer from "../components/courseHome/CourseHomeCustomizer";
import CourseTodoWidget from "../components/courseHome/CourseTodoWidget";
import GradesWidget from "../components/courseHome/GradesWidget";
import NeedsGradingWidget from "../components/courseHome/NeedsGradingWidget";
import DeskRitualsWidget from "../components/courseHome/DeskRitualsWidget";
import {
  loadCourseHomeLayout,
  type CourseHomeWidgetId,
} from "../utils/courseHomeLayout";

import { getUpcomingCalendarEvents, isBookedUpcomingAppointment } from "../utils/calendarEvents";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { loadUser } from "../utils/userStore";
import { applyEffectiveDates, DUE_DATE_OVERRIDES_CHANGED_EVENT } from "../utils/dueDateOverrides";
import { APPOINTMENT_GROUPS_CHANGED_EVENT } from "../utils/appointmentGroups";
import { CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT } from "../utils/calendarCustomEvents";
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
import { extractPageItems, loadModulesFromStorage, MODULES_CHANGED_EVENT } from "../utils/modules";
import { formatBytes, loadFilesMeta } from "../utils/files";

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
    <div className="border-b border-arc-ink/10 pb-5">
      <h3 className="font-display text-lg font-medium italic text-arc-ink">{props.title}</h3>
      <div className="mt-3">{props.children}</div>
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
  const { canEditCourseContent: canEdit, canManageCourse, canPublishCourse, canEditPages } =
    usePermissions();

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

  const [modules, setModules] = useState(() => loadModulesFromStorage());
  useEffect(() => {
    const refresh = () => setModules(loadModulesFromStorage());
    window.addEventListener(MODULES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, refresh);
  }, []);
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
    const refresh = () => {
      setHomeContent(loadPageHtmlContent(effectiveCourseId, HOME_PAGE_ID));
    };

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
  const [calendarEpoch, setCalendarEpoch] = useState(0);
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
    const onCalendarish = () => {
      setAssignments(loadAssignments(effectiveCourseId));
      setCalendarEpoch((n) => n + 1);
    };
    window.addEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, onCalendarish);
    window.addEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, onCalendarish);
    window.addEventListener(CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT, onCalendarish);

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
      window.removeEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, onCalendarish);
      window.removeEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, onCalendarish);
      window.removeEventListener(CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT, onCalendarish);
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
    const studentId = loadUser().id;
    const list = studentView
      ? assignments.filter(isStudentVisibleAssignment)
      : assignments.filter((a) => a.status === "published" || a.published);
    return [...list]
      .map((a) =>
        studentView ? applyEffectiveDates(effectiveCourseId, "assignment", a, studentId) : a,
      )
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 5);
  }, [assignments, studentView, effectiveCourseId]);

  const comingUpItems = useMemo(() => {
    if (!effectiveCourseId) return [];
    return getUpcomingCalendarEvents(5, effectiveCourseId).filter((e) => {
      if (e.type === "appointment") return isBookedUpcomingAppointment(e);
      return (
        e.type === "assignment" ||
        e.type === "quiz" ||
        e.type === "todo" ||
        e.type === "event"
      );
    });
  }, [effectiveCourseId, assignments, calendarEpoch]);

  const [homeLayout, setHomeLayout] = useState(() =>
    loadCourseHomeLayout(effectiveCourseId, studentView),
  );
  const [customizerOpen, setCustomizerOpen] = useState(false);

  useEffect(() => {
    setHomeLayout(loadCourseHomeLayout(effectiveCourseId, studentView));
  }, [effectiveCourseId, studentView]);

  useEffect(() => {
    const refresh = () =>
      setHomeLayout(loadCourseHomeLayout(effectiveCourseId, studentView));
    window.addEventListener("canvasClone:courseHomeLayoutChanged", refresh);
    return () => window.removeEventListener("canvasClone:courseHomeLayoutChanged", refresh);
  }, [effectiveCourseId, studentView]);

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
    <div className="border-b border-arc-ink/10">
      <div className="px-5 py-4 border-b border-arc-ink/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="megaphone" size={16} className="text-arc-mute" />
          <div className="text-sm font-semibold text-arc-ink">
            Announcements
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (!courseId) return;
              navigate(`/courses/${courseId}/announcements/new`, {
                state: { from: location.pathname + location.search },
              });
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-paper text-arc-ink/80"
          >
            + Add
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {recentAnnouncements.length === 0 ? (
          <div className="text-sm text-arc-mute">No announcements yet.</div>
        ) : (
          <div className="space-y-2">
            {recentAnnouncements.map((a) => (
              <div
                key={a.id}
                className="border border-arc-line bg-arc-ivory overflow-hidden"
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
                      "bg-arc-ivory hover:bg-arc-paper transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-blue-200",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold text-arc-ink truncate">
                      {a.title}
                    </div>
                    <div className="text-xs text-arc-mute mt-0.5">
                      {new Date(a.publishedAt ?? a.postedAt).toLocaleString()}
                    </div>

                    {a.body ? (
                      <div className="mt-3 text-sm text-arc-ink/80 whitespace-pre-wrap line-clamp-3">
                        {announcementPreview(a.body, 500).text}
                      </div>
                    ) : null}
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => {
                        persistAnnouncements(
                          announcements.filter((x) => x.id !== a.id),
                        );
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-brick/10 text-sm text-arc-brick"
                    >
                      <Icon name="trash" size={16} />
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
    <div className="border-b border-arc-ink/10">
      <div className="px-5 py-4 border-b border-arc-ink/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="clipboard" size={16} className="text-arc-mute" />
          <div className="text-sm font-semibold text-arc-ink">
            Upcoming Assignments
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => requestInstructorAction("assignment", "Choose a course for this assignment")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-paper text-arc-ink/80"
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
            className="mb-2 text-xs text-arc-copper hover:underline"
          >
            View all assignments →
          </button>
        )}
        {upcomingAssignments.length === 0 ? (
          <div className="text-sm text-arc-mute">No upcoming assignments.</div>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-arc-line px-3 py-2 bg-arc-ivory"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-arc-ink truncate">
                    {a.title}
                  </div>
                  <div className="text-xs text-arc-mute">
                    {a.dueAt
                      ? `Due ${new Date(a.dueAt).toLocaleString()}`
                      : "No due date"}
                    {typeof a.points === "number" ? ` • ${a.points} pts` : ""}
                  </div>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => {
                      persistAssignments(
                        assignments.filter((x) => x.id !== a.id),
                      );
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-brick/10 text-sm text-arc-brick"
                  >
                    <Icon name="trash" size={16} />
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
    <div className="space-y-10">
      <PageIdentityHeader
          size="lg"
          titleAs="h1"
          icon="book"
          label={course.code || course.short_name || "Course"}
          title={course.title}
          description={
            [course.term, course.short_name && course.short_name !== course.code ? course.short_name : null]
              .filter(Boolean)
              .join(" · ")
          }
          badge={
            courseId ? (
              <StudentSectionBadge courseId={courseId} studentView={studentView} />
            ) : undefined
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canPublishCourse && courseId && (
                <CoursePublishControl courseId={courseId} variant="icon" />
              )}
              {canManageCourse && courseId && (
                <Tooltip label="Course settings">
                  <Link
                    to={`/courses/${courseId}/settings`}
                    aria-label="Course settings"
                    className="inline-flex h-9 w-9 items-center justify-center border border-arc-line bg-arc-ivory text-arc-ink transition hover:bg-arc-paper"
                  >
                    <Icon name="settings" size={16} />
                  </Link>
                </Tooltip>
              )}
              {canEditPages && (
                <button
                  type="button"
                  onClick={() => {
                    if (!courseId) return;
                    navigate(`/courses/${courseId}/pages/${HOME_PAGE_ID}`);
                  }}
                  className="px-3 py-2 text-sm font-medium rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-paper text-arc-ink/80"
                >
                  Edit Home Page
                </button>
              )}
            </div>
          }
        />

      <div className="h-px bg-arc-ink/10" />

      {hasHomeContent ? (
        <div className="border border-arc-line bg-arc-ivory">
          <div className="px-8 py-10 sm:px-10 sm:py-12">
            <RichContentViewer
              html={homeContent}
              courseId={courseId}
              spacing="loose"
              className="[&>:first-child]:mt-0 [&_p:first-of-type]:text-[17px] [&_p:first-of-type]:leading-8"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {navListVisible("modules") && (
          <div className="border border-arc-line bg-arc-ivory p-5">
            <div className="text-sm text-arc-mute">Modules</div>
            <div className="mt-1 text-2xl font-semibold text-arc-ink">
              {modules.length}
            </div>
            <div className="text-xs text-arc-mute mt-1">
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
          <div className="border border-arc-line bg-arc-ivory p-5">
            <div className="text-sm text-arc-mute">Pages</div>
            <div className="mt-1 text-2xl font-semibold text-arc-ink">
              {pages.length}
            </div>
            <div className="text-xs text-arc-mute mt-1">
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
          <div className="border border-arc-line bg-arc-ivory p-5">
            <div className="text-sm text-arc-mute">Files</div>
            <div className="mt-1 text-2xl font-semibold text-arc-ink">
              {files.length}
            </div>
            <div className="text-xs text-arc-mute mt-1">
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

  const visibleWidgets = homeLayout.widgets.filter((id) => !homeLayout.hidden.includes(id));

  const renderHomeWidget = (id: CourseHomeWidgetId) => {
    switch (id) {
      case "deskRituals":
        return <DeskRitualsWidget courseId={effectiveCourseId} />;
      case "instructorTools":
        if (!canEdit) return null;
        return (
          <div className="border-b border-arc-ink/10 pb-5">
            <h3 className="font-display text-lg font-medium italic text-arc-ink">Instructor tools</h3>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => requestInstructorAction("announcement", "Choose a course for this announcement")}
                className="w-full flex items-center justify-center gap-2 btn-canvas-secondary"
              >
                <Icon name="megaphone" size={16} />
                Add Announcement
              </button>
              <button
                type="button"
                onClick={() => requestInstructorAction("assignment", "Choose a course for this assignment")}
                className="w-full flex items-center justify-center gap-2 btn-canvas-secondary"
              >
                <Icon name="plus" size={16} />
                Add Assignment
              </button>
              <button
                type="button"
                onClick={() => requestInstructorAction("editHome", "Choose a course to edit home page")}
                className="w-full flex items-center justify-center gap-2 btn-canvas-primary"
              >
                Edit Home Page
              </button>
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="w-full flex items-center justify-center gap-2 btn-canvas-secondary"
              >
                <Icon name="customize" size={16} />
                Customize sidebar
              </button>
            </div>
          </div>
        );
      case "announcements":
        return AnnouncementsCard;
      case "upcomingAssignments":
        return AssignmentsCard;
      case "grades":
        return (
          <GradesWidget courseId={effectiveCourseId} showGradesLink={navListVisible("grades")} />
        );
      case "needsGrading":
        return <NeedsGradingWidget courseId={effectiveCourseId} />;
      case "recentDiscussions":
        if (recentDiscussions.length === 0) return null;
        return (
          <WidgetCard title="Recent Discussions">
            <div className="space-y-2">
              {recentDiscussions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}/discussions/${t.id}`)}
                  className="block w-full text-left text-sm text-arc-ink hover:text-arc-copper"
                >
                  <Icon name="chat" size={14} className="mr-1 inline" />
                  {t.title}
                </button>
              ))}
            </div>
            {navListVisible("discussions") && (
              <button
                type="button"
                onClick={() => navigate(`/courses/${courseId}/discussions`)}
                className="mt-2 text-xs text-arc-copper hover:underline"
              >
                View all →
              </button>
            )}
          </WidgetCard>
        );
      case "todo":
        return <CourseTodoWidget courseId={effectiveCourseId} studentView={studentView} />;
      case "comingUp":
        return (
          <WidgetCard title="Coming Up">
            {comingUpItems.length === 0 ? (
              <div className="text-sm text-arc-mute">No upcoming items.</div>
            ) : (
              <div className="space-y-2">
                {comingUpItems.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => navigate(e.path)}
                    className="block w-full text-left text-sm hover:bg-arc-paper px-1 py-0.5 -mx-1"
                  >
                    <div className="font-semibold text-arc-ink truncate">{e.title}</div>
                    <div className="text-xs text-arc-mute">
                      {e.type === "quiz" ? "Quiz · " : e.type === "todo" ? "To-do · " : e.type === "appointment" ? "Appointment · " : ""}
                      {e.type === "appointment" ? e.date.toLocaleString() : `Due ${e.date.toLocaleString()}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </WidgetCard>
        );
      case "recentFiles":
        return (
          <div className="border-b border-arc-ink/10">
            <div className="px-5 py-4 border-b border-arc-ink/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-arc-ink">Recent Files</div>
                <div className="text-xs text-arc-mute">Latest uploads</div>
              </div>
              {navListVisible("files") && (
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}/files`)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-arc-line bg-arc-ivory hover:bg-arc-paper text-arc-ink/80"
                >
                  View all
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-200">
              {recentFiles.length === 0 ? (
                <div className="px-5 py-4 text-sm text-arc-mute bg-gray-50">No files uploaded yet.</div>
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
                        <div className="text-sm font-semibold text-arc-ink truncate">
                          {f.name}
                        </div>
                        <div className="text-xs text-arc-mute">
                          {new Date(f.uploadedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-xs text-arc-mute flex-shrink-0">
                        {formatBytes(f.size)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      case "courseLinks":
        return (
          <WidgetCard title="Course Links">
            <div className="space-y-1">
              {(
                [
                  ["discussions", "Discussions →"],
                  ["assignments", "Assignments →"],
                  ["syllabus", "Syllabus →"],
                  ["grades", "Grades →"],
                  ["modules", "Modules →"],
                  ["pages", "Pages →"],
                  ["files", "Files →"],
                  ["announcements", "Announcements →"],
                  ["people", "People →"],
                  ["attendance", "Attendance →"],
                  ["collaborations", "Collaborations →"],
                ] as const
              )
                .filter(([navId]) => navListVisible(navId))
                .map(([navId, label]) => (
                  <button
                    key={navId}
                    type="button"
                    className="w-full rounded-md border-0 bg-transparent px-3 py-2 text-left text-sm text-arc-ink/80 shadow-none hover:bg-gray-50 focus:outline-none focus:ring-0"
                    onClick={() => navigate(`/courses/${courseId}/${navId}`)}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </WidgetCard>
        );
      default:
        return null;
    }
  };

  const RightSidebar = (
    <div className="space-y-4">
      {visibleWidgets.map((id) => {
        const node = renderHomeWidget(id);
        if (!node) return null;
        return <div key={id}>{node}</div>;
      })}
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col bg-arc-paper">
      <div className="flex-1 overflow-y-auto px-8 py-10 lg:px-12 lg:py-12">
        <div className="w-full">
          <div className="grid grid-cols-12 gap-8 xl:gap-10">
            <div className="col-span-12 lg:col-span-8">{CenterArea}</div>
            <div className="col-span-12 lg:col-span-4">{RightSidebar}</div>
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

      {customizerOpen && (
        <CourseHomeCustomizer
          courseId={effectiveCourseId}
          studentView={studentView}
          widgets={homeLayout.widgets}
          hidden={homeLayout.hidden}
          onClose={() => setCustomizerOpen(false)}
          onChange={() =>
            setHomeLayout(loadCourseHomeLayout(effectiveCourseId, studentView))
          }
        />
      )}
    </div>
  );
}
