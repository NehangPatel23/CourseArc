import type { Quiz } from "./quizzes";
import type { QuizAttempt } from "./quizSubmissions";
import { computeDetailedQuizStatistics } from "./quizSubmissions";
import { getAttemptEffectiveScore } from "./quizSubmissions";

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV: overview + per-question rows + attempt leave summary. */
export function exportQuizStatisticsCsv(quiz: Quiz, attempts: QuizAttempt[]): string {
  const stats = computeDetailedQuizStatistics(quiz, attempts);
  const lines: string[] = [];

  lines.push("Section,Metric,Value");
  lines.push(`Overview,Attempts,${attempts.length}`);
  lines.push(`Overview,Mean score,${stats.averageScore ?? ""}`);
  lines.push(`Overview,Median score,${stats.medianScore ?? ""}`);
  lines.push(`Overview,Std dev,${stats.stdDev ?? ""}`);
  lines.push(`Overview,Average %,${stats.averagePercent ?? ""}`);

  const withLeaves = attempts.filter((a) => (a.leaveCount ?? 0) > 0);
  lines.push(`Overview,Attempts with leaves,${withLeaves.length}`);
  lines.push(
    `Overview,Total leave events,${attempts.reduce((n, a) => n + (a.leaveCount ?? 0), 0)}`,
  );

  lines.push("");
  lines.push("Question,Prompt,Correct %,Median time ms,Discrimination");
  for (const q of stats.questionDetails) {
    lines.push(
      [
        csvEscape(q.questionId),
        csvEscape((q.prompt || "").slice(0, 120)),
        csvEscape(q.correctPercent ?? ""),
        csvEscape(q.medianTimeMs ?? ""),
        csvEscape(q.discrimination ?? ""),
      ].join(","),
    );
  }

  lines.push("");
  lines.push(
    "Attempt,Student,Score,Max,Leave count,Seat,Started,Submitted,Auto graded",
  );
  for (const a of attempts) {
    lines.push(
      [
        csvEscape(a.attemptNumber),
        csvEscape(a.studentName),
        csvEscape(getAttemptEffectiveScore(a)),
        csvEscape(a.maxScore),
        csvEscape(a.leaveCount ?? 0),
        csvEscape(a.seatNumber ?? ""),
        csvEscape(a.startedAt ? new Date(a.startedAt).toISOString() : ""),
        csvEscape(new Date(a.submittedAt).toISOString()),
        csvEscape(a.autoGraded ? "yes" : "no"),
      ].join(","),
    );
  }

  return lines.join("\n");
}

/** Focused student × score CSV for one quiz (latest attempt per student by default). */
export function exportQuizGradesCsv(
  _quiz: Quiz,
  attempts: QuizAttempt[],
  opts?: { latestOnly?: boolean },
): string {
  const latestOnly = opts?.latestOnly !== false;
  const byStudent = new Map<string, QuizAttempt>();
  const ordered = [...attempts].sort((a, b) => b.submittedAt - a.submittedAt);
  const rows = latestOnly
    ? ordered.filter((a) => {
        if (byStudent.has(a.studentId)) return false;
        byStudent.set(a.studentId, a);
        return true;
      })
    : ordered;

  const lines = [
    "Student,Student ID,Attempt,Score,Max Score,Percent,Posted,Leaves,Seat,Auto Graded,Submit Reason,Submitted At",
  ];
  for (const a of rows) {
    const score = getAttemptEffectiveScore(a);
    const pct = a.maxScore > 0 ? Math.round((score / a.maxScore) * 1000) / 10 : "";
    lines.push(
      [
        csvEscape(a.studentName),
        csvEscape(a.studentId),
        csvEscape(a.attemptNumber),
        csvEscape(score),
        csvEscape(a.maxScore),
        csvEscape(pct),
        csvEscape(typeof a.gradedAt === "number" ? "yes" : "no"),
        csvEscape(a.leaveCount ?? 0),
        csvEscape(a.seatNumber ?? ""),
        csvEscape(a.autoGraded ? "yes" : "no"),
        csvEscape(a.submitReason ?? "manual"),
        csvEscape(new Date(a.submittedAt).toISOString()),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/**
 * Canvas-ish quiz scores CSV: Student, ID, SIS Login, Section, Score, Submitted.
 * Section/SIS left blank (no SIS model); matches common Canvas quiz scores export columns.
 */
export function exportCanvasStyleQuizScoresCsv(
  _quiz: Quiz,
  attempts: QuizAttempt[],
): string {
  const byStudent = new Map<string, QuizAttempt>();
  for (const a of [...attempts].sort((x, y) => y.submittedAt - x.submittedAt)) {
    if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, a);
  }
  const lines = [
    "Student,ID,SIS Login ID,Section,Score,Submitted",
  ];
  for (const a of byStudent.values()) {
    lines.push(
      [
        csvEscape(a.studentName),
        csvEscape(a.studentId),
        "",
        "",
        csvEscape(getAttemptEffectiveScore(a)),
        csvEscape(new Date(a.submittedAt).toISOString()),
      ].join(","),
    );
  }
  return lines.join("\n");
}
