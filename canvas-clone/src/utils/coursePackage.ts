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
import { loadQuizzes, saveQuizzes, normalizeQuizBankPool } from "./quizzes";
import type { QuizAttempt } from "./quizSubmissions";
import { loadRoster, type RosterMember } from "./courseRoster";
import {
  exportStoredQuestionBanks,
  importQuestionBanksFromPackage,
  type QuestionBank,
} from "./questionBanks";
import { loadPeerReviews, replacePeerReviews, type PeerReview } from "./peerReviews";
import {
  listQuizAccommodations,
  importAccommodationsPayload,
  type QuizAccommodation,
} from "./quizAccommodations";
import {
  listQuizRubricTemplates,
  replaceQuizRubricTemplates,
  type QuizRubricTemplate,
} from "./quizRubricTemplates";
import { loadSections, saveSections, type CourseSection } from "./courseSections";
import { loadGroupSets, saveGroupSets, type GroupSet } from "./groupSets";
import { loadSyllabus, replaceSyllabus, type CourseSyllabus } from "./syllabus";
import { loadRubricLibrary, replaceRubricLibrary, type LibraryRubric } from "./rubricLibrary";
import {
  exportInboxForCourse,
  importInboxForCourse,
  type InboxMessage,
} from "./inbox";
import { exportGroupSpaces, importGroupSpaces, type GroupSpace } from "./groupSpaces";
import { loadAttendanceSessions, saveAttendanceSessions, type AttendanceSession } from "./attendance";
import { loadCollaborations, saveCollaborations, type Collaboration } from "./collaborations";
import {
  loadDueDateOverrides,
  saveDueDateOverrides,
  type DueDateOverride,
} from "./dueDateOverrides";
import {
  loadAppointmentGroups,
  upsertAppointmentGroup,
  type AppointmentGroup,
} from "./appointmentGroups";
import {
  listCustomCalendarEvents,
  upsertCustomCalendarEvent,
  type CustomCalendarEvent,
} from "./calendarCustomEvents";

export type CoursePackageVersion = 1 | 2;

export type CoursePackageImportSections = {
  content: boolean;
  roster: boolean;
  grades: boolean;
  banks: boolean;
};

export const DEFAULT_IMPORT_SECTIONS: CoursePackageImportSections = {
  content: true,
  roster: true,
  grades: true,
  banks: true,
};

export type CoursePackage = {
  version: CoursePackageVersion;
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
  questionBanks?: QuestionBank[];
  peerReviews?: PeerReview[];
  quizAccommodations?: QuizAccommodation[];
  quizRubricTemplates?: QuizRubricTemplate[];
  sections?: CourseSection[];
  dueDateOverrides?: DueDateOverride[];
  appointmentGroups?: AppointmentGroup[];
  customCalendarEvents?: CustomCalendarEvent[];
  syllabus?: CourseSyllabus;
  groupSets?: GroupSet[];
  rubricLibrary?: LibraryRubric[];
  inboxMessages?: InboxMessage[];
  groupSpaces?: Record<string, GroupSpace>;
  attendance?: AttendanceSession[];
  collaborations?: Collaboration[];
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
    version: 2,
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
    questionBanks: exportStoredQuestionBanks(courseId),
    peerReviews: loadPeerReviews(courseId),
    quizAccommodations: listQuizAccommodations(courseId),
    quizRubricTemplates: listQuizRubricTemplates(courseId),
    sections: loadSections(courseId),
    dueDateOverrides: loadDueDateOverrides(courseId),
    appointmentGroups: loadAppointmentGroups(courseId),
    customCalendarEvents: listCustomCalendarEvents({ courseId }),
    syllabus: loadSyllabus(courseId),
    groupSets: loadGroupSets(courseId),
    rubricLibrary: loadRubricLibrary(courseId),
    inboxMessages: exportInboxForCourse(courseId),
    groupSpaces: exportGroupSpaces(courseId),
    attendance: loadAttendanceSessions(courseId),
    collaborations: loadCollaborations(courseId),
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
  if ((pkg.version !== 1 && pkg.version !== 2) || !pkg.course?.id) return null;
  return pkg as CoursePackage;
}

function writeCourseContent(
  courseId: string,
  pkg: CoursePackage,
  sections: CoursePackageImportSections = DEFAULT_IMPORT_SECTIONS,
) {
  if (sections.content) {
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

  if (sections.roster) {
    lsSet(`canvasClone:courseRoster:${courseId}`, pkg.roster ?? []);
  }

  if (sections.grades) {
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
  }

  if (sections.banks) {
    importQuestionBanksFromPackage(courseId, pkg.questionBanks ?? []);
    replacePeerReviews(courseId, pkg.peerReviews ?? []);
    importAccommodationsPayload(
      courseId,
      { accommodations: pkg.quizAccommodations ?? [] },
      { replaceAll: true },
    );
    replaceQuizRubricTemplates(courseId, pkg.quizRubricTemplates ?? []);
  }

  if (sections.roster) {
    if (pkg.sections) saveSections(courseId, pkg.sections);
  }
  if (sections.content) {
    if (pkg.dueDateOverrides) saveDueDateOverrides(courseId, pkg.dueDateOverrides);
    if (pkg.appointmentGroups) {
      for (const g of pkg.appointmentGroups) {
        upsertAppointmentGroup({ ...g, courseId });
      }
    }
    if (pkg.customCalendarEvents) {
      for (const e of pkg.customCalendarEvents) {
        upsertCustomCalendarEvent({ ...e, courseId, id: e.id });
      }
    }
    if (pkg.syllabus) replaceSyllabus(courseId, pkg.syllabus);
    if (pkg.groupSets) saveGroupSets(courseId, pkg.groupSets);
    if (pkg.rubricLibrary) replaceRubricLibrary(courseId, pkg.rubricLibrary);
    if (pkg.inboxMessages) importInboxForCourse(courseId, pkg.inboxMessages);
    if (pkg.groupSpaces) importGroupSpaces(courseId, pkg.groupSpaces);
    if (pkg.attendance) saveAttendanceSessions(courseId, pkg.attendance);
    if (pkg.collaborations) saveCollaborations(courseId, pkg.collaborations);
  }
}

export function remapPackageForNewCourse(pkg: CoursePackage, newCourseId: string): CoursePackage {
  const idMap = new Map<string, string>();
  const mapId = (oldId: string, prefix: string) => {
    if (!idMap.has(oldId)) idMap.set(oldId, newId(prefix));
    return idMap.get(oldId)!;
  };

  const assignments = (pkg.assignments ?? []).map((a) => ({
    ...a,
    id: mapId(a.id, "asg"),
  }));
  for (const bank of pkg.questionBanks ?? []) {
    mapId(bank.id, "qb");
  }
  const quizzes = (pkg.quizzes ?? []).map((q) => {
    const nextId = mapId(q.id, "quiz");
    const pool = normalizeQuizBankPool(q.bankPool);
    const remappedPool = pool
      ? {
          ...pool,
          sources: pool.sources.map((s) => ({
            ...s,
            bankId: idMap.get(s.bankId) ?? s.bankId,
          })),
        }
      : q.bankPool;
    return {
      ...q,
      id: nextId,
      bankPool: remappedPool,
    };
  });
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

  const questionBanks = (pkg.questionBanks ?? []).map((b) => ({
    ...b,
    id: mapId(b.id, "qb"),
    courseId: newCourseId,
    sourceBankRef: b.sourceBankRef
      ? {
          ...b.sourceBankRef,
          bankId: idMap.get(b.sourceBankRef.bankId) ?? b.sourceBankRef.bankId,
        }
      : undefined,
  }));

  const peerReviews = (pkg.peerReviews ?? []).map((r) => ({
    ...r,
    id: newId("pr"),
    assignmentId: idMap.get(r.assignmentId) ?? r.assignmentId,
  }));

  const quizAccommodations = (pkg.quizAccommodations ?? []).map((a) => ({
    ...a,
    quizId: a.quizId ? (idMap.get(a.quizId) ?? a.quizId) : undefined,
  }));

  const quizRubricTemplates = (pkg.quizRubricTemplates ?? []).map((t) => ({
    ...t,
    id: newId("qrtrt"),
  }));

  const sectionIdMap = new Map<string, string>();
  const sections = (pkg.sections ?? []).map((s) => {
    const nextId = newId("sec");
    sectionIdMap.set(s.id, nextId);
    return { ...s, id: nextId };
  });

  const remappedModules = modules.map((mod) => ({
    ...mod,
    items: mod.items.map((it) => ({
      ...it,
      assignedSectionIds: it.assignedSectionIds?.map((id) => sectionIdMap.get(id) ?? id),
    })),
  }));

  const dueDateOverrides = (pkg.dueDateOverrides ?? []).map((o) => ({
    ...o,
    id: newId("ddo"),
    itemId: idMap.get(o.itemId) ?? o.itemId,
    targetId:
      o.targetKind === "section" ? (sectionIdMap.get(o.targetId) ?? o.targetId) : o.targetId,
  }));

  const appointmentGroups = (pkg.appointmentGroups ?? []).map((g) => ({
    ...g,
    id: newId("apg"),
    courseId: newCourseId,
    courseIds: (g.courseIds ?? []).filter((id) => id && id !== pkg.course.id),
    slots: g.slots.map((s) => ({
      ...s,
      id: newId("slot"),
      signups: (s.signups ?? []).map((x) => ({ ...x })),
      waitlist: (s.waitlist ?? []).map((x) => ({ ...x })),
    })),
  }));

  const customCalendarEvents = (pkg.customCalendarEvents ?? []).map((e) => ({
    ...e,
    id: newId("cal"),
    courseId: newCourseId,
  }));

  const rubricIdMap = new Map<string, string>();
  const rubricLibrary = (pkg.rubricLibrary ?? []).map((r) => {
    const nextId = newId("rub");
    rubricIdMap.set(r.id, nextId);
    return {
      ...r,
      id: nextId,
      criteria: r.criteria.map((c) => ({ ...c })),
    };
  });

  const groupSetIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  const groupSets = (pkg.groupSets ?? []).map((s) => {
    const nextId = newId("gset");
    groupSetIdMap.set(s.id, nextId);
    return {
      ...s,
      id: nextId,
      groups: s.groups.map((g) => {
        const nextGroupId = newId("grp");
        groupIdMap.set(g.id, nextGroupId);
        return { ...g, id: nextGroupId };
      }),
    };
  });

  const groupSpaces: Record<string, GroupSpace> = {};
  for (const [oldId, space] of Object.entries(pkg.groupSpaces ?? {})) {
    const nextId = groupIdMap.get(oldId) ?? oldId;
    groupSpaces[nextId] = space;
  }

  const threadMap = new Map<string, string>();
  const inboxMessages = (pkg.inboxMessages ?? []).map((m) => {
    const oldThread = m.threadId || m.id;
    if (!threadMap.has(oldThread)) threadMap.set(oldThread, newId("thread"));
    return {
      ...m,
      id: newId("msg"),
      threadId: threadMap.get(oldThread),
      courseId: newCourseId,
    };
  });

  const attendance = (pkg.attendance ?? []).map((s) => ({
    ...s,
    id: newId("att"),
  }));

  const collaborations = (pkg.collaborations ?? []).map((c) => ({
    ...c,
    id: newId("collab"),
  }));

  const remappedAssignments = assignments.map((a) => ({
    ...a,
    rubricId: a.rubricId ? (rubricIdMap.get(a.rubricId) ?? a.rubricId) : undefined,
    groupSetId: a.groupSetId ? (groupSetIdMap.get(a.groupSetId) ?? a.groupSetId) : undefined,
  }));

  const remappedTopics = topics.map((t) => ({
    ...t,
    groupSetId: t.groupSetId ? (groupSetIdMap.get(t.groupSetId) ?? t.groupSetId) : undefined,
  }));

  return {
    ...pkg,
    version: 2,
    course: {
      ...pkg.course,
      id: newCourseId,
      title: `${pkg.course.title} (Imported)`,
      code: `${pkg.course.code}-IMP`,
    },
    modules: remappedModules,
    pagesIndex,
    pages,
    assignments: remappedAssignments,
    quizzes,
    announcements,
    discussions: { topics: remappedTopics, replies },
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
    questionBanks,
    peerReviews,
    quizAccommodations,
    quizRubricTemplates,
    sections,
    dueDateOverrides,
    appointmentGroups,
    customCalendarEvents,
    syllabus: pkg.syllabus,
    groupSets,
    rubricLibrary,
    inboxMessages,
    groupSpaces,
    attendance,
    collaborations,
  };
}

export function importCoursePackage(
  pkg: CoursePackage,
  options: {
    mode: "new" | "replace";
    sections?: CoursePackageImportSections;
  },
): string | null {
  if ((pkg.version !== 1 && pkg.version !== 2) || !pkg.course) return null;
  const sections = options.sections ?? DEFAULT_IMPORT_SECTIONS;
  const anySection = sections.content || sections.roster || sections.grades || sections.banks;
  if (!anySection) return null;

  if (options.mode === "replace") {
    const courseId = pkg.course.id;
    if (!getCourseById(courseId)) return null;
    if (
      sections.content &&
      sections.roster &&
      sections.grades &&
      sections.banks
    ) {
      clearCourseStorage(courseId);
    }
    const courses = loadCourses(true).map((c) =>
      c.id === courseId ? { ...pkg.course, id: courseId } : c,
    );
    saveCourses(courses);
    writeCourseContent(
      courseId,
      { ...pkg, course: { ...pkg.course, id: courseId } },
      sections,
    );
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
  writeCourseContent(newCourseId, remapped, sections);
  window.dispatchEvent(new Event("canvasClone:coursesChanged"));
  return newCourseId;
}
