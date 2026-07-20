import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  EyeOff,
  GraduationCap,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import HiddenGradeIndicator from "./HiddenGradeIndicator";
import ListFiltersBar from "./ListFiltersBar";
import { buildGradeCellLink, type GradebookColumnKind } from "../utils/gradebook";
import { getGradingScheme, percentToLetter } from "../utils/gradingScheme";
import {
  GRADE_PUBLISH_CHANGED_EVENT,
  isColumnGradeVisible,
  SUMMARY_LETTER_KEY,
  SUMMARY_OVERALL_PERCENT_KEY,
} from "../utils/gradeVisibility";
import {
  filterStudentGradeColumns,
  STUDENT_GRADE_SORT_OPTIONS,
  STUDENT_GRADE_STATUS_OPTIONS,
  STUDENT_GRADE_TYPE_OPTIONS,
  type StudentGradeColumnFilters,
} from "../utils/listFilters";
import { useUserId } from "../hooks/useUser";

export type StudentGradesData = {
  columns: Array<{
    id: string;
    title: string;
    kind: GradebookColumnKind;
    points: number;
    score: number | null;
    viewerPath: string;
    gradePath: string;
    gradesVisible?: boolean;
  }>;
  overallPercent: number;
  letter: string;
  showLetterGrades: boolean;
  showOverallPercent: boolean;
  gradesVisible: boolean;
  overallPercentVisible?: boolean;
  letterVisible?: boolean;
};

const KIND_META: Record<
  GradebookColumnKind,
  { label: string; icon: typeof ClipboardList; accent: string }
> = {
  assignment: {
    label: "Assignment",
    icon: ClipboardList,
    accent: "bg-blue-50 text-blue-700 border-blue-100",
  },
  quiz: {
    label: "Quiz",
    icon: HelpCircle,
    accent: "bg-violet-50 text-violet-700 border-violet-100",
  },
  discussion: {
    label: "Discussion",
    icon: MessageSquare,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
};

function SummaryStat({
  label,
  hidden,
  hint,
  children,
}: {
  label: string;
  hidden: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-canvas-grayDark">
        {hidden ? (
          <HiddenGradeIndicator label={`${label} not posted`} className="h-6 w-6" />
        ) : (
          children
        )}
      </p>
      {hint && !hidden && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function computePercent(
  items: Array<{ score: number | null; points: number }>,
): number {
  let earned = 0;
  let possible = 0;
  for (const item of items) {
    if (item.score == null || item.points <= 0) continue;
    earned += item.score;
    possible += item.points;
  }
  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

export default function StudentGradebook({
  grades,
  courseId,
  courseTitle,
}: {
  grades: StudentGradesData;
  courseId: string;
  courseTitle?: string;
}) {
  const studentId = useUserId();
  const scheme = getGradingScheme(courseId);
  const {
    showLetterGrades,
    showOverallPercent,
    columns,
  } = grades;

  const [publishTick, setPublishTick] = useState(0);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfScores, setWhatIfScores] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StudentGradeColumnFilters["sort"]>("title-az");
  const [typeFilter, setTypeFilter] =
    useState<StudentGradeColumnFilters["typeFilter"]>("all");
  const [status, setStatus] = useState<StudentGradeColumnFilters["status"]>("all");

  useEffect(() => {
    const bump = () => setPublishTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  // Live per-column visibility (not a stale snapshot from props).
  const columnVisibility = useMemo(() => {
    void publishTick;
    const map: Record<string, boolean> = {};
    for (const col of columns) {
      map[col.id] = isColumnGradeVisible(courseId, col.id, studentId);
    }
    return map;
  }, [columns, courseId, studentId, publishTick]);

  const overallPercentVisible = useMemo(() => {
    void publishTick;
    return isColumnGradeVisible(courseId, SUMMARY_OVERALL_PERCENT_KEY, studentId);
  }, [courseId, studentId, publishTick]);

  const letterVisible = useMemo(() => {
    void publishTick;
    return isColumnGradeVisible(courseId, SUMMARY_LETTER_KEY, studentId);
  }, [courseId, studentId, publishTick]);

  const columnsWithVisibility = useMemo(
    () =>
      columns.map((c) => ({
        ...c,
        gradesVisible: columnVisibility[c.id] ?? false,
      })),
    [columns, columnVisibility],
  );

  const gradedOnly = useMemo(
    () => columns.filter((c) => c.score != null),
    [columns],
  );

  const currentPercent = useMemo(() => computePercent(gradedOnly), [gradedOnly]);
  const currentLetter = percentToLetter(currentPercent, scheme);

  const whatIfItems = useMemo(() => {
    return columns.map((col) => {
      const override = whatIfScores[col.id];
      if (override != null && override.trim() !== "") {
        const n = Number(override);
        return {
          ...col,
          score: Number.isFinite(n) ? Math.max(0, Math.min(col.points, n)) : null,
        };
      }
      return col;
    });
  }, [columns, whatIfScores]);

  const whatIfPercent = useMemo(() => computePercent(whatIfItems), [whatIfItems]);
  const whatIfLetter = percentToLetter(whatIfPercent, scheme);
  const hasWhatIfOverrides = Object.values(whatIfScores).some((v) => v.trim() !== "");

  const filteredColumns = useMemo(
    () =>
      filterStudentGradeColumns(columnsWithVisibility, {
        search,
        sort,
        typeFilter,
        status,
      }),
    [columnsWithVisibility, search, sort, typeFilter, status],
  );

  const resetWhatIf = () => setWhatIfScores({});

  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-canvas-blueTint/30 to-white px-8 py-14 text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-canvas-blue/40" />
        <p className="mt-4 text-sm font-medium text-canvas-grayDark">No grades yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Graded assignments, quizzes, and discussions will appear here.
        </p>
      </div>
    );
  }

  const gradedCount = gradedOnly.length;
  const displayPercent = whatIfMode ? whatIfPercent : currentPercent;
  const displayLetter = whatIfMode ? whatIfLetter : currentLetter;
  const anyHidden = columnsWithVisibility.some(
    (c) => c.score != null && c.gradesVisible === false,
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-canvas-blueTint/70 via-white to-canvas-grayLight/30 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-canvas-blue">
                Your gradebook
              </p>
              {courseTitle && <p className="mt-0.5 text-sm text-gray-600">{courseTitle}</p>}
              <p className="mt-2 text-sm text-gray-500">
                {gradedCount} of {columns.length} items graded
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {anyHidden && (
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  <span>Some grades are not posted yet</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setWhatIfMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  whatIfMode
                    ? "border-canvas-blue bg-canvas-blue text-white"
                    : "border-gray-200 bg-white text-canvas-grayDark hover:border-canvas-blue/40"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                What-If
              </button>
            </div>
          </div>

          {(showOverallPercent || showLetterGrades) && (
            <div className="mt-5 flex flex-wrap gap-3">
              {showOverallPercent && (
                <SummaryStat
                  label={whatIfMode ? "What-If %" : "Current %"}
                  hidden={!overallPercentVisible && !whatIfMode}
                  hint={
                    whatIfMode
                      ? "Includes your hypothetical scores"
                      : "Based only on graded items"
                  }
                >
                  {displayPercent}%
                </SummaryStat>
              )}
              {showLetterGrades && (
                <SummaryStat
                  label={whatIfMode ? "What-If letter" : "Current letter"}
                  hidden={!letterVisible && !whatIfMode}
                >
                  {displayLetter}
                </SummaryStat>
              )}
              {whatIfMode && hasWhatIfOverrides && (
                <button
                  type="button"
                  onClick={resetWhatIf}
                  className="inline-flex items-center gap-1.5 self-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset What-If
                </button>
              )}
            </div>
          )}

          {whatIfMode && (
            <p className="mt-3 text-xs text-gray-500">
              Enter scores below to preview how your grade would change. Actual grades are
              unchanged.
            </p>
          )}
        </div>
      </div>

      {!whatIfMode && (
        <ListFiltersBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search items…"
          sort={sort}
          onSortChange={(v) => setSort(v as StudentGradeColumnFilters["sort"])}
          sortOptions={STUDENT_GRADE_SORT_OPTIONS}
          statusFilter={status}
          onStatusFilterChange={(v) =>
            setStatus(v as StudentGradeColumnFilters["status"])
          }
          statusOptions={STUDENT_GRADE_STATUS_OPTIONS}
          scoreBand={typeFilter}
          onScoreBandChange={(v) =>
            setTypeFilter(v as StudentGradeColumnFilters["typeFilter"])
          }
          scoreBandOptions={STUDENT_GRADE_TYPE_OPTIONS}
          resultCount={filteredColumns.length}
          totalCount={columns.length}
        />
      )}

      <div className="space-y-3">
        {(whatIfMode ? columnsWithVisibility : filteredColumns).map((col) => {
          const meta = KIND_META[col.kind];
          const Icon = meta.icon;
          const gradeLink = buildGradeCellLink(courseId, col, studentId);
          const hasScore = col.score != null;
          const itemVisible = columnVisibility[col.id] ?? false;
          const scoreHidden = !itemVisible && hasScore;
          const whatIfValue = whatIfScores[col.id] ?? "";
          const effectiveScore =
            whatIfMode && whatIfValue.trim() !== ""
              ? Number(whatIfValue)
              : col.score;

          if (whatIfMode) {
            return (
              <div
                key={col.id}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-canvas-blue/30 bg-white px-5 py-4 shadow-sm"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${meta.accent}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-canvas-grayDark">{col.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {meta.label} · {col.points} pts
                    {hasScore && itemVisible && (
                      <span className="text-gray-400"> · actual {col.score}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={col.points}
                    step="any"
                    value={whatIfValue}
                    placeholder={
                      scoreHidden ? "?" : hasScore ? String(col.score) : "—"
                    }
                    onChange={(e) =>
                      setWhatIfScores((prev) => ({
                        ...prev,
                        [col.id]: e.target.value,
                      }))
                    }
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-canvas-blue focus:ring-1 focus:ring-canvas-blue"
                    aria-label={`What-if score for ${col.title}`}
                  />
                  <span className="text-xs text-gray-400">/ {col.points}</span>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={col.id}
              to={gradeLink}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-canvas-blue/30 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${meta.accent}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-canvas-grayDark group-hover:text-canvas-blue">
                  {col.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {meta.label} · {col.points} pts
                  {hasScore && itemVisible && (
                    <span className="text-gray-400">
                      {" "}
                      · {Math.round((col.score! / col.points) * 100)}%
                    </span>
                  )}
                </p>
              </div>

              {scoreHidden ? (
                <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 text-amber-700">
                  <HiddenGradeIndicator label="Grade not posted yet" className="h-5 w-5" />
                </span>
              ) : effectiveScore == null ? (
                <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-4 text-lg font-medium text-gray-400">
                  —
                </span>
              ) : (
                <span className="inline-flex h-11 min-w-[4.5rem] flex-col items-center justify-center rounded-full border border-canvas-blue/20 bg-canvas-blueTint px-4">
                  <span className="text-base font-bold tabular-nums leading-none text-canvas-blue">
                    {effectiveScore}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-canvas-blue/70">
                    {col.points > 0 ? Math.round((effectiveScore / col.points) * 100) : 0}%
                  </span>
                </span>
              )}

              <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:text-canvas-blue" />
            </Link>
          );
        })}
      </div>

      {!whatIfMode && filteredColumns.length === 0 && (
        <p className="text-center text-sm text-gray-500">No items match these filters.</p>
      )}

      {!whatIfMode && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <EyeOff className="h-3.5 w-3.5" />
          Tap any item to open your submission and feedback in GradePro
        </p>
      )}
    </div>
  );
}
