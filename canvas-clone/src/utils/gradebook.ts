import { loadAssignments, isStudentViewableAssignment } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { loadParticipationsForTopic } from "./discussionParticipations";
import { isGradedDiscussion, loadTopics } from "./discussions";
import { getGradingScheme, percentToLetter } from "./gradingScheme";
import {
  isColumnGradeVisible,
  isGradeVisibleToStudent,
  SUMMARY_LETTER_KEY,
  SUMMARY_OVERALL_PERCENT_KEY,
} from "./gradeVisibility";
import { getRosterMemberName, loadRoster } from "./courseRoster";
import { loadQuizzes, isStudentViewableQuiz } from "./quizzes";
import {
  getScoringPolicyAttempt,
  getStudentFinalScore,
} from "./quizSubmissions";
import { loadUser } from "./userStore";

export type GradebookColumnKind = "assignment" | "quiz" | "discussion";

export type GradebookColumn = {
  id: string;
  title: string;
  kind: GradebookColumnKind;
  points: number;
  gradePath: string;
  viewerPath: string;
};

export type GradebookRow = {
  studentId: string;
  studentName: string;
  cells: Record<string, number | null>;
  overallPercent: number;
  letter: string;
};

export { percentToLetter, getGradingScheme } from "./gradingScheme";

function collectRoster(courseId: string): Map<string, string> {
  const roster = new Map<string, string>();
  for (const m of loadRoster(courseId)) {
    roster.set(m.id, m.name);
  }
  return roster;
}

export function getRosterStudentName(courseId: string, studentId: string): string {
  return getRosterMemberName(courseId, studentId);
}

export function exportGradebookCsv(courseId: string): string {
  const { columns, rows } = buildGradebook(courseId);
  const escape = (value: string | number) => {
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ["Student", "Average %", "Letter", ...columns.map((c) => c.title)]
    .map(escape)
    .join(",");
  const body = rows
    .map((row) =>
      [
        row.studentName,
        row.overallPercent,
        row.letter,
        ...columns.map((c) => (row.cells[c.id] != null ? row.cells[c.id]! : "")),
      ]
        .map(escape)
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

function buildColumns(courseId: string): GradebookColumn[] {
  const columns: GradebookColumn[] = [];

  for (const a of loadAssignments(courseId)) {
    if (!isStudentViewableAssignment(a)) continue;
    if (!(a.points != null && a.points > 0)) continue;
    columns.push({
      id: `assignment:${a.id}`,
      title: a.title,
      kind: "assignment",
      points: a.points,
      viewerPath: `/courses/${courseId}/assignments/${a.id}`,
      gradePath: `/courses/${courseId}/assignments/${a.id}/grade`,
    });
  }

  for (const q of loadQuizzes(courseId)) {
    if (!isStudentViewableQuiz(q)) continue;
    if (!(q.points != null && q.points > 0)) continue;
    columns.push({
      id: `quiz:${q.id}`,
      title: q.title,
      kind: "quiz",
      points: q.points,
      viewerPath: `/courses/${courseId}/quizzes/${q.id}`,
      gradePath: `/courses/${courseId}/quizzes/${q.id}/grade`,
    });
  }

  for (const t of loadTopics(courseId)) {
    if (!isGradedDiscussion(t)) continue;
    if (!(t.published || t.status === "published")) continue;
    const pts = t.points ?? 0;
    if (pts <= 0) continue;
    columns.push({
      id: `discussion:${t.id}`,
      title: t.title,
      kind: "discussion",
      points: pts,
      viewerPath: `/courses/${courseId}/discussions/${t.id}`,
      gradePath: `/courses/${courseId}/discussions/${t.id}/grade`,
    });
  }

  return columns;
}

/**
 * Latest graded submission score (submissions are sorted submittedAt desc).
 * Aligns with buildGradeCellLink, which opens the latest submission.
 */
function assignmentScore(courseId: string, assignmentId: string, studentId: string): number | null {
  const graded = loadSubmissionsForAssignment(courseId, assignmentId).filter(
    (s) => s.studentId === studentId && s.status === "graded" && typeof s.score === "number",
  );
  if (graded.length === 0) return null;
  return graded[0].score ?? null;
}

function quizScore(courseId: string, quizId: string, studentId: string): number | null {
  const quiz = loadQuizzes(courseId).find((q) => q.id === quizId);
  if (!quiz) return null;
  const final = getStudentFinalScore(courseId, quiz, studentId);
  return final?.score ?? null;
}

function discussionScore(courseId: string, topicId: string, studentId: string): number | null {
  const p = loadParticipationsForTopic(courseId, topicId).find(
    (x) => x.studentId === studentId && x.status === "graded",
  );
  return typeof p?.score === "number" ? p.score : null;
}

function cellScore(
  courseId: string,
  column: GradebookColumn,
  studentId: string,
): number | null {
  if (column.kind === "assignment") {
    return assignmentScore(courseId, column.id.replace("assignment:", ""), studentId);
  }
  if (column.kind === "quiz") {
    return quizScore(courseId, column.id.replace("quiz:", ""), studentId);
  }
  return discussionScore(courseId, column.id.replace("discussion:", ""), studentId);
}

export function buildGradeCellLink(
  courseId: string,
  column: GradebookColumn,
  studentId: string,
): string {
  const returnTo = encodeURIComponent(`/courses/${courseId}/grades`);

  if (column.kind === "assignment") {
    const assignmentId = column.id.replace("assignment:", "");
    // Submissions are sorted submittedAt desc — prefer latest overall.
    const subs = loadSubmissionsForAssignment(courseId, assignmentId).filter(
      (s) => s.studentId === studentId,
    );
    const preferred = subs[0];
    if (preferred) {
      return `${column.gradePath}?submission=${preferred.id}&returnTo=${returnTo}`;
    }
    return `${column.gradePath}?student=${encodeURIComponent(studentId)}&returnTo=${returnTo}`;
  }

  if (column.kind === "quiz") {
    const quizId = column.id.replace("quiz:", "");
    const quiz = loadQuizzes(courseId).find((q) => q.id === quizId);
    const attempt = quiz
      ? getScoringPolicyAttempt(courseId, quiz, studentId)
      : undefined;
    if (attempt) {
      return `${column.gradePath}?attempt=${attempt.id}&returnTo=${returnTo}`;
    }
    return `${column.gradePath}?student=${encodeURIComponent(studentId)}&returnTo=${returnTo}`;
  }

  const topicId = column.id.replace("discussion:", "");
  const participation = loadParticipationsForTopic(courseId, topicId).find(
    (p) => p.studentId === studentId,
  );
  if (participation) {
    return `${column.gradePath}?participation=${participation.id}&returnTo=${returnTo}`;
  }
  return `${column.gradePath}?student=${encodeURIComponent(studentId)}&returnTo=${returnTo}`;
}

export function buildGradebook(courseId: string): { columns: GradebookColumn[]; rows: GradebookRow[] } {
  const columns = buildColumns(courseId);
  const roster = collectRoster(courseId);
  const totalPossible = columns.reduce((sum, c) => sum + c.points, 0);
  const scheme = getGradingScheme(courseId);

  const rows: GradebookRow[] = [...roster.entries()].map(([studentId, studentName]) => {
    const cells: Record<string, number | null> = {};
    let earned = 0;
    for (const col of columns) {
      const score = cellScore(courseId, col, studentId);
      cells[col.id] = score;
      if (score != null) earned += score;
    }
    const overallPercent =
      totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0;
    return {
      studentId,
      studentName,
      cells,
      overallPercent,
      letter: percentToLetter(overallPercent, scheme),
    };
  });

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return { columns, rows };
}

export function buildStudentGrades(
  courseId: string,
  studentId = loadUser().id,
): {
  columns: Array<
    GradebookColumn & { score: number | null; gradesVisible: boolean }
  >;
  overallPercent: number;
  letter: string;
  showLetterGrades: boolean;
  showOverallPercent: boolean;
  gradesVisible: boolean;
  overallPercentVisible: boolean;
  letterVisible: boolean;
} {
  const { columns } = buildGradebook(courseId);
  const totalPossible = columns.reduce((sum, c) => sum + c.points, 0);
  const scheme = getGradingScheme(courseId);
  const gradesVisible = isGradeVisibleToStudent(courseId, studentId);
  let earned = 0;

  const withScores = columns.map((col) => {
    const score = cellScore(courseId, col, studentId);
    if (score != null) earned += score;
    return {
      ...col,
      score,
      gradesVisible: isColumnGradeVisible(courseId, col.id, studentId),
    };
  });

  const overallPercent =
    totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0;

  return {
    columns: withScores,
    overallPercent,
    letter: percentToLetter(overallPercent, scheme),
    showLetterGrades: scheme.showLetterGrades,
    showOverallPercent: scheme.showOverallPercent,
    gradesVisible,
    overallPercentVisible: isColumnGradeVisible(
      courseId,
      SUMMARY_OVERALL_PERCENT_KEY,
      studentId,
    ),
    letterVisible: isColumnGradeVisible(courseId, SUMMARY_LETTER_KEY, studentId),
  };
}
