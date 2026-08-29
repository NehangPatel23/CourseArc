import { loadAssignments } from "./assignments";
import type { AssignmentSubmission } from "./assignmentSubmissions";
import { loadCourses } from "./coursesStore";
import {
  DEMO_TA_PERSONA_ID,
  ensureDemoRoster,
  DEMO_PERSONA_CHANGED_EVENT,
} from "./demoPersona";
import { loadQuizzes } from "./quizzes";
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
  void JORDAN;
  void DEMO_TA_PERSONA_ID;
  window.dispatchEvent(new Event(QUIZ_ATTEMPTS_CHANGED_EVENT));
  window.dispatchEvent(new Event(DEMO_PERSONA_CHANGED_EVENT));
}

const PERSONA_SEED_FLAG = "canvasClone:personaDemoSeeded";

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
