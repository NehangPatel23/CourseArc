import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, EyeOff, FileUp, FolderInput, HelpCircle, Pencil, Plus, Search, Send, Archive } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import CoursePickerModal from "../components/CoursePickerModal";
import GradeIconLink from "../components/GradeIconLink";
import ImportConflictModal from "../components/ImportConflictModal";
import PageIdentityHeader from "../components/PageIdentityHeader";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../components/ui/Toast";
import SubmissionStatusBadge from "../components/SubmissionStatusBadge";
import { getStudentSubmissionStatus } from "../utils/studentSubmissionStatus";
import { loadUser } from "../utils/userStore";
import {
  applyEffectiveDates,
  DUE_DATE_OVERRIDES_CHANGED_EVENT,
  hasDueDateOverrides,
} from "../utils/dueDateOverrides";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { htmlPreview } from "../utils/htmlPreview";
import { loadCourses } from "../utils/coursesStore";
import {
  autoPublishQuiz,
  copyQuizToCourse,
  duplicateQuiz,
  formatAvailabilityColumn,
  formatQuizDueDate,
  formatTimeLimit,
  getQuizQuestionCount,
  getQuizType,
  isQuizClosedToStudents,
  isQuizNotYetAvailable,
  isStudentViewableQuiz,
  loadQuizzes,
  CODE_LANGUAGE_LABELS,
  quizUsesCodingLanguages,
  QUIZ_TYPE_LABELS,
  saveQuizzes,
  uid,
  type Quiz,
  type QuizQuestion,
  type QuizType,
} from "../utils/quizzes";
import {
  exportCourseQuizPack,
  importCourseQuizPack,
  parseQuizPackJson,
} from "../utils/quizPackExport";
import {
  emptyQuizTrash,
  loadTrashedQuizzes,
  permanentlyDeleteQuiz,
  restoreQuiz,
} from "../utils/quizSoftDelete";
import { downloadJsonFile } from "../utils/quizExport";
import {
  applyQuizExportSettings,
  type QuizExportPayload,
  type QuizExportSettings,
} from "../utils/quizExport";
import {
  parseAnyQuestionImport,
  remapImportedQuestions,
  resolveImportTitle,
  titleFromFilename,
  type ImportConflictMode,
} from "../utils/quizImportFormats";
import { getPendingQuizCount } from "../utils/gradingCounts";
import { QUIZ_ATTEMPTS_CHANGED_EVENT } from "../utils/quizSubmissions";

type SortKey = "due" | "title" | "points";
type FilterKey = "all" | "published" | "draft";

const GRID_STUDENT =
  "grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,180px)_90px_80px]";
const GRID_INSTRUCTOR =
  "grid-cols-[28px_minmax(0,1fr)_minmax(0,150px)_minmax(0,180px)_90px_80px_100px_minmax(140px,auto)]";

/** Questions + optional settings staged while a title conflict is resolved. */
type PendingQuizImport = {
  title: string;
  questions: QuizQuestion[];
  settings?: QuizExportSettings;
  bankPool?: Quiz["bankPool"];
};

const QUIZ_TYPE_ORDER: QuizType[] = ["graded", "practice", "survey"];

const QUIZ_TYPE_SECTION_BLURB: Record<QuizType, string> = {
  graded: "Count toward the course gradebook when posted.",
  practice: "For practice only — not included in the gradebook.",
  survey: "Collect responses with no score or answer key.",
};

export default function QuizzesPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();
  const { showToast } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>(() =>
    loadQuizzes(effectiveCourseId).map(autoPublishQuiz),
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showTrash, setShowTrash] = useState(false);
  const [trash, setTrash] = useState<Quiz[]>(() => loadTrashedQuizzes(effectiveCourseId));
  const packImportRef = useRef<HTMLInputElement>(null);
  const [copyQuiz, setCopyQuiz] = useState<Quiz | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingQuizImport | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, setGradeRefresh] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  const otherCourses = useMemo(
    () => loadCourses(false).filter((c) => c.id !== effectiveCourseId),
    [effectiveCourseId, quizzes],
  );

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
      setTrash(loadTrashedQuizzes(effectiveCourseId));
    };
    refresh();
    window.addEventListener("canvasClone:quizzesChanged", refresh);
    window.addEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("canvasClone:quizzesChanged", refresh);
      window.removeEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => quizzes.some((q) => q.id === id)));
  }, [quizzes]);

  useEffect(() => {
    if (studentView) setSelectedIds([]);
  }, [studentView]);

  const filtered = useMemo(() => {
    const studentId = loadUser().id;
    let list = studentView ? quizzes.filter(isStudentViewableQuiz) : quizzes;
    if (studentView) {
      list = list.map((quiz) =>
        applyEffectiveDates(effectiveCourseId, "quiz", quiz, studentId),
      );
    }

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
  }, [quizzes, studentView, search, sort, filter, effectiveCourseId]);

  const published = studentView
    ? filtered
    : filtered.filter((q) => q.status === "published" || q.published);
  const drafts = studentView ? [] : filtered.filter((q) => q.status === "draft" || !q.published);

  const splitByAvailability = (items: Quiz[]) => {
    if (!studentView) {
      return { upcoming: items, past: [] as Quiz[] };
    }
    const now = Date.now();
    const upcoming: Quiz[] = [];
    const past: Quiz[] = [];
    for (const q of items) {
      if (isQuizClosedToStudents(q, now)) past.push(q);
      else upcoming.push(q);
    }
    past.sort((a, b) => (b.dueAt ?? 0) - (a.dueAt ?? 0));
    return { upcoming, past };
  };

  const sectionsByType = useMemo(() => {
    return QUIZ_TYPE_ORDER.map((type) => {
      const ofType = (list: Quiz[]) => list.filter((q) => getQuizType(q) === type);
      const publishedOfType = ofType(published);
      const draftsOfType = ofType(drafts);
      const { upcoming, past } = splitByAvailability(publishedOfType);
      return {
        type,
        label: QUIZ_TYPE_LABELS[type],
        blurb: QUIZ_TYPE_SECTION_BLURB[type],
        upcoming,
        past,
        published: publishedOfType,
        drafts: draftsOfType,
        total: publishedOfType.length + draftsOfType.length,
      };
    }).filter((s) => s.total > 0);
    // splitByAvailability uses studentView; include in deps via published/drafts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published, drafts, studentView]);

  const handleRestore = (id: string) => {
    restoreQuiz(effectiveCourseId, id);
    showToast("Quiz restored", "positive");
  };

  const handlePermanentDelete = (id: string) => {
    permanentlyDeleteQuiz(effectiveCourseId, id);
    showToast("Quiz permanently deleted", "neutral");
  };

  const exportPack = () => {
    const json = exportCourseQuizPack(effectiveCourseId, showTrash);
    downloadJsonFile(`course-${effectiveCourseId}-quizzes.json`, json);
    showToast("Quiz pack exported", "positive");
  };

  const importPack = async (file: File) => {
    const text = await file.text();
    const pack = parseQuizPackJson(text);
    if (!pack) {
      showToast("Invalid quiz pack JSON", "negative");
      return;
    }
    const existing = loadQuizzes(effectiveCourseId);
    const trashed = loadTrashedQuizzes(effectiveCourseId);
    const { next, result } = importCourseQuizPack(effectiveCourseId, pack, [...existing, ...trashed]);
    saveQuizzes(effectiveCourseId, next);
    showToast(`Imported ${result.imported} quiz${result.imported === 1 ? "" : "zes"}`, "positive");
  };

  const handleDuplicate = (q: Quiz) => {
    const copy = duplicateQuiz(q);
    saveQuizzes(effectiveCourseId, [copy, ...quizzes]);
    showToast("Quiz duplicated", "positive");
  };

  const handleCopyToCourse = (targetCourseId: string) => {
    if (!copyQuiz) return;
    const copy = copyQuizToCourse(copyQuiz, targetCourseId);
    const course = loadCourses().find((c) => c.id === targetCourseId);
    setCopyQuiz(null);
    showToast(
      `Copied “${copy.title}” to ${course?.code || course?.title || "course"} as a draft`,
      "positive",
    );
  };

  /** Create (or replace) a draft from a staged import once conflicts are resolved. */
  const createQuizFromImport = (bundle: PendingQuizImport, mode: ImportConflictMode) => {
    const all = loadQuizzes(effectiveCourseId);
    const desired = bundle.title.trim() || "Imported quiz";
    const now = Date.now();

    if (mode === "replace") {
      const target = all.find(
        (q) =>
          q.title.trim().toLowerCase() === desired.toLowerCase() &&
          (q.status === "draft" || !q.published),
      );
      if (target) {
        const replaced: Quiz = {
          ...applyQuizExportSettings(target, bundle.settings),
          id: target.id,
          title: target.title,
          questions: bundle.questions,
          questionCount: bundle.questions.length,
          bankPool: bundle.bankPool ?? target.bankPool,
          status: "draft",
          published: false,
          updatedAt: now,
        };
        saveQuizzes(
          effectiveCourseId,
          all.map((q) => (q.id === target.id ? replaced : q)),
        );
        showToast(`Replaced draft “${replaced.title}”`, "positive");
        navigate(`/courses/${effectiveCourseId}/quizzes/${replaced.id}/edit`);
        return;
      }
    }

    // Replace with no matching draft falls back to a renamed import.
    const title = resolveImportTitle(
      desired,
      all.map((q) => q.title),
      mode === "replace" ? "rename" : mode,
    );
    if (!title) {
      showToast(`Skipped “${desired}” — a quiz with that title already exists`, "neutral");
      return;
    }

    const base: Quiz = {
      id: uid("quiz"),
      title,
      questions: bundle.questions,
      questionCount: bundle.questions.length,
      status: "draft",
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    const draft: Quiz = {
      ...applyQuizExportSettings(base, bundle.settings),
      id: base.id,
      title,
      questions: bundle.questions,
      questionCount: bundle.questions.length,
      bankPool: bundle.bankPool,
      status: "draft",
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    saveQuizzes(effectiveCourseId, [draft, ...all]);
    showToast(`Imported “${draft.title}” as a draft`, "positive");
    navigate(`/courses/${effectiveCourseId}/quizzes/${draft.id}/edit`);
  };

  /** Quiz export JSON keeps settings; QTI / Moodle / Aiken / CSV bring questions only. */
  const importQuizFile = async (file: File) => {
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      const trimmed = text.trim();
      let bundle: PendingQuizImport;

      if (lower.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = JSON.parse(text) as QuizExportPayload;
        if (!parsed || parsed.kind !== "quiz" || !Array.isArray(parsed.questions)) {
          showToast("Invalid quiz JSON — expected a quiz export file", "negative");
          return;
        }
        bundle = {
          title: parsed.title?.trim() || "Imported quiz",
          questions: remapImportedQuestions(parsed.questions),
          settings: parsed.settings,
          bankPool: parsed.bankPool,
        };
      } else {
        const parsed = parseAnyQuestionImport(file.name, text);
        if (parsed.questions.length === 0) {
          showToast(parsed.warnings[0] ?? "No questions found in file", "negative");
          return;
        }
        if (parsed.warnings.length > 0) showToast(parsed.warnings[0]!, "neutral");
        bundle = {
          title:
            parsed.title.trim() || titleFromFilename(file.name) || "Imported quiz",
          questions: remapImportedQuestions(parsed.questions),
        };
      }

      const conflict = loadQuizzes(effectiveCourseId).some(
        (q) => q.title.trim().toLowerCase() === bundle.title.trim().toLowerCase(),
      );
      if (conflict) {
        setPendingImport(bundle);
        return;
      }
      createQuizFromImport(bundle, "rename");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "negative");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleManySelected = (ids: string[], on: boolean) => {
    setSelectedIds((prev) =>
      on ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id)),
    );
  };

  const bulkSetPublished = (publish: boolean) => {
    const ids = new Set(selectedIds);
    if (ids.size === 0) return;
    const next = quizzes.map((q) =>
      ids.has(q.id)
        ? {
            ...q,
            status: publish ? ("published" as const) : ("draft" as const),
            published: publish,
            publishAt: undefined,
          }
        : q,
    );
    saveQuizzes(effectiveCourseId, next);
    setSelectedIds([]);
    showToast(
      `${ids.size} quiz${ids.size === 1 ? "" : "zes"} ${publish ? "published" : "unpublished"}`,
      publish ? "positive" : "neutral",
    );
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
          <QuizTableHeader items={items} />
          {items.map((q) => (
            <QuizRow key={q.id} q={q} />
          ))}
        </>
      )}
    </div>
  );

  const QuizTableHeader = ({ items = [] }: { items?: Quiz[] }) => {
    const ids = items.map((q) => q.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    return (
    <div
      className={[
        "grid items-center gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
        studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
      ].join(" ")}
    >
      {canEdit && (
        <span>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={ids.length === 0}
            onChange={(e) => toggleManySelected(ids, e.target.checked)}
            aria-label="Select all quizzes in this list"
            className="h-4 w-4 align-middle"
          />
        </span>
      )}
      <span>Quiz</span>
      <span>Due Date</span>
      <span>Availability</span>
      <span>Time Limit</span>
      <span>Points</span>
          {!studentView && <span>Status</span>}
      {canEdit && <span className="text-right">Actions</span>}
    </div>
    );
  };

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
        {canEdit && (
          <span>
            <input
              type="checkbox"
              checked={selectedIds.includes(q.id)}
              onChange={() => toggleSelected(q.id)}
              aria-label={`Select ${q.title}`}
              className="h-4 w-4 align-middle"
            />
          </span>
        )}
        <Link
          to={`/courses/${effectiveCourseId}/quizzes/${q.id}`}
          className="min-w-0 text-left hover:underline"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-canvas-grayDark">{q.title}</span>
            {studentView && (
              <SubmissionStatusBadge
                status={getStudentSubmissionStatus(
                  effectiveCourseId,
                  {
                    id: `quiz:${q.id}`,
                    title: q.title,
                    kind: "quiz",
                    points: q.points ?? 0,
                    gradePath: "",
                    viewerPath: "",
                  },
                  loadUser().id,
                )}
              />
            )}
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                getQuizType(q) === "graded"
                  ? "bg-canvas-blueTint text-canvas-blueDark"
                  : getQuizType(q) === "practice"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-amber-50 text-amber-800",
              ].join(" ")}
            >
              {QUIZ_TYPE_LABELS[getQuizType(q)]}
            </span>
            {q.lockOnLeave && (
              <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                Lock on leave
              </span>
            )}
            {q.timeLimitMinutes != null && q.timeLimitMinutes > 0 && (
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {q.timeLimitMinutes}m
              </span>
            )}
            {quizUsesCodingLanguages(q).slice(0, 2).map((lang) => (
              <span
                key={lang}
                className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
              >
                {CODE_LANGUAGE_LABELS[lang]}
              </span>
            ))}
          </div>
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
          {!studentView && hasDueDateOverrides(effectiveCourseId, "quiz", q.id) && (
            <div className="text-[11px] font-medium text-canvas-blue">Multiple dates</div>
          )}
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

        {canEdit && (
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
            <Tooltip label="Copy to another course">
              <button
                type="button"
                onClick={() => setCopyQuiz(q)}
                aria-label="Copy quiz to another course"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <FolderInput className="h-4 w-4" />
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
      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <PageIdentityHeader
            size="md"
            icon={HelpCircle}
            label="Quizzes"
            title="Quizzes"
            description={
              studentView
                ? "View and take course quizzes."
                : "Create, publish, and manage quizzes."
            }
            actions={
              canEdit ? (
                <>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json,.xml,.txt,.csv,.md,application/json,application/xml,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void importQuizFile(file);
                    }}
                  />
                  <input
                    ref={packImportRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void importPack(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTrash((v) => !v)}
                    className="btn-canvas-secondary inline-flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Trash{trash.length > 0 ? ` (${trash.length})` : ""}
                  </button>
                  <button type="button" onClick={exportPack} className="btn-canvas-secondary text-sm">
                    Backup pack
                  </button>
                  <button
                    type="button"
                    onClick={() => packImportRef.current?.click()}
                    className="btn-canvas-secondary text-sm"
                  >
                    Restore pack
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/courses/${effectiveCourseId}/question-banks`)}
                    className="btn-canvas-secondary inline-flex items-center gap-2"
                  >
                    Question Banks
                  </button>
                  <button
                    type="button"
                    onClick={() => importRef.current?.click()}
                    className="btn-canvas-secondary inline-flex items-center gap-2"
                  >
                    <FileUp className="h-4 w-4" />
                    Import quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/courses/${effectiveCourseId}/quizzes/new`)}
                    className="btn-canvas-primary inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Quiz
                  </button>
                </>
              ) : undefined
            }
          />

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

          {canEdit && selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-canvas-border bg-canvas-grayLight px-3 py-2">
              <span className="text-sm font-medium text-canvas-grayDark">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => bulkSetPublished(true)}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm"
              >
                <Send className="h-3.5 w-3.5" />
                Publish selected
              </button>
              <button
                type="button"
                onClick={() => bulkSetPublished(false)}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Unpublish selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-sm font-medium text-canvas-blue hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {sectionsByType.length === 0 ? (
            <div className="mt-6 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
              <div className="px-5 py-8 text-sm text-gray-600">
                {studentView ? "No quizzes yet." : "No quizzes yet. Create one to get started."}
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-10">
              {sectionsByType.map((section) => (
                <section key={section.type} aria-labelledby={`quiz-section-${section.type}`}>
                  <div className="mb-3">
                    <h2
                      id={`quiz-section-${section.type}`}
                      className="text-base font-semibold text-canvas-grayDark"
                    >
                      {section.label}
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        ({section.total})
                      </span>
                    </h2>
                    {!studentView && (
                      <p className="mt-0.5 text-xs text-gray-500">{section.blurb}</p>
                    )}
                  </div>

                  {studentView ? (
                    <>
                      <QuizTable
                        items={section.upcoming}
                        emptyMessage={
                          section.past.length > 0
                            ? `No upcoming ${section.label.toLowerCase()}.`
                            : `No ${section.label.toLowerCase()} yet.`
                        }
                      />
                      {section.past.length > 0 && (
                        <div className="mt-4">
                          <h3 className="mb-2 text-sm font-medium text-gray-500">Past</h3>
                          <QuizTable items={section.past} emptyMessage="" />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {filter !== "draft" && (
                        <QuizTable
                          items={section.published}
                          emptyMessage={
                            section.drafts.length > 0 && filter === "all"
                              ? `No published ${section.label.toLowerCase()}.`
                              : `No ${section.label.toLowerCase()} yet.`
                          }
                        />
                      )}
                      {section.drafts.length > 0 && filter !== "published" && (
                        <div
                          className={
                            filter === "draft"
                              ? "overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm"
                              : "mt-4 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm"
                          }
                        >
                          {filter !== "draft" && (
                            <div className="border-b border-canvas-border px-5 py-3 text-sm font-semibold text-canvas-grayMuted">
                              Drafts
                            </div>
                          )}
                          <QuizTableHeader items={section.drafts} />
                          {section.drafts.map((q) => (
                            <QuizRow key={q.id} q={q} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              ))}
            </div>
          )}

          {!studentView && showTrash && (
            <section className="mt-8 overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50/80">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-canvas-grayDark">Trash</h2>
                {trash.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const n = emptyQuizTrash(effectiveCourseId);
                      showToast(`Emptied trash (${n} quiz${n === 1 ? "" : "zes"})`, "neutral");
                    }}
                    className="text-xs font-medium text-canvas-red hover:underline"
                  >
                    Empty trash
                  </button>
                )}
              </div>
              {trash.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                  No deleted quizzes. Deleted items appear here for 30 days (until permanently removed).
                </p>
              ) : (
                trash.map((q) => (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-canvas-grayDark">{q.title}</p>
                      <p className="text-xs text-gray-500">
                        Deleted {q.deletedAt ? new Date(q.deletedAt).toLocaleString() : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(q.id)}
                        className="btn-canvas-secondary text-xs"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(q.id)}
                        className="text-xs font-medium text-canvas-red hover:underline"
                      >
                        Delete forever
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </div>

      <CoursePickerModal
        open={Boolean(copyQuiz)}
        onClose={() => setCopyQuiz(null)}
        title="Copy quiz to course"
        courses={otherCourses}
        onSelect={handleCopyToCourse}
      />

      <ImportConflictModal
        open={Boolean(pendingImport)}
        conflictTitle={pendingImport?.title ?? ""}
        kind="quiz"
        replaceHint="Overwrite the existing draft with this title. Published quizzes are never overwritten — the import is renamed instead."
        onClose={() => setPendingImport(null)}
        onResolve={(mode) => {
          if (pendingImport) createQuizFromImport(pendingImport, mode);
        }}
      />
    </div>
  );
}
