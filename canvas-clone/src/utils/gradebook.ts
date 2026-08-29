import { loadAssignments, isStudentViewableAssignment } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { loadParticipationsForTopic } from "./discussionParticipations";
import { isGradedDiscussion, loadTopics } from "./discussions";
import {
  getCourseAssignmentGroups,
  getCourseById,
  isWeightedGradingEnabled,
  resolveItemGroupId,
  type AssignmentGroup,
} from "./coursesStore";
import { getGradingScheme, percentToLetter } from "./gradingScheme";
import {
  isColumnGradeVisible,
  isGradeVisibleToStudent,
  SUMMARY_LETTER_KEY,
  SUMMARY_OVERALL_PERCENT_KEY,
} from "./gradeVisibility";
import { getRosterMemberName, loadRoster } from "./courseRoster";
import { loadQuizzes, isStudentViewableQuiz, quizCountsInGradebook } from "./quizzes";
import {
  getScoringPolicyAttempt,
  getStudentFinalScore,
} from "./quizSubmissions";
import { loadUser } from "./userStore";
import { getStudentSubmissionStatus, type StudentSubmissionStatus } from "./studentSubmissionStatus";
import { isGradeExcused } from "./excusedGrades";

export type GradebookColumnKind = "assignment" | "quiz" | "discussion";

export type GradebookColumn = {
  id: string;
  title: string;
  kind: GradebookColumnKind;
  points: number;
  gradePath: string;
  viewerPath: string;
  /** Assignment group for weighted grading. */
  groupId?: string;
  extraCredit?: boolean;
};

export type GradebookRow = {
  studentId: string;
  studentName: string;
  cells: Record<string, number | null>;
  /** Non-zero fudge included in a quiz cell’s effective score (keyed by column id). */
  cellFudge?: Record<string, number>;
  overallPercent: number;
  letter: string;
  /** Per-group percentages (0–100) for groups that have columns. */
  groupPercents?: Record<string, number>;
  /** True when this student has at least one missing (overdue, unsubmitted) column. */
  hasMissing?: boolean;
};

export type WeightedScoreItem = {
  id?: string;
  groupId?: string | null;
  points: number;
  score: number | null;
  excused?: boolean;
  extraCredit?: boolean;
};

function itemKey(item: WeightedScoreItem) {
  return item.id ?? `${item.points}:${item.score}`;
}

function dropRankedScores(
  scoped: WeightedScoreItem[],
  count: number,
  direction: "low" | "high",
  never: Set<string>,
): WeightedScoreItem[] {
  const drop = Math.max(0, Math.floor(count));
  if (drop <= 0 || scoped.length <= 1) return scoped;
  const ranked = [...scoped].sort((a, b) => {
    const ra = a.points > 0 ? (a.score ?? 0) / a.points : 0;
    const rb = b.points > 0 ? (b.score ?? 0) / b.points : 0;
    return direction === "low" ? ra - rb : rb - ra;
  });
  const dropKeys = new Set<string>();
  let dropped = 0;
  const maxDrop = scoped.length - 1;
  for (const item of ranked) {
    if (dropped >= drop || dropped >= maxDrop) break;
    if (item.extraCredit) continue;
    const key = itemKey(item);
    if (item.id && never.has(item.id)) continue;
    dropKeys.add(key);
    dropped += 1;
  }
  return scoped.filter((item) => !dropKeys.has(itemKey(item)));
}

function applyGroupRules(
  items: WeightedScoreItem[],
  group: AssignmentGroup,
  includeUngraded: boolean,
): WeightedScoreItem[] {
  let scoped = items.filter((item) => {
    if (item.excused) return false;
    if (!(item.points > 0) && !item.extraCredit) return false;
    if (!includeUngraded && item.score == null) return false;
    return true;
  });
  const never = new Set(group.neverDropIds ?? []);
  scoped = dropRankedScores(scoped, group.dropLowest ?? 0, "low", never);
  scoped = dropRankedScores(scoped, group.dropHighest ?? 0, "high", never);
  return scoped;
}

function partitionByGroup(
  items: WeightedScoreItem[],
  groups: AssignmentGroup[],
): { byGroup: Map<string, WeightedScoreItem[]>; unweighted: WeightedScoreItem[] } {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const byGroup = new Map<string, WeightedScoreItem[]>();
  const unweighted: WeightedScoreItem[] = [];
  for (const item of items) {
    const gid = item.groupId && groupById.has(item.groupId) ? item.groupId : undefined;
    if (!gid) {
      unweighted.push(item);
      continue;
    }
    const list = byGroup.get(gid) ?? [];
    list.push(item);
    byGroup.set(gid, list);
  }
  return { byGroup, unweighted };
}

function tallyItems(
  scoped: WeightedScoreItem[],
): { earned: number; possible: number } {
  let earned = 0;
  let possible = 0;
  for (const item of scoped) {
    if (item.extraCredit) {
      earned += item.score ?? 0;
      continue;
    }
    possible += item.points;
    earned += item.score ?? 0;
  }
  return { earned, possible };
}

function collectRoster(courseId: string): Map<string, string> {
  const roster = new Map<string, string>();
  for (const m of loadRoster(courseId)) {
    if (m.role !== "student") continue;
    roster.set(m.id, m.name);
  }
  return roster;
}

export function getRosterStudentName(courseId: string, studentId: string): string {
  return getRosterMemberName(courseId, studentId);
}

/**
 * Weighted overall % from assignment groups.
 * Per group: groupPct = earned / pointsInGroup.
 * Overall: Σ(groupPct × weight) / Σweights for non–extra-credit groups with columns.
 * Extra-credit groups add groupPct × weight on top and are never included in the
 * weight total used for normalization (so 100% + 10% EC can yield 110).
 * Items without a valid groupId are unweighted and excluded from this total.
 *
 * @param includeUngraded When true, null scores count as 0 toward the group
 *   denominator (instructor gradebook). When false, only scored items count
 *   (student current / What-If grade).
 */
export function computeWeightedOverallPercent(
  items: WeightedScoreItem[],
  groups: AssignmentGroup[],
  opts?: { includeUngraded?: boolean },
): number {
  const includeUngraded = opts?.includeUngraded ?? false;
  const resolved =
    groups.length > 0
      ? groups
      : ([
          { id: "ag_assignments", name: "Assignments", weight: 100 },
        ] satisfies AssignmentGroup[]);
  const { byGroup } = partitionByGroup(items, resolved);

  let weightedSum = 0;
  let weightTotal = 0;
  let extraBoost = 0;

  for (const group of resolved) {
    const scoped = applyGroupRules(byGroup.get(group.id) ?? [], group, includeUngraded);
    const { earned, possible } = tallyItems(scoped);
    if (possible <= 0) continue;
    const groupPct = earned / possible;
    if (group.extraCredit) {
      extraBoost += groupPct * Math.max(0, group.weight);
      continue;
    }
    if (!(group.weight > 0)) continue;
    weightedSum += groupPct * group.weight;
    weightTotal += group.weight;
  }

  const base = weightTotal > 0 ? (weightedSum / weightTotal) * 100 : 0;
  return Math.round(base + extraBoost);
}

/** Total-points overall % (drop-lowest / extra-credit group rules still apply). */
export function computeUnweightedOverallPercent(
  items: WeightedScoreItem[],
  groups: AssignmentGroup[],
  opts?: { includeUngraded?: boolean },
): number {
  const includeUngraded = opts?.includeUngraded ?? false;
  const resolved =
    groups.length > 0
      ? groups
      : ([
          { id: "ag_assignments", name: "Assignments", weight: 100 },
        ] satisfies AssignmentGroup[]);
  const { byGroup, unweighted } = partitionByGroup(items, resolved);

  let earned = 0;
  let possible = 0;
  for (const group of resolved) {
    const scoped = applyGroupRules(byGroup.get(group.id) ?? [], group, includeUngraded);
    for (const item of scoped) {
      if (item.extraCredit || group.extraCredit) {
        earned += item.score ?? 0;
        continue;
      }
      possible += item.points;
      earned += item.score ?? 0;
    }
  }
  const unweightedScoped = applyGroupRules(unweighted, { id: "", name: "", weight: 0 }, includeUngraded);
  for (const item of unweightedScoped) {
    if (item.extraCredit) {
      earned += item.score ?? 0;
      continue;
    }
    possible += item.points;
    earned += item.score ?? 0;
  }
  if (possible <= 0) return 0;
  return Math.round((earned / possible) * 100);
}

export function computeCourseOverallPercent(
  items: WeightedScoreItem[],
  groups: AssignmentGroup[],
  opts?: { includeUngraded?: boolean; weighted?: boolean },
): number {
  if (opts?.weighted === false) {
    return computeUnweightedOverallPercent(items, groups, opts);
  }
  return computeWeightedOverallPercent(items, groups, opts);
}

/** Per-group percentages (0–100) for groups that contribute columns. */
export function computeGroupPercents(
  items: WeightedScoreItem[],
  groups: AssignmentGroup[],
  opts?: { includeUngraded?: boolean },
): Record<string, number> {
  const includeUngraded = opts?.includeUngraded ?? false;
  const resolved =
    groups.length > 0
      ? groups
      : ([
          { id: "ag_assignments", name: "Assignments", weight: 100 },
        ] satisfies AssignmentGroup[]);
  const { byGroup } = partitionByGroup(items, resolved);

  const out: Record<string, number> = {};
  for (const group of resolved) {
    const scoped = applyGroupRules(byGroup.get(group.id) ?? [], group, includeUngraded);
    const { earned, possible } = tallyItems(scoped);
    if (possible <= 0) continue;
    out[group.id] = Math.round((earned / possible) * 100);
  }
  return out;
}

export function exportGradebookCsv(courseId: string): string {
  const { columns, rows } = buildGradebook(courseId);
  const escape = (value: string | number) => {
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const headerParts = ["Student", "Average %", "Letter"];
  for (const c of columns) {
    headerParts.push(c.title);
    if (c.kind === "quiz") headerParts.push(`${c.title} (fudge)`);
  }
  const header = headerParts.map(escape).join(",");
  const body = rows
    .map((row) => {
      const cells: (string | number)[] = [
        row.studentName,
        row.overallPercent,
        row.letter,
      ];
      for (const c of columns) {
        cells.push(row.cells[c.id] != null ? row.cells[c.id]! : "");
        if (c.kind === "quiz") {
          const fudge = row.cellFudge?.[c.id];
          cells.push(typeof fudge === "number" && fudge !== 0 ? fudge : "");
        }
      }
      return cells.map(escape).join(",");
    })
    .join("\n");
  return `${header}\n${body}\n`;
}

function buildColumns(courseId: string): GradebookColumn[] {
  const columns: GradebookColumn[] = [];
  const groups = getCourseAssignmentGroups(getCourseById(courseId));

  for (const a of loadAssignments(courseId)) {
    if (!isStudentViewableAssignment(a)) continue;
    if (!(a.points != null && a.points > 0)) continue;
    columns.push({
      id: `assignment:${a.id}`,
      title: a.title,
      kind: "assignment",
      points: a.points,
      groupId: resolveItemGroupId(groups, a.groupId),
      extraCredit: a.extraCredit,
      viewerPath: `/courses/${courseId}/assignments/${a.id}`,
      gradePath: `/courses/${courseId}/assignments/${a.id}/grade`,
    });
  }

  for (const q of loadQuizzes(courseId)) {
    if (!isStudentViewableQuiz(q)) continue;
    if (!quizCountsInGradebook(q)) continue;
    columns.push({
      id: `quiz:${q.id}`,
      title: q.title,
      kind: "quiz",
      points: q.points!,
      groupId: resolveItemGroupId(groups, q.groupId),
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
      groupId: resolveItemGroupId(groups, t.groupId),
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

function quizFudge(courseId: string, quizId: string, studentId: string): number | undefined {
  const quiz = loadQuizzes(courseId).find((q) => q.id === quizId);
  if (!quiz) return undefined;
  return getStudentFinalScore(courseId, quiz, studentId)?.fudgePoints;
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

function toWeightedItems(
  courseId: string,
  studentId: string,
  columns: GradebookColumn[],
  cells: Record<string, number | null>,
): WeightedScoreItem[] {
  return columns.map((col) => ({
    id: col.id,
    groupId: col.groupId,
    points: col.points,
    score: cells[col.id] ?? null,
    excused: isGradeExcused(courseId, col.id, studentId),
    extraCredit: col.extraCredit,
  }));
}

export function buildGradebook(courseId: string): { columns: GradebookColumn[]; rows: GradebookRow[] } {
  const columns = buildColumns(courseId);
  const roster = collectRoster(courseId);
  const scheme = getGradingScheme(courseId);
  const groups = getCourseAssignmentGroups(getCourseById(courseId));

  const rows: GradebookRow[] = [...roster.entries()].map(([studentId, studentName]) => {
    const cells: Record<string, number | null> = {};
    const cellFudge: Record<string, number> = {};
    for (const col of columns) {
      cells[col.id] = cellScore(courseId, col, studentId);
      if (col.kind === "quiz") {
        const fudge = quizFudge(courseId, col.id.replace("quiz:", ""), studentId);
        if (typeof fudge === "number" && fudge !== 0) cellFudge[col.id] = fudge;
      }
    }
    const items = toWeightedItems(courseId, studentId, columns, cells);
    const overallPercent = computeCourseOverallPercent(items, groups, {
      includeUngraded: true,
      weighted: isWeightedGradingEnabled(getCourseById(courseId)),
    });
    const groupPercents = computeGroupPercents(items, groups, { includeUngraded: true });
    const hasMissing = columns.some(
      (col) => getStudentSubmissionStatus(courseId, col, studentId) === "missing",
    );
    return {
      studentId,
      studentName,
      cells,
      cellFudge: Object.keys(cellFudge).length > 0 ? cellFudge : undefined,
      overallPercent,
      letter: percentToLetter(overallPercent, scheme),
      groupPercents,
      hasMissing,
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
    GradebookColumn & {
      score: number | null;
      fudgePoints?: number;
      gradesVisible: boolean;
      submissionStatus: StudentSubmissionStatus;
    }
  >;
  overallPercent: number;
  letter: string;
  showLetterGrades: boolean;
  showOverallPercent: boolean;
  gradesVisible: boolean;
  overallPercentVisible: boolean;
  letterVisible: boolean;
  assignmentGroups: AssignmentGroup[];
  groupPercents: Record<string, number>;
} {
  const { columns } = buildGradebook(courseId);
  const scheme = getGradingScheme(courseId);
  const gradesVisible = isGradeVisibleToStudent(courseId, studentId);
  const groups = getCourseAssignmentGroups(getCourseById(courseId));

  const withScores = columns.map((col) => {
    const score = cellScore(courseId, col, studentId);
    const fudgePoints =
      col.kind === "quiz"
        ? quizFudge(courseId, col.id.replace("quiz:", ""), studentId)
        : undefined;
    return {
      ...col,
      score,
      fudgePoints,
      gradesVisible: isColumnGradeVisible(courseId, col.id, studentId),
      submissionStatus: getStudentSubmissionStatus(courseId, col, studentId),
    };
  });

  const items = withScores.map((col) => ({
    id: col.id,
    groupId: col.groupId,
    points: col.points,
    score: col.score,
    excused: col.submissionStatus === "excused",
    extraCredit: col.extraCredit,
  }));
  const overallPercent = computeCourseOverallPercent(items, groups, {
    includeUngraded: getCourseById(courseId)?.treatUngradedAsZero ?? false,
    weighted: isWeightedGradingEnabled(getCourseById(courseId)),
  });
  const groupPercents = computeGroupPercents(items, groups, { includeUngraded: false });

  return {
    columns: withScores,
    overallPercent,
    letter: percentToLetter(overallPercent, scheme),
    showLetterGrades: scheme.showLetterGrades,
    showOverallPercent: scheme.showOverallPercent,
    gradesVisible,
    overallPercentVisible:
      isColumnGradeVisible(
        courseId,
        SUMMARY_OVERALL_PERCENT_KEY,
        studentId,
      ) &&
      !(getCourseById(courseId)?.hideTotalsUntilPosted && !gradesVisible),
    letterVisible:
      isColumnGradeVisible(courseId, SUMMARY_LETTER_KEY, studentId) &&
      !(getCourseById(courseId)?.hideTotalsUntilPosted && !gradesVisible),
    assignmentGroups: groups,
    groupPercents,
  };
}
