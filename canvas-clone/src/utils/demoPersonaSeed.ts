import { loadAssignments } from "./assignments";
import type { AssignmentSubmission } from "./assignmentSubmissions";
import { loadCourses } from "./coursesStore";
import {
  DEMO_TA_PERSONA_ID,
  ensureDemoRoster,
  DEMO_PERSONA_CHANGED_EVENT,
} from "./demoPersona";
import { loadQuizzes } from "./quizzes";
import { sendInboxMessage } from "./inbox";
import { loadAnnouncements, saveAnnouncements } from "./announcements";
import { upsertCustomCalendarEvent } from "./calendarCustomEvents";
import { addPortfolioEntry, loadPortfolioDoc } from "./ePortfolioStore";
import {
  loadQuizAttempts,
  saveQuizAttempts,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  type QuizAttempt,
} from "./quizSubmissions";

const ALEX = "demo_alex";
const JORDAN = "demo_jordan";
const SAM = "demo_sam";
const PERSONA_SUB_PREFIX = "persona_sub_";
const PERSONA_ATTEMPT_PREFIX = "persona_att_";

function submissionsKey(courseId: string) {
  return `canvasClone:assignmentSubmissions:${courseId}`;
}

function loadAllSubs(courseId: string): AssignmentSubmission[] {
  try {
    const raw = window.localStorage.getItem(submissionsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllSubs(courseId: string, items: AssignmentSubmission[]) {
  try {
    window.localStorage.setItem(submissionsKey(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event("canvasClone:assignmentSubmissionsChanged"));
  } catch {}
}

function firstDueAssignment(courseId: string) {
  return loadAssignments(courseId).find((a) => typeof a.dueAt === "number" && (a.published || a.status === "published"));
}

function firstDueQuiz(courseId: string) {
  return loadQuizzes(courseId).find((q) => typeof q.dueAt === "number" && (q.published || q.status === "published"));
}

/**
 * Seed Alex (complete / on time), Jordan (missing), Sam (late) on each course.
 * Does not wipe instructor-authored content.
 */
export function seedPersonaDemoWork() {
  for (const course of loadCourses(true)) {
    ensureDemoRoster(course.id);
    const assignment = firstDueAssignment(course.id);
    const quiz = firstDueQuiz(course.id);

    if (assignment && typeof assignment.dueAt === "number") {
      const existing = loadAllSubs(course.id).filter(
        (s) => !s.id.startsWith(PERSONA_SUB_PREFIX) && s.studentId !== ALEX && s.studentId !== SAM,
      );
      const onTime = assignment.dueAt - 36 * 60 * 60 * 1000;
      const late = assignment.dueAt + 36 * 60 * 60 * 1000;
      const pts = assignment.points ?? 100;
      existing.push(
        {
          id: `${PERSONA_SUB_PREFIX}${course.id}_${assignment.id}_${ALEX}`,
          courseId: course.id,
          assignmentId: assignment.id,
          studentId: ALEX,
          studentName: "Alex Chen",
          body: "<p>Demo on-time submission from Alex.</p>",
          submittedAt: onTime,
          status: "graded",
          score: Math.round(pts * 0.92),
          gradedAt: onTime + 86400000,
        },
        {
          id: `${PERSONA_SUB_PREFIX}${course.id}_${assignment.id}_${SAM}`,
          courseId: course.id,
          assignmentId: assignment.id,
          studentId: SAM,
          studentName: "Sam Rivera",
          body: "<p>Demo late submission from Sam.</p>",
          submittedAt: late,
          status: "submitted",
          late: true,
        },
      );
      saveAllSubs(course.id, existing);
    }

    if (quiz && typeof quiz.dueAt === "number") {
      const existing = loadQuizAttempts(course.id).filter(
        (a) =>
          !a.id.startsWith(PERSONA_ATTEMPT_PREFIX) &&
          a.studentId !== ALEX &&
          a.studentId !== SAM,
      );
      const maxScore = quiz.points ?? 10;
      existing.push({
        id: `${PERSONA_ATTEMPT_PREFIX}${course.id}_${quiz.id}_${ALEX}`,
        quizId: quiz.id,
        studentId: ALEX,
        studentName: "Alex Chen",
        attemptNumber: 1,
        answers: [],
        score: Math.round(maxScore * 0.9),
        maxScore,
        autoGraded: true,
        submittedAt: quiz.dueAt - 24 * 60 * 60 * 1000,
      } satisfies QuizAttempt);
      existing.push({
        id: `${PERSONA_ATTEMPT_PREFIX}${course.id}_${quiz.id}_${SAM}`,
        quizId: quiz.id,
        studentId: SAM,
        studentName: "Sam Rivera",
        attemptNumber: 1,
        answers: [],
        score: Math.round(maxScore * 0.7),
        maxScore,
        autoGraded: true,
        submittedAt: quiz.dueAt + 12 * 60 * 60 * 1000,
      } satisfies QuizAttempt);
      saveQuizAttempts(course.id, existing);
    }
  }
  void DEMO_TA_PERSONA_ID;
  window.dispatchEvent(new Event(QUIZ_ATTEMPTS_CHANGED_EVENT));
  window.dispatchEvent(new Event(DEMO_PERSONA_CHANGED_EVENT));
  seedPersonaWeekStory();
}

function inboxHasThread(threadId: string) {
  try {
    const raw = window.localStorage.getItem("canvasClone:inbox");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { threadId?: string }[];
    return Array.isArray(parsed) && parsed.some((m) => m.threadId === threadId);
  } catch {
    return false;
  }
}

/** Inbox + announcement + calendar + ArcFolio so persona switching tells a week-long story. */
function seedPersonaWeekStory() {
  const course = loadCourses(true).find((c) => c.published) ?? loadCourses(true)[0];
  if (!course) return;

  const instructor = { id: "1", name: "Nehang Patel", role: "instructor" as const };
  const threads = [
    {
      id: "persona_week_jordan",
      to: { id: JORDAN, name: "Jordan Lee", role: "student" as const },
      subject: "Checking in on this week’s work",
      body: "Jordan — I noticed the latest assignment still isn’t in. Come by studio hours if you want to talk it through.",
    },
    {
      id: "persona_week_sam",
      to: { id: SAM, name: "Sam Rivera", role: "student" as const },
      subject: "Late work received",
      body: "Sam — thanks for getting the assignment in. It’s marked late; next time aim for the desk deadline.",
    },
    {
      id: "persona_week_alex",
      to: { id: ALEX, name: "Alex Chen", role: "student" as const },
      subject: "Strong plate this week",
      body: "Alex — the on-time submission looks solid. Consider featuring it on your ArcFolio.",
    },
  ];
  for (const t of threads) {
    if (inboxHasThread(t.id)) continue;
    sendInboxMessage({
      threadId: t.id,
      from: instructor.name,
      fromUserId: instructor.id,
      to: [t.to],
      subject: t.subject,
      body: t.body,
      courseId: course.id,
      kind: "direct",
    });
  }

  const announcementId = "persona_week_announcement";
  const existingAnn = loadAnnouncements(course.id);
  if (!existingAnn.some((a) => a.id === announcementId)) {
    saveAnnouncements(course.id, [
      {
        id: announcementId,
        title: "Studio hours this week",
        body: "<p>Drop in for office hours — bring questions on the current plate. Booked slots show on your desk.</p>",
        postedAt: Date.now(),
        publishedAt: Date.now(),
        status: "published",
      },
      ...existingAnn,
    ]);
  }

  upsertCustomCalendarEvent({
    id: "persona_week_studio",
    title: "Studio hours",
    description: "Drop-in desk time for this week’s work.",
    location: "Atelier",
    startAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
    endAt: Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    courseId: course.id,
    createdBy: instructor.id,
  });

  const alexDoc = loadPortfolioDoc(ALEX);
  if (!alexDoc.entries.some((e) => e.itemId === "persona_week_alex_plate" || e.title === "Week plate — algorithms sketch")) {
    addPortfolioEntry(
      {
        courseId: course.id,
        kind: "external",
        itemId: "persona_week_alex_plate",
        title: "Week plate — algorithms sketch",
        note: "Featured from this week’s on-time assignment.",
        externalType: "link",
        url: "https://example.com/alex-plate",
        description: "A short write-up Alex is proud of.",
      },
      ALEX,
    );
  }
}

const PERSONA_SEED_FLAG = "canvasClone:personaDemoSeeded:v2";

/** Re-seed roster + persona submissions. Leaves instructor-authored content. */
export function resetDemoData() {
  for (const course of loadCourses(true)) {
    ensureDemoRoster(course.id);
  }
  seedPersonaDemoWork();
  try {
    window.localStorage.setItem(PERSONA_SEED_FLAG, "1");
  } catch {}
}

export function ensurePersonaDemoWork() {
  try {
    if (window.localStorage.getItem(PERSONA_SEED_FLAG) === "1") return;
  } catch {}
  resetDemoData();
}
