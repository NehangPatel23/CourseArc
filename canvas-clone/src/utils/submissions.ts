import { loadCourses } from "./coursesStore";
import { loadAssignments } from "./assignments";

export type Submission = {
  id: string;
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  student: string;
  submittedAt: number;
  status: "pending" | "graded";
  grade?: string;
};

const SUBMISSIONS_KEY = "canvasClone:submissions";

function readAll(): Submission[] {
  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return seedFromAssignments();
    const parsed = JSON.parse(raw) as Submission[];
    return Array.isArray(parsed) ? parsed : seedFromAssignments();
  } catch {
    return seedFromAssignments();
  }
}

function seedFromAssignments(): Submission[] {
  const out: Submission[] = [];
  for (const c of loadCourses()) {
    for (const a of loadAssignments(c.id)) {
      if (a.published !== false) {
        out.push({
          id: `sub-${c.id}-${a.id}`,
          courseId: c.id,
          assignmentId: a.id,
          assignmentTitle: a.title,
          student: "Alex Chen",
          submittedAt: Date.now() - 86400000,
          status: "pending",
        });
      }
    }
  }
  return out;
}

function saveAll(items: Submission[]) {
  try {
    window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("canvasClone:submissionsChanged"));
  } catch {}
}

export function loadSubmissions(): Submission[] {
  return readAll();
}

export function getPendingSubmissions(): Submission[] {
  return readAll().filter((s) => s.status === "pending");
}

export function markSubmissionGraded(id: string) {
  saveAll(
    readAll().map((s) => (s.id === id ? { ...s, status: "graded" as const, grade: "A-" } : s)),
  );
}
