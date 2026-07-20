import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, GraduationCap } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import StudentGradebook from "../components/StudentGradebook";
import AppEmptyState from "../components/AppEmptyState";
import GradeColumnPublishButton, {
  applyColumnPublish,
} from "../components/GradeColumnPublishButton";
import { GradePublishRowButton } from "../components/GradePublishButton";
import ListFiltersBar from "../components/ListFiltersBar";
import { useToast } from "../components/ui/Toast";
import { getCourseById } from "../utils/coursesStore";
import {
  filterGradebookRows,
  GRADEBOOK_VISIBILITY_OPTIONS,
  SCORE_BAND_OPTIONS,
  type GradebookVisibilityFilter,
  type ScoreBandKey,
} from "../utils/listFilters";
import { useStudentView } from "../utils/studentView";
import {
  buildGradebook,
  buildGradeCellLink,
  buildStudentGrades,
  exportGradebookCsv,
} from "../utils/gradebook";
import { getTotalPendingGradeCount } from "../utils/gradingCounts";
import {
  GRADE_PUBLISH_CHANGED_EVENT,
  isGradeVisibleToStudent,
  loadGradePublishState,
  setAllGradesPublished,
  SUMMARY_LETTER_KEY,
  SUMMARY_OVERALL_PERCENT_KEY,
} from "../utils/gradeVisibility";
import { DISCUSSION_PARTICIPATIONS_CHANGED_EVENT } from "../utils/discussionParticipations";
import { QUIZ_ATTEMPTS_CHANGED_EVENT } from "../utils/quizSubmissions";

type GradebookSort = "student-az" | "score-high" | "score-low";

const GRADEBOOK_SORT_OPTIONS = [
  { value: "student-az", label: "Student A–Z" },
  { value: "score-high", label: "Highest overall" },
  { value: "score-low", label: "Lowest overall" },
];

const stickyStudentClass =
  "sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]";
const stickyStudentHeaderClass =
  "sticky left-0 z-20 bg-canvas-grayLight/95 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm";

type ConfirmState =
  | { kind: "post-all" }
  | { kind: "hide-all" }
  | { kind: "column"; columnKey: string; columnLabel: string; nextPublished: boolean }
  | null;

export default function GradesPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { showToast } = useToast();

  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GradebookSort>("student-az");
  const [scoreBand, setScoreBand] = useState<ScoreBandKey>("all");
  const [visibility, setVisibility] = useState<GradebookVisibilityFilter>("all");
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", bump);
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
    window.addEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("canvasClone:assignmentSubmissionsChanged", bump);
      window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
      window.removeEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
      window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    };
  }, []);

  const gradebook = useMemo(
    () => (courseId && !studentView ? buildGradebook(effectiveCourseId) : { columns: [], rows: [] }),
    [courseId, studentView, effectiveCourseId, refreshTick],
  );

  const studentGrades = useMemo(
    () => (courseId && studentView ? buildStudentGrades(effectiveCourseId) : null),
    [courseId, studentView, effectiveCourseId, refreshTick],
  );

  const publishState = useMemo(
    () => (courseId ? loadGradePublishState(effectiveCourseId) : null),
    [courseId, effectiveCourseId, refreshTick],
  );

  const pendingCount = useMemo(
    () => (!studentView && courseId ? getTotalPendingGradeCount(effectiveCourseId) : 0),
    [studentView, courseId, effectiveCourseId, refreshTick],
  );

  const filteredGradebook = useMemo(
    () =>
      filterGradebookRows(
        gradebook.rows,
        { search, sort, scoreBand, visibility },
        (studentId) => isGradeVisibleToStudent(effectiveCourseId, studentId),
      ),
    [gradebook.rows, search, sort, scoreBand, visibility, effectiveCourseId, refreshTick],
  );

  const handleExportCsv = () => {
    const csv = exportGradebookCsv(effectiveCourseId);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course?.code ?? "course"}-gradebook.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Gradebook exported", "positive");
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "post-all") {
      setAllGradesPublished(effectiveCourseId, true);
      showToast("Grades posted for class", "positive");
    } else if (confirm.kind === "hide-all") {
      setAllGradesPublished(effectiveCourseId, false);
      showToast("Grades hidden from students", "positive");
    } else if (confirm.kind === "column") {
      applyColumnPublish(effectiveCourseId, confirm.columnKey, confirm.nextPublished);
      showToast(
        confirm.nextPublished
          ? `${confirm.columnLabel} posted for all students`
          : `${confirm.columnLabel} hidden from students`,
        "positive",
      );
    }
    setRefreshTick((n) => n + 1);
  };

  const confirmCopy = (() => {
    if (!confirm) return { title: "", description: "", confirmText: "Confirm", tone: "primary" as const };
    if (confirm.kind === "post-all") {
      return {
        title: "Post all grades?",
        description: "Students will be able to see their grades and feedback for this course.",
        confirmText: "Post grades",
        tone: "primary" as const,
      };
    }
    if (confirm.kind === "hide-all") {
      return {
        title: "Hide all grades?",
        description: "Students will no longer see their grades or instructor feedback until you post again.",
        confirmText: "Hide grades",
        tone: "danger" as const,
      };
    }
    return {
      title: confirm.nextPublished
        ? `Post ${confirm.columnLabel}?`
        : `Hide ${confirm.columnLabel}?`,
      description: confirm.nextPublished
        ? `Students will see ${confirm.columnLabel} for this course.`
        : `Students will no longer see ${confirm.columnLabel} until you post it again.`,
      confirmText: confirm.nextPublished ? "Post column" : "Hide column",
      tone: confirm.nextPublished ? ("primary" as const) : ("danger" as const),
    };
  })();

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">Grades</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {studentView
                  ? "View your grades for this course."
                  : "Review and manage the class gradebook."}
              </p>
            </div>
            {!studentView && pendingCount > 0 && (
              <p className="rounded-full bg-canvas-red/10 px-3 py-1 text-sm font-medium text-canvas-red">
                {pendingCount} awaiting grade
              </p>
            )}
          </div>

          {studentView ? (
            <div className="mt-6">
              {studentGrades ? (
                <StudentGradebook
                  grades={studentGrades}
                  courseId={effectiveCourseId}
                  courseTitle={course.title}
                />
              ) : (
                <AppEmptyState
                  variant="grades"
                  title="No grades yet"
                  subtitle="Graded assignments, quizzes, and discussions will appear here."
                />
              )}
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">
                      Class Gradebook
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {gradebook.columns.length} gradable items · {gradebook.rows.length} students
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        publishState?.allPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {publishState?.allPublished ? "Posted" : "Hidden from students"}
                    </span>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "post-all" })}
                      className="btn-canvas-primary text-sm"
                    >
                      Post grades
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "hide-all" })}
                      className="btn-canvas-secondary text-sm"
                    >
                      Hide grades
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200 px-5 py-4">
                <ListFiltersBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search students…"
                  sort={sort}
                  onSortChange={(value) => setSort(value as GradebookSort)}
                  sortOptions={GRADEBOOK_SORT_OPTIONS}
                  scoreBand={scoreBand}
                  onScoreBandChange={(v) => setScoreBand(v as ScoreBandKey)}
                  scoreBandOptions={SCORE_BAND_OPTIONS}
                  statusFilter={visibility}
                  onStatusFilterChange={(v) => setVisibility(v as GradebookVisibilityFilter)}
                  statusOptions={GRADEBOOK_VISIBILITY_OPTIONS}
                  resultCount={filteredGradebook.length}
                  totalCount={gradebook.rows.length}
                />
              </div>

              {gradebook.columns.length === 0 ? (
                <div className="p-6">
                  <AppEmptyState
                    variant="grades"
                    title="No published gradable items yet"
                    subtitle="Publish assignments, quizzes, or graded discussions to populate the gradebook."
                    compact
                  />
                </div>
              ) : filteredGradebook.length === 0 ? (
                <div className="p-6">
                  <AppEmptyState
                    variant="list"
                    title="No students match"
                    subtitle="Try a different search or clear filters."
                    compact
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-4 md:hidden">
                    {filteredGradebook.map((row) => {
                      const visibleToStudent = isGradeVisibleToStudent(
                        effectiveCourseId,
                        row.studentId,
                      );
                      return (
                        <div
                          key={row.studentId}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-canvas-grayDark">{row.studentName}</p>
                              <p className="mt-0.5 text-sm text-gray-500">
                                {row.overallPercent}% · {row.letter}
                                {!visibleToStudent && (
                                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                                    Hidden
                                  </span>
                                )}
                              </p>
                            </div>
                            <GradePublishRowButton
                              courseId={effectiveCourseId}
                              studentId={row.studentId}
                              onChange={() => setRefreshTick((n) => n + 1)}
                            />
                          </div>
                          <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                            {gradebook.columns.map((col) => {
                              const score = row.cells[col.id];
                              const cellLink = buildGradeCellLink(
                                effectiveCourseId,
                                col,
                                row.studentId,
                              );
                              return (
                                <li
                                  key={col.id}
                                  className="flex items-center justify-between gap-2 text-sm"
                                >
                                  <span className="min-w-0 truncate text-gray-600">{col.title}</span>
                                  <Link
                                    to={cellLink}
                                    className="shrink-0 tabular-nums text-canvas-blue hover:underline"
                                  >
                                    {score != null ? score : "—"}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className={`px-5 py-3 font-semibold ${stickyStudentHeaderClass}`}>
                            Student
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            <div className="flex flex-col items-start">
                              <span>Average %</span>
                              <GradeColumnPublishButton
                                courseId={effectiveCourseId}
                                columnKey={SUMMARY_OVERALL_PERCENT_KEY}
                                columnLabel="Average %"
                                onChange={() => setRefreshTick((n) => n + 1)}
                                onRequestConfirm={(nextPublished) =>
                                  setConfirm({
                                    kind: "column",
                                    columnKey: SUMMARY_OVERALL_PERCENT_KEY,
                                    columnLabel: "Average %",
                                    nextPublished,
                                  })
                                }
                              />
                            </div>
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            <div className="flex flex-col items-start">
                              <span>Letter</span>
                              <GradeColumnPublishButton
                                courseId={effectiveCourseId}
                                columnKey={SUMMARY_LETTER_KEY}
                                columnLabel="Letter"
                                onChange={() => setRefreshTick((n) => n + 1)}
                                onRequestConfirm={(nextPublished) =>
                                  setConfirm({
                                    kind: "column",
                                    columnKey: SUMMARY_LETTER_KEY,
                                    columnLabel: "Letter",
                                    nextPublished,
                                  })
                                }
                              />
                            </div>
                          </th>
                          <th
                            className="w-10 px-2 py-3 text-center font-semibold"
                            title="Grade visibility"
                          >
                            <span className="sr-only">Visibility</span>
                          </th>
                          {gradebook.columns.map((col) => (
                            <th key={col.id} className="px-5 py-3 font-semibold">
                              <Link
                                to={col.viewerPath}
                                className="text-canvas-blue hover:underline"
                              >
                                {col.title}
                              </Link>
                              <span className="mt-0.5 block text-[10px] font-normal normal-case text-gray-400">
                                {col.points} pts
                              </span>
                              <GradeColumnPublishButton
                                courseId={effectiveCourseId}
                                columnKey={col.id}
                                columnLabel={col.title}
                                onChange={() => setRefreshTick((n) => n + 1)}
                                onRequestConfirm={(nextPublished) =>
                                  setConfirm({
                                    kind: "column",
                                    columnKey: col.id,
                                    columnLabel: col.title,
                                    nextPublished,
                                  })
                                }
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGradebook.map((row) => {
                          const visibleToStudent = isGradeVisibleToStudent(
                            effectiveCourseId,
                            row.studentId,
                          );
                          return (
                            <tr
                              key={row.studentId}
                              className="border-b border-gray-200 last:border-0"
                            >
                              <td
                                className={`px-5 py-3 font-medium text-canvas-grayDark ${stickyStudentClass}`}
                              >
                                <span className="flex items-center gap-2">
                                  {row.studentName}
                                  {!visibleToStudent && (
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                                      Hidden
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-5 py-3 tabular-nums text-gray-700">
                                {row.overallPercent}%
                              </td>
                              <td className="px-5 py-3 tabular-nums text-gray-700">
                                {row.letter}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <GradePublishRowButton
                                  courseId={effectiveCourseId}
                                  studentId={row.studentId}
                                  onChange={() => setRefreshTick((n) => n + 1)}
                                />
                              </td>
                              {gradebook.columns.map((col) => {
                                const score = row.cells[col.id];
                                const cellLink = buildGradeCellLink(
                                  effectiveCourseId,
                                  col,
                                  row.studentId,
                                );
                                return (
                                  <td
                                    key={col.id}
                                    className="px-5 py-3 tabular-nums text-gray-700"
                                  >
                                    <Link
                                      to={cellLink}
                                      className="text-canvas-blue hover:underline"
                                    >
                                      {score != null ? score : "—"}
                                    </Link>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmActionModal
        isOpen={confirm != null}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmText={confirmCopy.confirmText}
        tone={confirmCopy.tone}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}
