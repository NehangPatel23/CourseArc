import { buildGradebook } from "./gradebook";
import { loadAssignments, isStudentViewableAssignment } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { isLateSubmission } from "./latePenalty";
import { loadRoster } from "./courseRoster";

export type GradeDistributionBucket = {
  letter: string;
  count: number;
};

export type SubmissionStats = {
  onTime: number;
  late: number;
  missing: number;
  graded: number;
  submitted: number;
};

export type AssignmentAverage = {
  columnId: string;
  title: string;
  kind: "assignment" | "quiz" | "discussion";
  average: number | null;
  submissionCount: number;
  points: number;
  gradePath: string;
};

export function getCourseGradeDistribution(courseId: string): GradeDistributionBucket[] {
  const { rows } = buildGradebook(courseId);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.letter, (counts.get(row.letter) ?? 0) + 1);
  }
  const order = ["A", "B", "C", "D", "F"];
  const buckets = order.map((letter) => ({
    letter,
    count: counts.get(letter) ?? 0,
  }));
  for (const [letter, count] of counts) {
    if (!order.includes(letter)) buckets.push({ letter, count });
  }
  return buckets;
}

export function getCourseAveragePercent(courseId: string): number {
  const { rows } = buildGradebook(courseId);
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, r) => sum + r.overallPercent, 0) / rows.length);
}

export function getCourseSubmissionStats(courseId: string): SubmissionStats {
  const roster = loadRoster(courseId).filter((m) => m.role === "student");
  const assignments = loadAssignments(courseId).filter(isStudentViewableAssignment);
  let onTime = 0;
  let late = 0;
  let graded = 0;
  let submitted = 0;
  let expected = 0;

  for (const a of assignments) {
    expected += roster.length;
    const subs = loadSubmissionsForAssignment(courseId, a.id);
    const byStudent = new Map(subs.map((s) => [s.studentId, s]));
    for (const member of roster) {
      const sub = byStudent.get(member.id);
      if (!sub) continue;
      if (sub.status === "graded" || sub.status === "submitted") {
        submitted += 1;
        if (isLateSubmission(sub, a.dueAt)) late += 1;
        else onTime += 1;
      }
      if (sub.status === "graded") graded += 1;
    }
  }

  return {
    onTime,
    late,
    missing: Math.max(0, expected - submitted),
    graded,
    submitted,
  };
}

export function getAssignmentAverages(courseId: string): AssignmentAverage[] {
  const { columns, rows } = buildGradebook(courseId);
  return columns.map((col) => {
    const scores = rows
      .map((r) => r.cells[col.id])
      .filter((s): s is number => typeof s === "number");
    return {
      columnId: col.id,
      title: col.title,
      kind: col.kind,
      average:
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
      submissionCount: scores.length,
      points: col.points,
      gradePath: col.gradePath,
    };
  });
}
