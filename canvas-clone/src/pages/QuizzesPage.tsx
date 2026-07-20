import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, EyeOff, HelpCircle, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import GradeIconLink from "../components/GradeIconLink";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { htmlPreview } from "../utils/htmlPreview";
import {
  autoPublishQuiz,
  duplicateQuiz,
  formatAvailabilityColumn,
  formatQuizDueDate,
  formatTimeLimit,
  getQuizQuestionCount,
  isQuizClosedToStudents,
  isQuizNotYetAvailable,
  isStudentViewableQuiz,
  loadQuizzes,
  saveQuizzes,
  type Quiz,
} from "../utils/quizzes";
import { getPendingQuizCount } from "../utils/gradingCounts";
import { QUIZ_ATTEMPTS_CHANGED_EVENT } from "../utils/quizSubmissions";

type SortKey = "due" | "title" | "points";
type FilterKey = "all" | "published" | "draft";

const GRID_STUDENT =
  "grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,180px)_90px_80px]";
const GRID_INSTRUCTOR =
  "grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,180px)_90px_80px_100px_minmax(140px,auto)]";

export default function QuizzesPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const { showToast } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>(() =>
    loadQuizzes(effectiveCourseId).map(autoPublishQuiz),
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [, setGradeRefresh] = useState(0);

  useEffect(() => {
    const bump = () => setGradeRefresh((n) => n + 1);
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const all = loadQuizzes(effectiveCourseId).map(autoPublishQuiz);
      const raw = loadQuizzes(effectiveCourseId);
      if (all.some((q, i) => q.status !== raw[i]?.status)) {
        saveQuizzes(effectiveCourseId, all);
      }
      setQuizzes(all);
    };
    refresh();
    window.addEventListener("canvasClone:quizzesChanged", refresh);
    return () => window.removeEventListener("canvasClone:quizzesChanged", refresh);
  }, [effectiveCourseId]);

  const filtered = useMemo(() => {
    let list = studentView ? quizzes.filter(isStudentViewableQuiz) : quizzes;

    if (!studentView && filter === "published") {
      list = list.filter((q) => q.status === "published" || q.published);
    } else if (!studentView && filter === "draft") {
      list = list.filter((q) => q.status === "draft" || !q.published);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          htmlPreview(item.description).text.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "points") return (b.points ?? 0) - (a.points ?? 0);
      return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    });
  }, [quizzes, studentView, search, sort, filter]);

  const published = studentView
    ? filtered
    : filtered.filter((q) => q.status === "published" || q.published);
  const drafts = studentView ? [] : filtered.filter((q) => q.status === "draft" || !q.published);

  const { upcomingQuizzes, pastQuizzes } = useMemo(() => {
    if (!studentView) {
      return { upcomingQuizzes: published, pastQuizzes: [] as Quiz[] };
    }
    const now = Date.now();
    const upcoming: Quiz[] = [];
    const past: Quiz[] = [];
    for (const q of published) {
      if (isQuizClosedToStudents(q, now)) past.push(q);
      else upcoming.push(q);
    }
    past.sort((a, b) => (b.dueAt ?? 0) - (a.dueAt ?? 0));
    return { upcomingQuizzes: upcoming, pastQuizzes: past };
  }, [published, studentView]);

  const remove = (id: string) => {
    saveQuizzes(
      effectiveCourseId,
      quizzes.filter((q) => q.id !== id),
    );
    setDeleteId(null);
    showToast("Quiz deleted", "neutral");
  };

  const handleDuplicate = (q: Quiz) => {
    const copy = duplicateQuiz(q);
    saveQuizzes(effectiveCourseId, [copy, ...quizzes]);
    showToast("Quiz duplicated", "positive");
  };

  const handlePublish = (q: Quiz) => {
    const next = quizzes.map((x) =>
      x.id === q.id
        ? { ...x, status: "published" as const, published: true, publishAt: undefined }
        : x,
    );
    saveQuizzes(effectiveCourseId, next);
    showToast("Quiz published", "positive");
  };

  const handleUnpublish = (q: Quiz) => {
    const next = quizzes.map((x) =>
      x.id === q.id
        ? { ...x, status: "draft" as const, published: false, publishAt: undefined }
        : x,
    );
    saveQuizzes(effectiveCourseId, next);
    showToast("Quiz unpublished", "neutral");
  };

  const QuizTable = ({ items, emptyMessage }: { items: Quiz[]; emptyMessage: string }) => (
    <div className="overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
      {items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-gray-600">{emptyMessage}</div>
      ) : (
        <>
          <QuizTableHeader />
          {items.map((q) => (
            <QuizRow key={q.id} q={q} />
          ))}
        </>
      )}
    </div>
  );

  const QuizTableHeader = () => (
    <div
      className={[
        "grid items-center gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
        studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
      ].join(" ")}
    >
      <span>Quiz</span>
      <span>Due Date</span>
      <span>Availability</span>
      <span>Time Limit</span>
      <span>Points</span>
      {!studentView && <span>Status</span>}
      {!studentView && <span className="text-right">Actions</span>}
    </div>
  );

  const QuizRow = ({ q }: { q: Quiz }) => {
    const preview = htmlPreview(q.description);
    const availability = formatAvailabilityColumn(q);
    const isPublished = q.status === "published" || q.published;
    const notYetAvailable = studentView && isQuizNotYetAvailable(q);
    const timeLimit = formatTimeLimit(q.timeLimitMinutes);

    return (
      <div
        className={[
          "grid items-center gap-4 border-b border-canvas-border px-5 py-4 last:border-0",
          studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
        ].join(" ")}
      >
        <Link
          to={`/courses/${effectiveCourseId}/quizzes/${q.id}`}
          className="min-w-0 text-left hover:underline"
        >
          <div className="text-sm font-semibold text-canvas-grayDark">{q.title}</div>
          {notYetAvailable && (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Not yet available
            </span>
          )}
          {preview.text && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{preview.text}</p>
          )}
          {getQuizQuestionCount(q) > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              {getQuizQuestionCount(q)} question{getQuizQuestionCount(q) === 1 ? "" : "s"}
            </p>
          )}
        </Link>

        <div className="min-w-0 text-sm text-gray-700">
          {q.dueAt ? formatQuizDueDate(q.dueAt) : <span className="text-gray-400">—</span>}
        </div>

        <div className="min-w-0 text-sm text-gray-700">
          {availability.length > 0 ? (
            <div className="space-y-0.5">
              {availability.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        <div className="text-sm text-gray-700">
          {timeLimit ?? <span className="text-gray-400">—</span>}
        </div>

        <div className="text-sm text-gray-700">
          {q.points != null ? `${q.points} pts` : <span className="text-gray-400">—</span>}
        </div>

        {!studentView && (
          <div>
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                isPublished ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>
        )}

        {!studentView && (
          <div className="flex shrink-0 items-center justify-end gap-1">
            {!isPublished ? (
              <Tooltip label="Publish">
                <button
                  type="button"
                  onClick={() => handlePublish(q)}
                  aria-label="Publish quiz"
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Unpublish">
                <button
                  type="button"
                  onClick={() => handleUnpublish(q)}
                  aria-label="Unpublish quiz"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label="Edit">
              <Link
                to={`/courses/${effectiveCourseId}/quizzes/${q.id}/edit`}
                aria-label="Edit quiz"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Tooltip>
            <Tooltip label="Grade">
              <GradeIconLink
                to={`/courses/${effectiveCourseId}/quizzes/${q.id}/grade`}
                pendingCount={getPendingQuizCount(effectiveCourseId, q.id)}
                label="Grade quiz"
              />
            </Tooltip>
            <Tooltip label="Duplicate">
              <button
                type="button"
                onClick={() => handleDuplicate(q)}
                aria-label="Duplicate quiz"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Copy className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                onClick={() => setDeleteId(q.id)}
                aria-label="Delete quiz"
                className="rounded-md p-1.5 text-canvas-red hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">Quizzes</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {studentView
                  ? "View and take course quizzes."
                  : "Create, publish, and manage quizzes."}
              </p>
            </div>
            {!studentView && (
              <button
                type="button"
                onClick={() => navigate(`/courses/${effectiveCourseId}/quizzes/new`)}
                className="btn-canvas-primary inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Quiz
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quizzes…"
                className="w-full rounded-lg border border-canvas-border py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {!studentView && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterKey)}
                className="rounded-lg border border-canvas-border px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-canvas-border px-3 py-2 text-sm"
            >
              <option value="due">Sort by due date</option>
              <option value="title">Sort by title</option>
              <option value="points">Sort by points</option>
            </select>
          </div>

          {studentView ? (
            <>
              <div className="mt-6">
                <QuizTable
                  items={upcomingQuizzes}
                  emptyMessage={
                    pastQuizzes.length > 0 ? "No upcoming quizzes." : "No quizzes yet."
                  }
                />
              </div>
              {pastQuizzes.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold text-canvas-grayDark">Past Quizzes</h2>
                  <QuizTable items={pastQuizzes} emptyMessage="No past quizzes." />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-6">
                <QuizTable items={published} emptyMessage="No quizzes yet." />
              </div>

              {drafts.length > 0 && filter !== "published" && (
                <div className="mt-6 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
                  <div className="border-b border-canvas-border px-5 py-3 text-sm font-semibold text-canvas-grayMuted">
                    Drafts
                  </div>
                  <QuizTableHeader />
                  {drafts.map((q) => (
                    <QuizRow key={q.id} q={q} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-700">Delete this quiz? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="btn-canvas-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove(deleteId)}
                className="btn-canvas-primary bg-canvas-red hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
