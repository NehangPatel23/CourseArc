import type { AssignmentSubmission } from "./assignmentSubmissions";
import { isLateSubmission } from "./latePenalty";
import { getAttemptEffectiveScore, type QuizAttempt } from "./quizSubmissions";

export type AttemptSortKey =
  | "newest"
  | "oldest"
  | "score-high"
  | "score-low"
  | "student-az";

export type ScoreBandKey = "all" | "0-49" | "50-69" | "70-89" | "90-100";

export type SubmissionSortKey =
  | "newest"
  | "oldest"
  | "student-az"
  | "score-high"
  | "score-low";

export type SubmissionStatusFilter = "all" | "pending" | "graded" | "late";

export const ATTEMPT_SORT_OPTIONS: { value: AttemptSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "score-high", label: "Highest score" },
  { value: "score-low", label: "Lowest score" },
  { value: "student-az", label: "Student A–Z" },
];

export const SCORE_BAND_OPTIONS: { value: ScoreBandKey; label: string }[] = [
  { value: "all", label: "All scores" },
  { value: "0-49", label: "0–49%" },
  { value: "50-69", label: "50–69%" },
  { value: "70-89", label: "70–89%" },
  { value: "90-100", label: "90–100%" },
];

export const SUBMISSION_SORT_OPTIONS: { value: SubmissionSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "student-az", label: "Student A–Z" },
  { value: "score-high", label: "Highest score" },
  { value: "score-low", label: "Lowest score" },
];

export const SUBMISSION_STATUS_OPTIONS: { value: SubmissionStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Needs grading" },
  { value: "graded", label: "Graded" },
  { value: "late", label: "Late" },
];

export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function attemptPercent(attempt: QuizAttempt): number {
  if (attempt.maxScore <= 0) return 0;
  return Math.round((getAttemptEffectiveScore(attempt) / attempt.maxScore) * 100);
}

export function matchesScoreBand(percent: number, band: ScoreBandKey): boolean {
  switch (band) {
    case "0-49":
      return percent < 50;
    case "50-69":
      return percent >= 50 && percent < 70;
    case "70-89":
      return percent >= 70 && percent < 90;
    case "90-100":
      return percent >= 90;
    default:
      return true;
  }
}

export function latestAttemptPerStudent(attempts: QuizAttempt[]): QuizAttempt[] {
  const byStudent = new Map<string, QuizAttempt>();
  for (const attempt of [...attempts].sort((a, b) => b.submittedAt - a.submittedAt)) {
    if (!byStudent.has(attempt.studentId)) {
      byStudent.set(attempt.studentId, attempt);
    }
  }
  return [...byStudent.values()];
}

export function sortQuizAttempts(
  attempts: QuizAttempt[],
  sort: AttemptSortKey,
): QuizAttempt[] {
  const sorted = [...attempts];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.submittedAt - b.submittedAt);
    case "score-high":
      return sorted.sort(
        (a, b) => getAttemptEffectiveScore(b) - getAttemptEffectiveScore(a),
      );
    case "score-low":
      return sorted.sort(
        (a, b) => getAttemptEffectiveScore(a) - getAttemptEffectiveScore(b),
      );
    case "student-az":
      return sorted.sort((a, b) => a.studentName.localeCompare(b.studentName));
    case "newest":
    default:
      return sorted.sort((a, b) => b.submittedAt - a.submittedAt);
  }
}

export type QuizAttemptFilters = {
  search: string;
  sort: AttemptSortKey;
  scoreBand: ScoreBandKey;
  latestOnly: boolean;
};

export function filterQuizAttempts(
  attempts: QuizAttempt[],
  filters: QuizAttemptFilters,
): QuizAttempt[] {
  let list = filters.latestOnly ? latestAttemptPerStudent(attempts) : [...attempts];

  if (filters.search.trim()) {
    list = list.filter((a) => matchesSearch(a.studentName, filters.search));
  }

  if (filters.scoreBand !== "all") {
    list = list.filter((a) => matchesScoreBand(attemptPercent(a), filters.scoreBand));
  }

  return sortQuizAttempts(list, filters.sort);
}

export function sortNameList<T extends { student?: string; studentName?: string }>(
  rows: T[],
  sort: "student-az" | "student-za",
): T[] {
  const sorted = [...rows];
  const name = (row: T) => row.student ?? row.studentName ?? "";
  if (sort === "student-za") {
    return sorted.sort((a, b) => name(b).localeCompare(name(a)));
  }
  return sorted.sort((a, b) => name(a).localeCompare(name(b)));
}

export function sortAssignmentSubmissions(
  submissions: AssignmentSubmission[],
  sort: SubmissionSortKey,
): AssignmentSubmission[] {
  const sorted = [...submissions];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.submittedAt - b.submittedAt);
    case "student-az":
      return sorted.sort((a, b) => a.studentName.localeCompare(b.studentName));
    case "score-high":
      return sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    case "score-low":
      return sorted.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
    case "newest":
    default:
      return sorted.sort((a, b) => b.submittedAt - a.submittedAt);
  }
}

export type SubmissionListFilters = {
  search: string;
  sort: SubmissionSortKey;
  status: SubmissionStatusFilter;
};

export function filterAssignmentSubmissions(
  submissions: AssignmentSubmission[],
  filters: SubmissionListFilters,
  assignmentDueAt?: number,
): AssignmentSubmission[] {
  let list = [...submissions];

  if (filters.search.trim()) {
    list = list.filter((s) => matchesSearch(s.studentName, filters.search));
  }

  if (filters.status === "pending") {
    list = list.filter((s) => s.status !== "graded");
  } else if (filters.status === "graded") {
    list = list.filter((s) => s.status === "graded");
  } else if (filters.status === "late") {
    list = list.filter((s) => isLateSubmission(s, assignmentDueAt));
  }

  return sortAssignmentSubmissions(list, filters.sort);
}

// ---------------------------------------------------------------------------
// Gradebook filters
// ---------------------------------------------------------------------------

export type GradebookVisibilityFilter = "all" | "posted" | "hidden";

export type GradebookRowLike = {
  studentId: string;
  studentName: string;
  overallPercent: number;
};

export type GradebookRowFilters = {
  search: string;
  sort: "student-az" | "score-high" | "score-low";
  scoreBand: ScoreBandKey;
  visibility: GradebookVisibilityFilter;
};

export const GRADEBOOK_VISIBILITY_OPTIONS: {
  value: GradebookVisibilityFilter;
  label: string;
}[] = [
  { value: "all", label: "All students" },
  { value: "posted", label: "Posted" },
  { value: "hidden", label: "Hidden" },
];

export function filterGradebookRows<T extends GradebookRowLike>(
  rows: T[],
  filters: GradebookRowFilters,
  isVisible: (studentId: string) => boolean,
): T[] {
  let list = [...rows];

  if (filters.search.trim()) {
    list = list.filter((r) => matchesSearch(r.studentName, filters.search));
  }

  if (filters.scoreBand !== "all") {
    list = list.filter((r) => matchesScoreBand(r.overallPercent, filters.scoreBand));
  }

  if (filters.visibility === "posted") {
    list = list.filter((r) => isVisible(r.studentId));
  } else if (filters.visibility === "hidden") {
    list = list.filter((r) => !isVisible(r.studentId));
  }

  if (filters.sort === "score-high") {
    list.sort((a, b) => b.overallPercent - a.overallPercent);
  } else if (filters.sort === "score-low") {
    list.sort((a, b) => a.overallPercent - b.overallPercent);
  } else {
    list.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  return list;
}

export type StudentGradeColumnKind = "assignment" | "quiz" | "discussion";

export type StudentGradeColumnLike = {
  id: string;
  title: string;
  kind: StudentGradeColumnKind;
  score: number | null;
  gradesVisible?: boolean;
};

export type StudentGradeColumnFilters = {
  search: string;
  sort: "title-az" | "score-high" | "score-low";
  typeFilter: "all" | StudentGradeColumnKind;
  status: "all" | "graded" | "ungraded" | "hidden";
};

export const STUDENT_GRADE_TYPE_OPTIONS: {
  value: StudentGradeColumnFilters["typeFilter"];
  label: string;
}[] = [
  { value: "all", label: "All types" },
  { value: "assignment", label: "Assignments" },
  { value: "quiz", label: "Quizzes" },
  { value: "discussion", label: "Discussions" },
];

export const STUDENT_GRADE_STATUS_OPTIONS: {
  value: StudentGradeColumnFilters["status"];
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "graded", label: "Graded" },
  { value: "ungraded", label: "Ungraded" },
  { value: "hidden", label: "Hidden" },
];

export const STUDENT_GRADE_SORT_OPTIONS: {
  value: StudentGradeColumnFilters["sort"];
  label: string;
}[] = [
  { value: "title-az", label: "Title A–Z" },
  { value: "score-high", label: "Highest score" },
  { value: "score-low", label: "Lowest score" },
];

export function filterStudentGradeColumns<T extends StudentGradeColumnLike>(
  columns: T[],
  filters: StudentGradeColumnFilters,
): T[] {
  let list = [...columns];

  if (filters.search.trim()) {
    list = list.filter((c) => matchesSearch(c.title, filters.search));
  }

  if (filters.typeFilter !== "all") {
    list = list.filter((c) => c.kind === filters.typeFilter);
  }

  if (filters.status === "graded") {
    list = list.filter((c) => c.score != null && c.gradesVisible !== false);
  } else if (filters.status === "ungraded") {
    list = list.filter((c) => c.score == null);
  } else if (filters.status === "hidden") {
    list = list.filter((c) => c.score != null && c.gradesVisible === false);
  }

  if (filters.sort === "score-high") {
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  } else if (filters.sort === "score-low") {
    list.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
  } else {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  return list;
}
