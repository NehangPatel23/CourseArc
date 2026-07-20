import { loadAnnouncements, saveAnnouncements } from "./announcements";
import { loadAssignments, saveAssignments } from "./assignments";
import type { AssignmentSubmission } from "./assignmentSubmissions";
import { clearCourseStorage } from "./courseCleanup";
import type { CourseHomeLayoutPrefs } from "./courseHomeLayout";
import {
  addCourse,
  getCourseById,
  loadCourses,
  saveCourses,
  type Course,
} from "./coursesStore";
import type { CourseTodo } from "./courseTodos";
import type { DiscussionParticipation } from "./discussionParticipations";
import type { DiscussionReply, DiscussionTopic } from "./discussions";
import { loadFilesMeta, saveFilesMeta, type StoredFileMeta } from "./files";
import {
  loadGradePublishState,
  type CourseGradePublishState,
} from "./gradeVisibility";
import {
  loadModulesFromStorage,
  saveModulesToStorage,
  type ModuleT,
} from "./modules";
import { loadProgress, saveProgress, type ProgressState } from "./progress";
import type { QuizProgress } from "./quizProgress";
import { loadQuizzes, saveQuizzes } from "./quizzes";
import type { QuizAttempt } from "./quizSubmissions";
import { loadRoster, type RosterMember } from "./courseRoster";

export type CoursePackage = {
  version: 1;
  exportedAt: string;
  course: Course;
  modules: ModuleT[];
  pagesIndex: string[];
  pages: Record<string, string>;
  assignments: ReturnType<typeof loadAssignments>;
  quizzes: ReturnType<typeof loadQuizzes>;
  announcements: ReturnType<typeof loadAnnouncements>;
  discussions: { topics: DiscussionTopic[]; replies: DiscussionReply[] };
  filesMeta: StoredFileMeta[];
  roster: RosterMember[];
  assignmentSubmissions: AssignmentSubmission[];
  quizAttempts: QuizAttempt[];
  quizProgress: Record<string, QuizProgress>;
  discussionParticipations: DiscussionParticipation[];
  progress: ProgressState;
  gradePublish: CourseGradePublishState;
  courseTodos?: CourseTodo[];
  courseHomeLayouts?: {
    student: CourseHomeLayoutPrefs;
    instructor: CourseHomeLayoutPrefs;
  };
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function pagesIndexKey(courseId: string) {
  return `canvasClone:pagesIndex:${courseId}`;
}

function pageKey(courseId: string, pageId: string) {
  return `canvasClone:page:${courseId}:${pageId}`;
}

function modulesForCourse(courseId: string): ModuleT[] {
  const all = loadModulesFromStorage();
  const owned = all.filter((mod) =>
    mod.items.some((it) => it.ownerCourseId === courseId),
  );
  if (owned.length > 0) return owned;
  // Legacy shared modules (no ownerCourseId) — include for primary demo course.
  if (courseId === "1") {
    return all.filter((mod) =>
      mod.items.every((it) => !it.ownerCourseId || it.ownerCourseId === courseId),
    );
  }
  return [];
}

function rewriteModuleOwners(modules: ModuleT[], courseId: string): ModuleT[] {
  return modules.map((mod) => ({
    ...mod,
    items: mod.items.map((it) =>
      it.type === "assignment" ||
      it.type === "quiz" ||
      it.type === "discussion" ||
      it.type === "page" ||
      it.type === "file"
        ? { ...it, ownerCourseId: courseId }
        : it,
    ),
  }));
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function exportCoursePackage(courseId: string): CoursePackage | null {
  const course = getCourseById(courseId);
  if (!course) return null;

  const pagesIndex = lsGet<string[]>(pagesIndexKey(courseId), []);
  const pages: Record<string, string> = {};
  for (const pageId of pagesIndex) {
    try {
      const content = window.localStorage.getItem(pageKey(courseId, pageId));
      if (content != null) pages[pageId] = content;
    } catch {}
  }

  const discussions = lsGet<{ topics: DiscussionTopic[]; replies: DiscussionReply[] }>(
    `canvasClone:discussions:${courseId}`,
    { topics: [], replies: [] },
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    course,
    modules: modulesForCourse(courseId),
    pagesIndex,
    pages,
    assignments: loadAssignments(courseId),
    quizzes: loadQuizzes(courseId),
    announcements: loadAnnouncements(courseId),
    discussions,
    filesMeta: loadFilesMeta(courseId),
    roster: loadRoster(courseId),
    assignmentSubmissions: lsGet(`canvasClone:assignmentSubmissions:${courseId}`, []),
    quizAttempts: lsGet(`canvasClone:quizAttempts:${courseId}`, []),
    quizProgress: lsGet(`canvasClone:quizProgress:${courseId}`, {}),
    discussionParticipations: lsGet(
      `canvasClone:discussionParticipations:${courseId}`,
      [],
    ),
    progress: loadProgress(courseId),
    gradePublish: loadGradePublishState(courseId),
    courseTodos: lsGet(`canvasClone:courseTodos:${courseId}`, []),
    courseHomeLayouts: {
      student: lsGet(`canvasClone:courseHomeLayout:${courseId}:student`, {
        widgets: [],
        hidden: [],
      }),
      instructor: lsGet(`canvasClone:courseHomeLayout:${courseId}:instructor`, {
        widgets: [],
        hidden: [],
      }),
    },
  };
}

export function downloadCoursePackage(courseId: string): boolean {
  const pkg = exportCoursePackage(courseId);
  if (!pkg) return false;
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pkg.course.code || pkg.course.id}-package.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function parseCoursePackage(raw: unknown): CoursePackage | null {
  if (!raw || typeof raw !== "object") return null;
  const pkg = raw as Partial<CoursePackage>;
  if (pkg.version !== 1 || !pkg.course?.id) return null;
  return pkg as CoursePackage;
}

function writeCourseContent(courseId: string, pkg: CoursePackage) {
  lsSet(pagesIndexKey(courseId), pkg.pagesIndex ?? []);
  for (const [pageId, content] of Object.entries(pkg.pages ?? {})) {
    try {
      window.localStorage.setItem(pageKey(courseId, pageId), content);
    } catch {}
  }

  saveAssignments(courseId, pkg.assignments ?? []);
  saveQuizzes(courseId, pkg.quizzes ?? []);
  saveAnnouncements(courseId, pkg.announcements ?? []);
  saveFilesMeta(courseId, pkg.filesMeta ?? []);
  lsSet(`canvasClone:discussions:${courseId}`, pkg.discussions ?? { topics: [], replies: [] });
  lsSet(`canvasClone:courseRoster:${courseId}`, pkg.roster ?? []);
  lsSet(
    `canvasClone:assignmentSubmissions:${courseId}`,
    (pkg.assignmentSubmissions ?? []).map((s) => ({ ...s, courseId })),
  );
  lsSet(`canvasClone:quizAttempts:${courseId}`, pkg.quizAttempts ?? []);
  lsSet(`canvasClone:quizProgress:${courseId}`, pkg.quizProgress ?? {});
  lsSet(
    `canvasClone:discussionParticipations:${courseId}`,
    pkg.discussionParticipations ?? [],
  );
  saveProgress(courseId, pkg.progress ?? { modules: {} });
  lsSet(`canvasClone:gradePublish:${courseId}`, pkg.gradePublish ?? {
    allPublished: false,
    columns: {},
    students: {},
    cells: {},
  });
  if (pkg.courseTodos) lsSet(`canvasClone:courseTodos:${courseId}`, pkg.courseTodos);
  if (pkg.courseHomeLayouts?.student) {
    lsSet(`canvasClone:courseHomeLayout:${courseId}:student`, pkg.courseHomeLayouts.student);
  }
  if (pkg.courseHomeLayouts?.instructor) {
    lsSet(
      `canvasClone:courseHomeLayout:${courseId}:instructor`,
      pkg.courseHomeLayouts.instructor,
    );
  }

  const rewritten = rewriteModuleOwners(pkg.modules ?? [], courseId);
  const existing = loadModulesFromStorage().filter(
    (mod) => !mod.items.some((it) => it.ownerCourseId === courseId),
  );
  saveModulesToStorage([...existing, ...rewritten]);
}

function remapPackageForNewCourse(pkg: CoursePackage, newCourseId: string): CoursePackage {
  const idMap = new Map<string, string>();
  const mapId = (oldId: string, prefix: string) => {
    if (!idMap.has(oldId)) idMap.set(oldId, newId(prefix));
    return idMap.get(oldId)!;
  };

  const assignments = (pkg.assignments ?? []).map((a) => ({
    ...a,
    id: mapId(a.id, "asg"),
  }));
  const quizzes = (pkg.quizzes ?? []).map((q) => ({
    ...q,
    id: mapId(q.id, "quiz"),
  }));
  const announcements = (pkg.announcements ?? []).map((a) => ({
    ...a,
    id: mapId(a.id, "ann"),
  }));
  const topics = (pkg.discussions?.topics ?? []).map((t) => ({
    ...t,
    id: mapId(t.id, "topic"),
  }));
  const replies = (pkg.discussions?.replies ?? []).map((r) => ({
    ...r,
    id: mapId(r.id, "reply"),
    topicId: idMap.get(r.topicId) ?? r.topicId,
    parentReplyId: r.parentReplyId ? idMap.get(r.parentReplyId) ?? r.parentReplyId : undefined,
  }));

  const pagesIndex = (pkg.pagesIndex ?? []).map((id) => mapId(id, "page"));
  const pages: Record<string, string> = {};
  for (const [oldId, content] of Object.entries(pkg.pages ?? {})) {
    pages[idMap.get(oldId) ?? oldId] = content;
  }

  const filesMeta = (pkg.filesMeta ?? []).map((f) => ({
    ...f,
    id: mapId(f.id, "file"),
  }));

  const remapItemId = (id?: string) => {
    if (!id) return id;
    return idMap.get(id) ?? id;
  };

  const modules = (pkg.modules ?? []).map((mod) => ({
    ...mod,
    items: mod.items.map((it) => ({
      ...it,
      ownerCourseId: newCourseId,
      pageId: it.pageId ? remapItemId(it.pageId) : it.pageId,
      fileId: it.fileId ? remapItemId(it.fileId) : it.fileId,
      assignmentId: it.assignmentId ? remapItemId(it.assignmentId) : it.assignmentId,
      quizId: it.quizId ? remapItemId(it.quizId) : it.quizId,
      discussionId: it.discussionId ? remapItemId(it.discussionId) : it.discussionId,
    })),
  }));

  const assignmentSubmissions = (pkg.assignmentSubmissions ?? []).map((s) => ({
    ...s,
    id: newId("sub"),
    courseId: newCourseId,
    assignmentId: idMap.get(s.assignmentId) ?? s.assignmentId,
  }));

  const quizAttempts = (pkg.quizAttempts ?? []).map((a) => ({
    ...a,
    id: newId("attempt"),
    quizId: idMap.get(a.quizId) ?? a.quizId,
  }));

  const quizProgress: Record<string, QuizProgress> = {};
  for (const [key, value] of Object.entries(pkg.quizProgress ?? {})) {
    const [quizId, studentId] = key.split(":");
    const nextQuizId = idMap.get(quizId) ?? quizId;
    quizProgress[`${nextQuizId}:${studentId}`] = value;
  }

  const discussionParticipations = (pkg.discussionParticipations ?? []).map((p) => ({
    ...p,
    id: newId("part"),
    topicId: idMap.get(p.topicId) ?? p.topicId,
  }));

  return {
    ...pkg,
    course: {
      ...pkg.course,
      id: newCourseId,
      title: `${pkg.course.title} (Imported)`,
      code: `${pkg.course.code}-IMP`,
    },
    modules,
    pagesIndex,
    pages,
    assignments,
    quizzes,
    announcements,
    discussions: { topics, replies },
    filesMeta,
    assignmentSubmissions,
    quizAttempts,
    quizProgress,
    discussionParticipations,
    courseTodos: (pkg.courseTodos ?? []).map((t) => ({
      ...t,
      id: newId("todo"),
      courseId: newCourseId,
    })),
  };
}

export function importCoursePackage(
  pkg: CoursePackage,
  options: { mode: "new" | "replace" },
): string | null {
  if (pkg.version !== 1 || !pkg.course) return null;

  if (options.mode === "replace") {
    const courseId = pkg.course.id;
    if (!getCourseById(courseId)) return null;
    clearCourseStorage(courseId);
    const courses = loadCourses(true).map((c) =>
      c.id === courseId ? { ...pkg.course, id: courseId } : c,
    );
    saveCourses(courses);
    writeCourseContent(courseId, { ...pkg, course: { ...pkg.course, id: courseId } });
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
    return courseId;
  }

  const newCourseId = addCourse({
    title: `${pkg.course.title} (Imported)`,
    code: `${pkg.course.code}-IMP`,
    short_name: pkg.course.short_name,
    term: pkg.course.term,
    color: pkg.course.color,
    published: false,
  });
  const remapped = remapPackageForNewCourse(pkg, newCourseId);
  writeCourseContent(newCourseId, remapped);
  window.dispatchEvent(new Event("canvasClone:coursesChanged"));
  return newCourseId;
}
