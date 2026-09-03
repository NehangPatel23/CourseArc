/**
 * CSCI 570 (Analysis of Algorithms) demo content.
 *
 * Seed-owned ids (`cs570_*` and known lecture pages) are upserted so richer
 * semester copy replaces the short first draft. User-created rows with other
 * ids are kept. Empty browsers (Vercel) get the full 15-week set.
 */

import { loadAnnouncements, saveAnnouncements } from "./announcements";
import { ensureDemoAppointmentGroup } from "./appointmentGroups";
import type { AssignmentSubmission } from "./assignmentSubmissions";
import { loadAssignments, saveAssignments } from "./assignments";
import { loadAttendanceSessions, saveAttendanceSessions } from "./attendance";
import { upsertCustomCalendarEvent } from "./calendarCustomEvents";
import { loadCollaborations, saveCollaborations, type Collaboration } from "./collaborations";
import { addRosterMember, loadRoster } from "./courseRoster";
import {
  getCourseById,
  loadCourses,
  saveCourses,
  type AssignmentGroup,
  type Course,
} from "./coursesStore";
import { loadCourseTodos } from "./courseTodos";
import { ensureDemoRoster } from "./demoPersona";
import { loadTopics, saveReplies, saveTopics, type DiscussionReply, type DiscussionTopic } from "./discussions";
import { saveDueDateOverrides, loadDueDateOverrides } from "./dueDateOverrides";
import { idbPutBlob, loadFilesMeta, saveFilesMeta } from "./files";
import { setGradeExcused } from "./excusedGrades";
import { setAllGradesPublished } from "./gradeVisibility";
import { loadGroupSets, saveGroupSets } from "./groupSets";
import { loadGroupSpace, replaceGroupSpace } from "./groupSpaces";
import { sendInboxMessage } from "./inbox";
import {
  DEFAULT_MODULES,
  loadModulesFromStorage,
  moduleItemIdentity,
  saveModulesToStorage,
  type Item,
  type ModuleT,
} from "./modules";
import { loadPeerReviews } from "./peerReviews";
import { pageStorageKey } from "./pageStorage";
import { setQuizAccommodation } from "./quizAccommodations";
import { loadQuizAttempts, saveQuizAttempts, type QuizAttempt } from "./quizSubmissions";
import { quizFileStorageKey } from "./quizFileAnswers";
import { mergeAuditEntries, type AuditEntry } from "./auditLog";
import { loadQuizzes, saveQuizzes } from "./quizzes";
import { loadRubricLibrary, saveRubricLibrary } from "./rubricLibrary";
import { loadSyllabus, replaceSyllabus } from "./syllabus";
import type { RubricCriterionDef } from "./assignmentRubric";
import {
  CS570_EX,
  CS570_HW,
  CS570_ID,
  CS570_QZ,
  cs570Ago,
  cs570Announcements,
  cs570Assignments,
  cs570Day,
  cs570FileSpecs,
  cs570Modules as semesterModules,
  cs570Pages,
  cs570Quizzes,
  cs570Replies,
  cs570SyllabusHtml,
  cs570Topics,
} from "../data/cs570SemesterContent";

export const CS570_COURSE_ID = CS570_ID;

const HW = CS570_HW;
const QZ = CS570_QZ;
const EX = CS570_EX;
const PT = "ag_cs570_part";

const EXTRA_STUDENTS: { id: string; name: string; email: string }[] = [
  { id: "demo_casey", name: "Casey Wong", email: "casey.wong@example.edu" },
  { id: "demo_riley", name: "Riley Patel", email: "riley.patel@example.edu" },
  { id: "demo_morgan", name: "Morgan Blake", email: "morgan.blake@example.edu" },
  { id: "demo_priya", name: "Priya Shah", email: "priya.shah@example.edu" },
];

function dayMs(daysFromNow: number, hour = 23, minute = 59) {
  return cs570Day(daysFromNow, hour, minute);
}

function ago(days: number) {
  return cs570Ago(days);
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  const extra = incoming.filter((row) => !seen.has(row.id));
  if (extra.length === 0) return existing;
  return [...existing, ...extra];
}

/** Overwrite rows that share a seed id; append missing seed rows; keep extra user rows. */
function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingById = new Map(incoming.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of existing) {
    out.push(incomingById.get(row.id) ?? row);
    seen.add(row.id);
  }
  for (const row of incoming) {
    if (!seen.has(row.id)) out.push(row);
  }
  return out;
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown, eventName?: string) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    if (eventName) window.dispatchEvent(new Event(eventName));
  } catch {}
}

function criterion(
  id: string,
  title: string,
  points: number,
  description: string,
): RubricCriterionDef {
  return {
    id,
    title,
    description,
    longDescription: description,
    points,
    ratings: [
      { id: `${id}-full`, label: "Excellent", points },
      { id: `${id}-good`, label: "Proficient", points: Math.round(points * 0.8) },
      { id: `${id}-partial`, label: "Developing", points: Math.round(points * 0.55) },
      { id: `${id}-min`, label: "Beginning", points: Math.round(points * 0.25) },
      { id: `${id}-none`, label: "Missing", points: 0 },
    ],
  };
}

function assignmentGroups(): AssignmentGroup[] {
  return [
    { id: HW, name: "Homework", weight: 35 },
    { id: QZ, name: "Quizzes", weight: 15 },
    { id: EX, name: "Exams", weight: 40 },
    { id: PT, name: "Participation", weight: 10 },
  ];
}

function normModuleTitle(title: string) {
  return title.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

function itemsMatch(a: Item, b: Item): boolean {
  if (a.label === b.label) return true;
  const ia = moduleItemIdentity(a);
  const ib = moduleItemIdentity(b);
  return !ia.startsWith("label:") && ia === ib;
}

const DEFAULT_JUNK_LABELS = new Set([
  "Start Here",
  "Start here",
  "Syllabus.pdf",
  "ExampleProblems.docx",
  "Supplementary Reading",
  "Lecture Slides",
  "Learning Materials",
]);

/** Keep one row per seed item (prefer existing edits); drop duplicate copies. */
function mergeModuleItems(existingItems: Item[], seedItems: Item[]): Item[] {
  const unused = [...existingItems];
  const merged = seedItems.map((sit) => {
    let kept: Item | undefined;
    for (let i = 0; i < unused.length; ) {
      if (itemsMatch(unused[i], sit)) {
        const [removed] = unused.splice(i, 1);
        if (!kept) kept = removed;
      } else {
        i += 1;
      }
    }
    return kept ?? sit;
  });

  const extras: Item[] = [];
  const seenExtra = new Set<string>();
  for (const it of unused) {
    if (DEFAULT_JUNK_LABELS.has(it.label)) continue;
    if (seedItems.some((sit) => itemsMatch(it, sit))) continue;
    const key = moduleItemIdentity(it);
    if (seenExtra.has(key) || seenExtra.has(`label:${it.label}`)) continue;
    seenExtra.add(key);
    seenExtra.add(`label:${it.label}`);
    extras.push(it);
  }
  return [...merged, ...extras];
}

function mergeModules(existing: ModuleT[], incoming: ModuleT[]): ModuleT[] {
  const incomingByNorm = new Map(incoming.map((m) => [normModuleTitle(m.title), m]));
  const staleTitle = (title: string) =>
    /Week\s+\d+\s*[–-]\s*\d+|Week\s+\d+\+/.test(title) &&
    !incomingByNorm.has(normModuleTitle(title));

  const groups = new Map<string, ModuleT[]>();
  const groupOrder: string[] = [];
  for (const m of existing) {
    if (staleTitle(m.title)) continue;
    const k = normModuleTitle(m.title);
    if (!groups.has(k)) groupOrder.push(k);
    const g = groups.get(k) ?? [];
    g.push(m);
    groups.set(k, g);
  }

  const out: ModuleT[] = [];
  const usedNorm = new Set<string>();
  for (const k of groupOrder) {
    const group = groups.get(k) ?? [];
    if (group.length === 0) continue;
    usedNorm.add(k);
    const seed = incomingByNorm.get(k);
    const first = group[0];
    if (!seed) {
      out.push(first);
      continue;
    }
    const allItems = group.flatMap((g) => g.items);
    out.push({
      ...first,
      title: seed.title,
      items: mergeModuleItems(allItems, seed.items),
      requirementsMode: seed.requirementsMode ?? first.requirementsMode,
      accessRule: seed.accessRule ?? first.accessRule,
    });
  }

  for (const seed of incoming) {
    const k = normModuleTitle(seed.title);
    if (!usedNorm.has(k)) out.push(seed);
  }
  return out;
}

function patchSeedGroupIds(courseId: string) {
  const assignments = loadAssignments(courseId).map((a) => {
    if (a.groupId) return a;
    if (a.id === `seed_major1_${courseId}` || a.id === `seed_lab_${courseId}`) {
      return { ...a, groupId: HW };
    }
    if (a.id === `seed_draft_${courseId}`) return { ...a, groupId: EX };
    return a;
  });
  saveAssignments(courseId, assignments);

  const quizzes = loadQuizzes(courseId).map((q) => {
    if (q.groupId) return q;
    if (q.id.startsWith("seed_quiz")) return { ...q, groupId: QZ };
    return q;
  });
  saveQuizzes(courseId, quizzes);
}

function seedCourseMeta() {
  const courses = loadCourses(true);
  const next = courses.map((c) => {
    if (c.id !== CS570_COURSE_ID) return c;
    const patch: Partial<Course> = {};
    if (!c.assignmentGroups?.length) {
      patch.assignmentGroups = assignmentGroups();
      patch.weightedGrading = true;
      patch.showGroupSubtotals = true;
    }
    if (c.monacoCodeEditor === undefined) patch.monacoCodeEditor = true;
    if (Object.keys(patch).length === 0) return c;
    return { ...c, ...patch, updated_at: c.updated_at };
  });
  if (JSON.stringify(next) !== JSON.stringify(courses)) saveCourses(next);
}

function seedPages() {
  const indexKey = `canvasClone:pagesIndex:${CS570_COURSE_ID}`;
  const index = lsGet<{ id: string; title: string; updatedAt: number }[]>(indexKey, []);
  const byId = new Map(index.map((e) => [e.id, e]));
  for (const page of cs570Pages()) {
    const key = pageStorageKey(CS570_COURSE_ID, page.id);
    window.localStorage.setItem(
      key,
      JSON.stringify({ title: page.title, content: page.content }),
    );
    byId.set(page.id, { id: page.id, title: page.title, updatedAt: Date.now() });
  }
  lsSet(indexKey, [...byId.values()], "canvasClone:pagesIndexChanged");
  window.dispatchEvent(new Event("canvasClone:pageContentChanged"));
}

function seedSyllabus() {
  const current = loadSyllabus(CS570_COURSE_ID);
  const ours =
    current.content.includes("CSCI 570 — Analysis of Algorithms") ||
    current.content.includes("Welcome to this course. This syllabus is the course-level overview") ||
    !current.content.trim();
  if (!ours) return;
  replaceSyllabus(CS570_COURSE_ID, {
    ...current,
    content: cs570SyllabusHtml(),
    showCourseSummary: true,
    showTeachingTeam: true,
    showGrading: true,
    showOfficeHours: true,
    updatedAt: Date.now(),
  });
}

function seedDiscussions() {
  const topics = upsertById(loadTopics(CS570_COURSE_ID), cs570Topics());
  saveTopics(CS570_COURSE_ID, topics);
  const store = lsGet<{ topics: DiscussionTopic[]; replies: DiscussionReply[] }>(
    `canvasClone:discussions:${CS570_COURSE_ID}`,
    { topics, replies: [] },
  );
  saveReplies(CS570_COURSE_ID, upsertById(store.replies ?? [], cs570Replies()));
}

function seedParticipations() {
  const key = `canvasClone:discussionParticipations:${CS570_COURSE_ID}`;
  const existing = lsGet<{ id: string }[]>(key, []);
  const incoming = [
    {
      id: "cs570_part_alex_week",
      topicId: "cs570_disc_algo_week",
      studentId: "demo_alex",
      studentName: "Alex Chen",
      replyCount: 1,
      firstPostedAt: ago(2),
      status: "graded" as const,
      score: 23,
      gradedAt: ago(1),
      gradedBy: "Nehang Patel",
    },
    {
      id: "cs570_part_sam_week",
      topicId: "cs570_disc_algo_week",
      studentId: "demo_sam",
      studentName: "Sam Rivera",
      replyCount: 1,
      firstPostedAt: ago(1),
      status: "submitted" as const,
    },
    {
      id: "cs570_part_casey_week",
      topicId: "cs570_disc_algo_week",
      studentId: "demo_casey",
      studentName: "Casey Wong",
      replyCount: 1,
      firstPostedAt: ago(1.2),
      status: "graded" as const,
      score: 22,
      gradedAt: ago(0.8),
      gradedBy: "Taylor Kim",
    },
    {
      id: "cs570_part_priya_dp",
      topicId: "cs570_disc_dp",
      studentId: "demo_priya",
      studentName: "Priya Shah",
      replyCount: 1,
      firstPostedAt: ago(0.6),
      status: "submitted" as const,
    },
  ];
  lsSet(key, upsertById(existing, incoming), "canvasClone:discussionParticipationsChanged");
}

function seedSubmissions() {
  const key = `canvasClone:assignmentSubmissions:${CS570_COURSE_ID}`;
  loadAssignments(CS570_COURSE_ID);
  const existing = lsGet<AssignmentSubmission[]>(key, []);
  const ps1 = `cs570_ps1_${CS570_COURSE_ID}`;
  const ps2 = `cs570_ps2_${CS570_COURSE_ID}`;
  const ps4 = `cs570_ps4_${CS570_COURSE_ID}`;
  const proj1 = `cs570_proj1_${CS570_COURSE_ID}`;
  const project = `cs570_project_${CS570_COURSE_ID}`;
  const midterm = `cs570_midterm_${CS570_COURSE_ID}`;
  const incoming: AssignmentSubmission[] = [
    {
      id: "cs570_sub_ps1_alex",
      courseId: CS570_COURSE_ID,
      assignmentId: ps1,
      studentId: "demo_alex",
      studentName: "Alex Chen",
      body: "<p>Attached: tight bounds for all three recurrences and a substitution proof for merge-sort style divide-and-conquer.</p>",
      fileName: "Chen-PS1.pdf",
      fileSize: 420_000,
      submittedAt: dayMs(-1, 20, 10),
      status: "graded",
      score: 94,
      gradedAt: Date.now() - 3600000,
      gradedBy: "Nehang Patel",
      feedback: "Clear Master Theorem cases. Tighten the induction hypothesis in problem 3.",
    },
    {
      id: "cs570_sub_ps1_sam",
      courseId: CS570_COURSE_ID,
      assignmentId: ps1,
      studentId: "demo_sam",
      studentName: "Sam Rivera",
      body: "<p>Sorry this is late — recursion tree for T(n)=T(n-1)+n is in the PDF.</p>",
      fileName: "Rivera-PS1-late.pdf",
      fileSize: 380_000,
      submittedAt: dayMs(5, 1, 12),
      status: "submitted",
      late: true,
    },
    {
      id: "cs570_sub_ps1_casey",
      courseId: CS570_COURSE_ID,
      assignmentId: ps1,
      studentId: "demo_casey",
      studentName: "Casey Wong",
      fileName: "Wong-PS1.pdf",
      fileSize: 510_000,
      submittedAt: dayMs(-2, 18, 0),
      status: "graded",
      score: 88,
      gradedAt: ago(0.5),
      gradedBy: "Taylor Kim",
    },
    {
      id: "cs570_sub_ps1_riley",
      courseId: CS570_COURSE_ID,
      assignmentId: ps1,
      studentId: "demo_riley",
      studentName: "Riley Patel",
      fileName: "Patel-PS1.pdf",
      fileSize: 290_000,
      submittedAt: dayMs(-3, 16, 40),
      status: "submitted",
    },
    {
      id: "cs570_sub_proj_alex",
      courseId: CS570_COURSE_ID,
      assignmentId: project,
      studentId: "demo_alex",
      studentName: "Alex Chen",
      fileName: "dijkstra-alex.zip",
      fileSize: 1_200_000,
      submittedAt: ago(0.2),
      status: "submitted",
    },
    {
      id: "cs570_sub_proj_priya",
      courseId: CS570_COURSE_ID,
      assignmentId: project,
      studentId: "demo_priya",
      studentName: "Priya Shah",
      fileName: "shortest-paths-priya.zip",
      fileSize: 980_000,
      submittedAt: ago(0.4),
      status: "submitted",
    },
    {
      id: "cs570_sub_ps2_alex",
      courseId: CS570_COURSE_ID,
      assignmentId: ps2,
      studentId: "demo_alex",
      studentName: "Alex Chen",
      fileName: "Chen-PS2.pdf",
      fileSize: 610_000,
      submittedAt: dayMs(-44, 21, 0),
      status: "graded",
      score: 91,
      gradedAt: dayMs(-40),
      gradedBy: "Nehang Patel",
      feedback: "Closest-pair packing argument is clean. Mention the O(n log² n) variant if you re-sort the strip.",
    },
    {
      id: "cs570_sub_ps2_priya",
      courseId: CS570_COURSE_ID,
      assignmentId: ps2,
      studentId: "demo_priya",
      studentName: "Priya Shah",
      fileName: "Shah-PS2.pdf",
      fileSize: 540_000,
      submittedAt: dayMs(-43, 19, 30),
      status: "graded",
      score: 97,
      gradedAt: dayMs(-39),
      gradedBy: "Taylor Kim",
    },
    {
      id: "cs570_sub_ps4_casey",
      courseId: CS570_COURSE_ID,
      assignmentId: ps4,
      studentId: "demo_casey",
      studentName: "Casey Wong",
      fileName: "Wong-PS4.pdf",
      fileSize: 470_000,
      submittedAt: dayMs(-15, 22, 10),
      status: "graded",
      score: 86,
      gradedAt: dayMs(-12),
      gradedBy: "Taylor Kim",
      feedback: "Huffman tree is correct. The knapsack counterexample needs explicit weights.",
    },
    {
      id: "cs570_sub_proj1_morgan",
      courseId: CS570_COURSE_ID,
      assignmentId: proj1,
      studentId: "demo_morgan",
      studentName: "Morgan Blake",
      fileName: "blake-sorting.zip",
      fileSize: 2_100_000,
      submittedAt: dayMs(-22, 18, 0),
      status: "graded",
      score: 74,
      gradedAt: dayMs(-18),
      gradedBy: "Nehang Patel",
      feedback: "Timing table is there. The write-up never explains why insertion sort wins on sorted input.",
    },
    {
      id: "cs570_sub_mid_alex",
      courseId: CS570_COURSE_ID,
      assignmentId: midterm,
      studentId: "demo_alex",
      studentName: "Alex Chen",
      submittedAt: dayMs(-3, 15, 50),
      status: "graded",
      score: 138,
      gradedAt: dayMs(-2),
      gradedBy: "Nehang Patel",
    },
    {
      id: "cs570_sub_mid_jordan",
      courseId: CS570_COURSE_ID,
      assignmentId: midterm,
      studentId: "demo_jordan",
      studentName: "Jordan Lee",
      submittedAt: dayMs(-3, 16, 20),
      status: "graded",
      score: 102,
      gradedAt: dayMs(-2),
      gradedBy: "Nehang Patel",
    },
  ];
  const merged = upsertById(existing, incoming);
  lsSet(key, merged, "canvasClone:assignmentSubmissionsChanged");
}

function quizAttempt(
  id: string,
  quizId: string,
  studentId: string,
  studentName: string,
  score: number,
  maxScore: number,
  submittedOffsetDays: number,
  answers: QuizAttempt["answers"],
): QuizAttempt {
  return {
    id,
    quizId,
    studentId,
    studentName,
    attemptNumber: 1,
    answers,
    score,
    maxScore,
    autoGraded: true,
    submittedAt: ago(submittedOffsetDays),
  };
}

function seedAttempts() {
  const quizzes = cs570Quizzes();
  const quizId = `cs570_quiz_asym_${CS570_COURSE_ID}`;
  const greedyId = `cs570_quiz_greedy_${CS570_COURSE_ID}`;
  const graphsId = `cs570_quiz_graphs_${CS570_COURSE_ID}`;
  const q1Max = quizzes.find((q) => q.id === quizId)?.points ?? 22;
  const q4Max = quizzes.find((q) => q.id === greedyId)?.points ?? 22;
  const q5Max = quizzes.find((q) => q.id === graphsId)?.points ?? 27;
  const existing = loadQuizAttempts(CS570_COURSE_ID);
  const incoming: QuizAttempt[] = [
    quizAttempt("cs570_att_alex", quizId, "demo_alex", "Alex Chen", 18, q1Max, 48, [
      { questionId: "cs570_q1_bs", choiceIndex: 1 },
      { questionId: "cs570_q1_merge", trueFalse: true },
      { questionId: "cs570_q1_master", choiceIndex: 1 },
      { questionId: "cs570_q1_hash", shortAnswer: "Θ(1)" },
      { questionId: "cs570_q1_heap", number: 4 },
      { questionId: "cs570_q1_insert", choiceIndex: 1 },
      { questionId: "cs570_q1_littleo", trueFalse: true },
      { questionId: "cs570_q1_case3", shortAnswer: "case 3" },
    ]),
    quizAttempt("cs570_att_sam", quizId, "demo_sam", "Sam Rivera", 11, q1Max, 47, [
      { questionId: "cs570_q1_bs", choiceIndex: 0 },
      { questionId: "cs570_q1_merge", trueFalse: true },
      { questionId: "cs570_q1_master", choiceIndex: 1 },
      { questionId: "cs570_q1_hash", shortAnswer: "O(n)" },
      { questionId: "cs570_q1_heap", number: 5 },
      { questionId: "cs570_q1_insert", choiceIndex: 3 },
      { questionId: "cs570_q1_littleo", trueFalse: true },
      { questionId: "cs570_q1_case3", shortAnswer: "case 2" },
    ]),
    quizAttempt("cs570_att_casey", quizId, "demo_casey", "Casey Wong", 16, q1Max, 49, [
      { questionId: "cs570_q1_bs", choiceIndex: 1 },
      { questionId: "cs570_q1_merge", trueFalse: true },
      { questionId: "cs570_q1_master", choiceIndex: 1 },
      { questionId: "cs570_q1_hash", shortAnswer: "O(1)" },
      { questionId: "cs570_q1_heap", number: 4 },
      { questionId: "cs570_q1_insert", choiceIndex: 1 },
      { questionId: "cs570_q1_littleo", trueFalse: true },
      { questionId: "cs570_q1_case3", shortAnswer: "case 3" },
    ]),
    quizAttempt("cs570_att_riley", quizId, "demo_riley", "Riley Patel", 13, q1Max, 48, [
      { questionId: "cs570_q1_bs", choiceIndex: 1 },
      { questionId: "cs570_q1_merge", trueFalse: false },
      { questionId: "cs570_q1_master", choiceIndex: 0 },
      { questionId: "cs570_q1_hash", shortAnswer: "Θ(1)" },
      { questionId: "cs570_q1_heap", number: 4 },
      { questionId: "cs570_q1_insert", choiceIndex: 1 },
      { questionId: "cs570_q1_littleo", trueFalse: false },
      { questionId: "cs570_q1_case3", shortAnswer: "case 3" },
    ]),
    quizAttempt("cs570_att_priya", quizId, "demo_priya", "Priya Shah", 20, q1Max, 50, [
      { questionId: "cs570_q1_bs", choiceIndex: 1 },
      { questionId: "cs570_q1_merge", trueFalse: true },
      { questionId: "cs570_q1_master", choiceIndex: 1 },
      { questionId: "cs570_q1_hash", shortAnswer: "Θ(1)" },
      { questionId: "cs570_q1_heap", number: 4 },
      { questionId: "cs570_q1_insert", choiceIndex: 1 },
      { questionId: "cs570_q1_littleo", trueFalse: true },
      { questionId: "cs570_q1_case3", shortAnswer: "case 3" },
    ]),
    quizAttempt("cs570_att_morgan", quizId, "demo_morgan", "Morgan Blake", 8, q1Max, 46, [
      { questionId: "cs570_q1_bs", choiceIndex: 2 },
      { questionId: "cs570_q1_merge", trueFalse: true },
      { questionId: "cs570_q1_master", choiceIndex: 3 },
      { questionId: "cs570_q1_hash", shortAnswer: "log n" },
      { questionId: "cs570_q1_heap", number: 3 },
      { questionId: "cs570_q1_insert", choiceIndex: 0 },
      { questionId: "cs570_q1_littleo", trueFalse: true },
      { questionId: "cs570_q1_case3", shortAnswer: "case 1" },
    ]),
    quizAttempt("cs570_att_g_alex", greedyId, "demo_alex", "Alex Chen", 16, q4Max, 8, [
      { questionId: "cs570_q4_int", choiceIndex: 1 },
      { questionId: "cs570_q4_knap", trueFalse: false },
      { questionId: "cs570_q4_huff", shortAnswer: "prefix" },
      { questionId: "cs570_q4_proof", choiceIndex: 1 },
      { questionId: "cs570_q4_frac", trueFalse: true },
    ]),
    quizAttempt("cs570_att_g_priya", greedyId, "demo_priya", "Priya Shah", 20, q4Max, 9, [
      { questionId: "cs570_q4_int", choiceIndex: 1 },
      { questionId: "cs570_q4_knap", trueFalse: false },
      { questionId: "cs570_q4_huff", shortAnswer: "prefix-free" },
      { questionId: "cs570_q4_proof", choiceIndex: 1 },
      { questionId: "cs570_q4_frac", trueFalse: true },
    ]),
    quizAttempt("cs570_att_g_sam", greedyId, "demo_sam", "Sam Rivera", 10, q4Max, 6, [
      { questionId: "cs570_q4_int", choiceIndex: 0 },
      { questionId: "cs570_q4_knap", trueFalse: true },
      { questionId: "cs570_q4_huff", shortAnswer: "huffman" },
      { questionId: "cs570_q4_proof", choiceIndex: 0 },
      { questionId: "cs570_q4_frac", trueFalse: true },
    ]),
    quizAttempt("cs570_att_gph_alex", graphsId, "demo_alex", "Alex Chen", 18, q5Max, 3, [
      { questionId: "cs570_q5_bfs", choiceIndex: 1 },
      { questionId: "cs570_q5_dijneg", trueFalse: false },
      { questionId: "cs570_q5_mst", choiceIndices: [0, 1] },
      { questionId: "cs570_q5_topo", shortAnswer: "topological sort" },
      { questionId: "cs570_q5_cross", trueFalse: false },
      {
        questionId: "cs570_q5_upload",
        fileName: "bfs-tree-alex.txt",
        fileSize: 128,
        fileMime: "text/plain",
        fileStorageKey: quizFileStorageKey({
          courseId: CS570_COURSE_ID,
          quizId: graphsId,
          studentId: "demo_alex",
          questionId: "cs570_q5_upload",
        }),
      },
    ]),
    quizAttempt("cs570_att_gph_priya", graphsId, "demo_priya", "Priya Shah", 20, q5Max, 3, [
      { questionId: "cs570_q5_bfs", choiceIndex: 1 },
      { questionId: "cs570_q5_dijneg", trueFalse: false },
      {
        questionId: "cs570_q5_upload",
        fileName: "bfs-tree-priya.txt",
        fileSize: 142,
        fileMime: "text/plain",
        fileStorageKey: quizFileStorageKey({
          courseId: CS570_COURSE_ID,
          quizId: graphsId,
          studentId: "demo_priya",
          questionId: "cs570_q5_upload",
        }),
      },
    ]),
  ];
  saveQuizAttempts(CS570_COURSE_ID, upsertById(existing, incoming));
}

async function seedFiles() {
  const existing = loadFilesMeta(CS570_COURSE_ID);
  const byId = new Map(existing.map((f) => [f.id, f]));
  const metas = [...existing];
  for (const file of cs570FileSpecs()) {
    const blob = new Blob([file.text], { type: "text/plain" });
    await idbPutBlob(`${CS570_COURSE_ID}:${file.id}`, blob);
    const prev = byId.get(file.id);
    if (prev) {
      const idx = metas.findIndex((m) => m.id === file.id);
      metas[idx] = {
        ...prev,
        name: file.name,
        size: blob.size,
        mime: "text/plain",
        moduleTitles: [...new Set([...(prev.moduleTitles ?? []), file.module])],
      };
    } else {
      const meta = {
        id: file.id,
        name: file.name,
        size: blob.size,
        mime: "text/plain",
        uploadedAt: ago(6),
        moduleTitles: [file.module],
      };
      metas.push(meta);
      byId.set(file.id, meta);
    }
  }
  saveFilesMeta(CS570_COURSE_ID, metas);
}

function seedPeopleExtras() {
  ensureDemoRoster(CS570_COURSE_ID);
  for (const s of EXTRA_STUDENTS) {
    if (loadRoster(CS570_COURSE_ID).some((m) => m.id === s.id)) continue;
    addRosterMember(CS570_COURSE_ID, { ...s, role: "student", id: s.id });
  }
  const acc = window.localStorage.getItem(`canvasClone:quizAccommodations:${CS570_COURSE_ID}`);
  if (!acc || acc === "{}") {
    setQuizAccommodation(CS570_COURSE_ID, {
      studentId: "demo_jordan",
      extraMinutes: 15,
      timeMultiplier: 1.5,
      note: "Extended time (demo) — 1.5× plus 15 minutes on all quizzes.",
    });
    setQuizAccommodation(CS570_COURSE_ID, {
      studentId: "demo_casey",
      extraAttempts: 1,
      note: "One extra quiz attempt (demo).",
    });
  }
}

function seedAttendance() {
  const rosterIds = loadRoster(CS570_COURSE_ID)
    .filter((m) => m.role === "student")
    .map((m) => m.id);
  const pattern = (offset: number, absent: string[], late: string[]) => {
    const records: Record<string, "present" | "absent" | "late" | "excused"> = {};
    for (const id of rosterIds) {
      if (absent.includes(id)) records[id] = "absent";
      else if (late.includes(id)) records[id] = "late";
      else if (id === "demo_jordan" && offset === 2) records[id] = "excused";
      else records[id] = "present";
    }
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    return {
      id: `cs570_att_${iso}`,
      date: iso,
      title: "Lecture",
      records,
      createdAt: d.getTime(),
    };
  };
  const incoming = [
    pattern(49, ["demo_jordan"], []),
    pattern(42, [], ["demo_sam"]),
    pattern(35, ["demo_morgan"], []),
    pattern(28, [], ["demo_riley"]),
    pattern(21, ["demo_casey"], ["demo_sam"]),
    pattern(14, [], []),
    pattern(7, ["demo_jordan"], ["demo_sam"]),
    pattern(5, [], ["demo_morgan"]),
    pattern(2, ["demo_riley"], []),
  ];
  saveAttendanceSessions(
    CS570_COURSE_ID,
    upsertById(loadAttendanceSessions(CS570_COURSE_ID), incoming),
  );
}

function seedCollaborations() {
  const rows: Collaboration[] = [
    {
      id: "cs570_collab_notes",
      kind: "document",
      title: "Shared proof workshop notes",
      url: "https://docs.google.com/document/d/demo-cs570-notes",
      notes: "Collaborative notes from recitation. Do not paste graded solutions.",
      createdBy: "Nehang Patel",
      createdById: "1",
      createdAt: ago(8),
    },
    {
      id: "cs570_collab_zoom",
      kind: "conference",
      title: "Wednesday problem-solving Zoom",
      url: "https://zoom.us/j/570570570",
      notes: "Optional group problem session, 7–8pm.",
      startsAt: dayMs(1, 19, 0),
      createdBy: "Taylor Kim",
      createdById: "demo_ta",
      createdAt: ago(3),
    },
    {
      id: "cs570_collab_overleaf",
      kind: "document",
      title: "LaTeX template for problem sets",
      url: "https://www.overleaf.com/read/cs570-ps-template",
      notes: "Use the macros for Θ, recurrences, and algorithm environments.",
      createdBy: "Taylor Kim",
      createdById: "demo_ta",
      createdAt: ago(40),
    },
  ];
  saveCollaborations(CS570_COURSE_ID, upsertById(loadCollaborations(CS570_COURSE_ID), rows));
}

function seedCalendar() {
  const events = [
    {
      id: "cs570_cal_lecture",
      title: "CSCI 570 lecture",
      description: "Analysis of Algorithms — lecture.",
      location: "SAL 101",
      startAt: dayMs(1, 14, 0),
      endAt: dayMs(1, 15, 20),
      courseId: CS570_COURSE_ID,
      recurrence: { freq: "weekly" as const, until: dayMs(90), interval: 1 },
    },
    {
      id: "cs570_cal_midterm",
      title: "CSCI 570 midterm",
      description: "In class, closed book, one handwritten sheet. SAL 101.",
      location: "SAL 101",
      startAt: dayMs(-3, 14, 0),
      endAt: dayMs(-3, 15, 20),
      courseId: CS570_COURSE_ID,
    },
    {
      id: "cs570_cal_recitation",
      title: "CSCI 570 recitation",
      description: "TA-led problem session. Bring a draft of the current problem set.",
      location: "SAL 109",
      startAt: dayMs(3, 16, 0),
      endAt: dayMs(3, 16, 50),
      courseId: CS570_COURSE_ID,
      recurrence: { freq: "weekly" as const, until: dayMs(80), interval: 1 },
    },
    {
      id: "cs570_cal_final",
      title: "CSCI 570 final exam",
      description: "Cumulative final, two handwritten sheets, 120 minutes.",
      location: "SAL 101",
      startAt: dayMs(84, 14, 0),
      endAt: dayMs(84, 16, 0),
      courseId: CS570_COURSE_ID,
    },
  ];
  for (const e of events) {
    upsertCustomCalendarEvent(e);
  }
}

function seedTodos() {
  const key = `canvasClone:courseTodos:${CS570_COURSE_ID}`;
  const existing = lsGet<{ id: string }[]>(key, []);
  const incoming = [
    {
      id: "cs570_todo_grade_ps1",
      courseId: CS570_COURSE_ID,
      ownerId: "1",
      scope: "course" as const,
      title: "Finish grading Problem Set 1",
      body: "Riley’s submission is still ungraded.",
      dueAt: dayMs(1, 17, 0),
      completed: false,
      createdAt: ago(1),
    },
    {
      id: "cs570_todo_recitation",
      courseId: CS570_COURSE_ID,
      ownerId: "1",
      scope: "course" as const,
      title: "Prep recitation: Master Theorem edge cases",
      dueAt: dayMs(2, 12, 0),
      completed: false,
      createdAt: ago(0.5),
    },
  ];
  const merged = mergeById(existing, incoming);
  if (merged.length !== existing.length) lsSet(key, merged, "canvasClone:courseTodosChanged");
  void loadCourseTodos(CS570_COURSE_ID);
}

function seedInbox() {
  try {
    const raw = window.localStorage.getItem("canvasClone:inbox");
    const parsed = raw ? (JSON.parse(raw) as { threadId?: string }[]) : [];
    const has = (id: string) => Array.isArray(parsed) && parsed.some((m) => m.threadId === id);
    if (!has("cs570_thread_ps2")) {
      sendInboxMessage({
        threadId: "cs570_thread_ps2",
        from: "Alex Chen",
        fromUserId: "demo_alex",
        to: [{ id: "1", name: "Nehang Patel", role: "instructor" }],
        subject: "PS2 closest-pair hint?",
        body: "For the closest-pair divide step, do we need to sort the strip by y at every level or can we merge like mergesort?",
        courseId: CS570_COURSE_ID,
        kind: "direct",
      });
    }
    if (!has("cs570_thread_midterm")) {
      sendInboxMessage({
        threadId: "cs570_thread_midterm",
        from: "Nehang Patel",
        fromUserId: "1",
        to: [{ id: "demo_jordan", name: "Jordan Lee", role: "student" }],
        subject: "Midterm accommodations",
        body: "Jordan — your 1.5× time is already on the quiz accommodations list and will apply to the timed midterm practice quiz as well. Email me if you need a quieter room.",
        courseId: CS570_COURSE_ID,
        kind: "direct",
      });
    }
  } catch {}
}

function seedOverrides() {
  const existing = loadDueDateOverrides(CS570_COURSE_ID);
  if (existing.some((o) => o.id === "cs570_ddo_jordan_ps1")) return;
  saveDueDateOverrides(CS570_COURSE_ID, [
    ...existing,
    {
      id: "cs570_ddo_jordan_ps1",
      itemKind: "assignment",
      itemId: `cs570_ps1_${CS570_COURSE_ID}`,
      targetKind: "student",
      targetId: "demo_jordan",
      dueAt: dayMs(9),
    },
  ]);
}

function seedGroupsAndSpaces() {
  const sets = loadGroupSets(CS570_COURSE_ID);
  const studentIds = loadRoster(CS570_COURSE_ID)
    .filter((m) => m.role === "student")
    .map((m) => m.id);
  const assigned = new Set(sets.flatMap((s) => s.groups.flatMap((g) => g.studentIds)));
  const unassigned = studentIds.filter((id) => !assigned.has(id));
  if (unassigned.length && sets[0]?.groups.length) {
    const next = sets.map((set, i) => {
      if (i !== 0) return set;
      const groups = set.groups.map((g, gi) =>
        gi === set.groups.length - 1 ? { ...g, studentIds: [...g.studentIds, ...unassigned] } : g,
      );
      return { ...set, groups };
    });
    saveGroupSets(CS570_COURSE_ID, next);
  }
  const groupId = `grp_${CS570_COURSE_ID}_a`;
  const space = loadGroupSpace(CS570_COURSE_ID, groupId);
  if (space.announcements.length === 0 && space.posts.length === 0) {
    replaceGroupSpace(CS570_COURSE_ID, groupId, {
      announcements: [
        {
          id: "cs570_gann_kickoff",
          title: "Project kickoff",
          body: "Let’s freeze the graph file format by Friday so Dijkstra and Bellman–Ford share a parser.",
          authorId: "demo_alex",
          author: "Alex Chen",
          createdAt: ago(2),
        },
      ],
      posts: [
        {
          id: "cs570_gpost_1",
          body: "I can take the binary heap for Dijkstra if someone else owns the write-up.",
          authorId: "demo_alex",
          author: "Alex Chen",
          createdAt: ago(2),
        },
        {
          id: "cs570_gpost_2",
          body: "I’ll draft the README and the runtime table.",
          authorId: "demo_priya",
          author: "Priya Shah",
          createdAt: ago(1),
        },
      ],
      files: [],
    });
  }
}

function seedPeerReviews() {
  const key = `canvasClone:peerReviews:${CS570_COURSE_ID}`;
  const existing = loadPeerReviews(CS570_COURSE_ID);
  const incoming = [
    {
      id: "cs570_pr_alex_priya",
      assignmentId: `cs570_project_${CS570_COURSE_ID}`,
      reviewerId: "demo_alex",
      revieweeId: "demo_priya",
      score: 4,
      comment: "Clear README. Consider documenting the decrease-key choice.",
      submittedAt: ago(0.1),
    },
  ];
  const merged = mergeById(existing, incoming);
  if (merged.length !== existing.length) {
    lsSet(key, merged, "canvasClone:peerReviewsChanged");
  }
}

function seedRubrics() {
  const rows = loadRubricLibrary(CS570_COURSE_ID);
  if (rows.some((r) => r.id === `rub_${CS570_COURSE_ID}_algorithms`)) return;
  saveRubricLibrary(CS570_COURSE_ID, [
    {
      id: `rub_${CS570_COURSE_ID}_algorithms`,
      title: "Algorithms write-up",
      updatedAt: Date.now(),
      criteria: [
        criterion("alg-correct", "Correctness", 40, "Proof or invariant covers the claim."),
        criterion("alg-runtime", "Runtime analysis", 30, "Tight bound with justification."),
        criterion("alg-clarity", "Clarity", 20, "Readable proofs and pseudocode."),
        criterion("alg-style", "Presentation", 10, "Notation, figures, citations."),
      ],
    },
    ...rows,
  ]);
}

function seedGradesVisibility() {
  try {
    if (window.localStorage.getItem(`canvasClone:gradePublish:${CS570_COURSE_ID}`)) return;
  } catch {
    return;
  }
  setAllGradesPublished(CS570_COURSE_ID, true);
}

function seedNotifications() {
  const key = "canvasClone:notifications";
  const existing = lsGet<{ id: string }[]>(key, []);
  const incoming = [
    {
      id: "cs570_n_ps1",
      kind: "assignment_due" as const,
      audience: "student" as const,
      title: "PS1 due soon",
      body: "Problem Set 1: Asymptotics & Recurrences is due this week.",
      unread: true,
      courseId: CS570_COURSE_ID,
      href: `/courses/${CS570_COURSE_ID}/assignments/cs570_ps1_${CS570_COURSE_ID}`,
      timestamp: ago(0.3),
    },
    {
      id: "cs570_n_sub",
      kind: "submission_received" as const,
      audience: "instructor" as const,
      title: "New PS1 submission",
      body: "Riley Patel submitted Problem Set 1.",
      unread: true,
      courseId: CS570_COURSE_ID,
      href: `/courses/${CS570_COURSE_ID}/assignments/cs570_ps1_${CS570_COURSE_ID}/grade`,
      timestamp: ago(0.2),
    },
  ];
  const merged = mergeById(existing, incoming);
  if (merged.length !== existing.length) lsSet(key, merged, "canvasClone:notificationsChanged");
}

function seedExcused() {
  setGradeExcused(CS570_COURSE_ID, `assignment:seed_lab_${CS570_COURSE_ID}`, "demo_jordan", true);
}

async function seedQuizUploadFiles() {
  const graphsId = `cs570_quiz_graphs_${CS570_COURSE_ID}`;
  const samples: { studentId: string; name: string; body: string }[] = [
    {
      studentId: "demo_alex",
      name: "bfs-tree-alex.txt",
      body: "BFS tree from s:\ns — a (d=1)\ns — b (d=1)\na — c (d=2)\nb — d (d=2)\nc — t (d=3)\n",
    },
    {
      studentId: "demo_priya",
      name: "bfs-tree-priya.txt",
      body: "BFS from s (layers):\n0: s\n1: a, b\n2: c, d\n3: t\nTree edges: s-a, s-b, a-c, b-d, c-t\n",
    },
  ];
  for (const sample of samples) {
    const key = quizFileStorageKey({
      courseId: CS570_COURSE_ID,
      quizId: graphsId,
      studentId: sample.studentId,
      questionId: "cs570_q5_upload",
    });
    await idbPutBlob(key, new Blob([sample.body], { type: "text/plain" }));
  }
}

function seedAuditLog() {
  const hrefQuiz = `/courses/${CS570_COURSE_ID}/quizzes/cs570_quiz_asym_${CS570_COURSE_ID}`;
  const hrefGraphs = `/courses/${CS570_COURSE_ID}/quizzes/cs570_quiz_graphs_${CS570_COURSE_ID}`;
  const hrefPs1 = `/courses/${CS570_COURSE_ID}/assignments/cs570_ps1_${CS570_COURSE_ID}/grade`;
  const demo: AuditEntry[] = [
    {
      id: "cs570_aud_key1",
      at: ago(12),
      actorId: "1",
      actorName: "Nehang Patel",
      action: "quiz_key_changed",
      courseId: CS570_COURSE_ID,
      summary: "Updated questions or answer keys on “Quiz 1: Asymptotics”",
      detail: "Corrected Master Theorem case-3 accepted answers",
      href: `${hrefQuiz}/edit`,
    },
    {
      id: "cs570_aud_regrade1",
      at: ago(11),
      actorId: "1",
      actorName: "Nehang Patel",
      action: "quiz_regrade",
      courseId: CS570_COURSE_ID,
      summary: "Regraded 6 attempts on “Quiz 1: Asymptotics”",
      detail: "Kept manual overrides",
      href: hrefQuiz,
    },
    {
      id: "cs570_aud_override1",
      at: ago(10),
      actorId: "1",
      actorName: "Nehang Patel",
      action: "quiz_score_override",
      courseId: CS570_COURSE_ID,
      summary: "Overrode quiz attempt score to 18",
      detail: "Alex Chen — Quiz 1 (partial credit on hash-table bound)",
      href: hrefQuiz,
    },
    {
      id: "cs570_aud_asg1",
      at: ago(8),
      actorId: "1",
      actorName: "Nehang Patel",
      action: "assignment_regrade",
      courseId: CS570_COURSE_ID,
      summary: "Graded “Problem Set 1” for Alex Chen (18)",
      href: hrefPs1,
    },
    {
      id: "cs570_aud_upload1",
      at: ago(2),
      actorId: "1",
      actorName: "Nehang Patel",
      action: "quiz_question_score",
      courseId: CS570_COURSE_ID,
      summary: "Saved per-question scores (total 18) on Quiz 5 file-upload",
      detail: "Alex Chen — BFS tree upload",
      href: hrefGraphs,
    },
  ];
  mergeAuditEntries(demo);
}

/** Idempotent merge of CSCI 570 sample data. Safe to call on every app load. */
export function ensureCs570Demo() {
  if (typeof window === "undefined") return;
  const course = getCourseById(CS570_COURSE_ID) ?? loadCourses(true).find((c) => c.id === CS570_COURSE_ID);
  if (!course) return;

  seedCourseMeta();
  seedRubrics();
  saveAssignments(CS570_COURSE_ID, upsertById(loadAssignments(CS570_COURSE_ID), cs570Assignments()));
  saveQuizzes(CS570_COURSE_ID, upsertById(loadQuizzes(CS570_COURSE_ID), cs570Quizzes()));
  patchSeedGroupIds(CS570_COURSE_ID);
  saveAnnouncements(CS570_COURSE_ID, upsertById(loadAnnouncements(CS570_COURSE_ID), cs570Announcements()));
  seedDiscussions();
  seedPages();
  const modules = loadModulesFromStorage();
  const mergedModules = mergeModules(
    modules.length ? modules : DEFAULT_MODULES,
    semesterModules(),
  );
  if (JSON.stringify(mergedModules) !== JSON.stringify(modules)) {
    saveModulesToStorage(mergedModules);
  }
  seedSyllabus();
  seedPeopleExtras();
  seedParticipations();
  seedSubmissions();
  seedAttempts();
  seedAttendance();
  seedCollaborations();
  seedCalendar();
  seedTodos();
  seedInbox();
  seedOverrides();
  seedGroupsAndSpaces();
  seedPeerReviews();
  seedGradesVisibility();
  seedNotifications();
  seedExcused();
  seedAuditLog();
  ensureDemoAppointmentGroup(CS570_COURSE_ID);
  void seedFiles();
  void seedQuizUploadFiles();
}
