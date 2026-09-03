import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  FileUp,
  FolderInput,
  Library,
  Link2,
  Merge,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import BankImportHint from "../components/BankImportHint";
import CanvasModal from "../components/CanvasModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import CourseHeader from "../components/CourseHeader";
import CoursePickerModal from "../components/CoursePickerModal";
import ImportConflictModal from "../components/ImportConflictModal";
import PageIdentityHeader from "../components/PageIdentityHeader";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { htmlPreview } from "../utils/htmlPreview";
import { loadCourses } from "../utils/coursesStore";
import {
  BANK_AUDIENCE_LABELS,
  BANK_AUDIENCES,
  BANK_DIFFICULTIES,
  BANK_DIFFICULTY_LABELS,
  BANK_EXAM_USE_LABELS,
  BANK_EXAM_USES,
  BANK_STATUS_LABELS,
  BANK_STATUSES,
  bankMetaChipLabel,
  type BankAudience,
  type BankDifficulty,
  type BankExamUse,
  type BankStatus,
} from "../utils/bankMeta";
import { allDemoSeedBankIds } from "../data/demoBanks/catalog";
import {
  QUESTION_BANKS_CHANGED_EVENT,
  buildBankUsageReport,
  copyQuestionBankToCourse,
  createQuestionBank,
  deleteQuestionBank,
  linkQuestionBankToCourse,
  loadQuestionBanks,
  mergeQuestionBanks,
  questionBankEditorPath,
  resolveBankQuestions,
  updateQuestionBank,
  type QuestionBank,
} from "../utils/questionBanks";
import { bankImportTemplateCsv, exportBankToJson } from "../utils/questionBankImport";
import {
  parseAnyQuestionImport,
  remapImportedQuestions,
  resolveImportTitle,
  titleFromFilename,
  type ImportConflictMode,
} from "../utils/quizImportFormats";
import {
  downloadTextFile,
  exportBankToQtiXml,
  quizQtiFilename,
} from "../utils/quizQtiExport";
import {
  QUIZ_QUESTION_TYPE_LABELS,
  totalQuizQuestionPoints,
  type QuizQuestion,
  type QuizQuestionType,
} from "../utils/quizzes";

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Questions staged while a bank title conflict is resolved. */
type PendingBankImport = {
  title: string;
  questions: QuizQuestion[];
  notes?: string;
  audience?: BankAudience;
  difficulty?: BankDifficulty;
  examUse?: BankExamUse;
  status?: BankStatus;
  tags?: string[];
};

type BankKindFilter = "all" | "bundled" | "custom" | "linked";
type BankSortKey = "updated" | "title" | "questions" | "audience";

const FILTER_SELECT =
  "h-10 w-full rounded-lg border border-gray-200 bg-arc-paper px-3 text-sm text-canvas-grayDark shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200";
const TOPIC_PREVIEW = 8;

export default function QuestionBanksPage() {
  const { courseId = "" } = useParams();
  const navigate = useNavigate();
  const { canEditCourseContent } = usePermissions();
  const { showToast } = useToast();
  const [banks, setBanks] = useState<QuestionBank[]>(() => loadQuestionBanks(courseId));
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<QuestionBank | null>(null);
  const [copyBank, setCopyBank] = useState<QuestionBank | null>(null);
  const [copyMode, setCopyMode] = useState<"copy" | "link">("copy");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [usageOpen, setUsageOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingBankImport | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<BankAudience | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<BankDifficulty | "all">("all");
  const [useFilter, setUseFilter] = useState<BankExamUse | "all">("all");
  const [statusFilter, setStatusFilter] = useState<BankStatus | "all">("all");
  const [kindFilter, setKindFilter] = useState<BankKindFilter>("all");
  const [typeFilter, setTypeFilter] = useState<QuizQuestionType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<BankSortKey>("updated");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [topicsExpanded, setTopicsExpanded] = useState(false);

  const otherCourses = useMemo(
    () => loadCourses(false).filter((c) => c.id !== courseId),
    [courseId, banks],
  );
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setBanks(loadQuestionBanks(courseId));
    refresh();
    window.addEventListener(QUESTION_BANKS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUESTION_BANKS_CHANGED_EVENT, refresh);
  }, [courseId]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => banks.some((b) => b.id === id)));
  }, [banks]);

  useEffect(() => {
    if (!canEditCourseContent) navigate(`/courses/${courseId}/quizzes`, { replace: true });
  }, [canEditCourseContent, courseId, navigate]);

  const seedIds = useMemo(() => allDemoSeedBankIds(courseId), [courseId]);

  const allTags = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const bank of banks) {
      for (const tag of bank.tags ?? []) {
        const key = tag.toLowerCase();
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { label: tag, count: 1 });
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
  }, [banks]);

  const visibleTags = useMemo(() => {
    if (topicsExpanded) return allTags;
    const preview = allTags.slice(0, TOPIC_PREVIEW);
    if (tagFilter && !preview.some((t) => t.label.toLowerCase() === tagFilter.toLowerCase())) {
      const extra = allTags.find((t) => t.label.toLowerCase() === tagFilter.toLowerCase());
      if (extra) return [...preview, extra];
    }
    return preview;
  }, [allTags, topicsExpanded, tagFilter]);

  const advancedFiltersActive =
    statusFilter !== "all" || kindFilter !== "all" || typeFilter !== "all";

  const filtersActive =
    query.trim() !== "" ||
    audienceFilter !== "all" ||
    difficultyFilter !== "all" ||
    useFilter !== "all" ||
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    typeFilter !== "all" ||
    tagFilter != null;

  const clearFilters = () => {
    setQuery("");
    setAudienceFilter("all");
    setDifficultyFilter("all");
    setUseFilter("all");
    setStatusFilter("all");
    setKindFilter("all");
    setTypeFilter("all");
    setTagFilter(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const audienceOrder = BANK_AUDIENCES;
    const next = banks.filter((b) => {
      if (audienceFilter !== "all" && b.audience !== audienceFilter) return false;
      if (difficultyFilter !== "all" && b.difficulty !== difficultyFilter) return false;
      if (useFilter !== "all" && b.examUse !== useFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (tagFilter && !(b.tags ?? []).some((t) => t.toLowerCase() === tagFilter.toLowerCase())) {
        return false;
      }
      const isBundled = seedIds.has(b.id);
      const isLinked = Boolean(b.sourceBankRef);
      if (kindFilter === "bundled" && !isBundled) return false;
      if (kindFilter === "linked" && !isLinked) return false;
      if (kindFilter === "custom" && (isBundled || isLinked)) return false;
      const qs = resolveBankQuestions(b);
      if (typeFilter !== "all" && !qs.some((qq) => qq.type === typeFilter)) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.notes ?? "").toLowerCase().includes(q) ||
        (b.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        qs.some((qq) => qq.prompt.toLowerCase().includes(q))
      );
    });
    next.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "questions") {
        return resolveBankQuestions(b).length - resolveBankQuestions(a).length;
      }
      if (sort === "audience") {
        return audienceOrder.indexOf(a.audience) - audienceOrder.indexOf(b.audience);
      }
      return b.updatedAt - a.updatedAt;
    });
    return next;
  }, [
    banks,
    query,
    audienceFilter,
    difficultyFilter,
    useFilter,
    statusFilter,
    kindFilter,
    typeFilter,
    tagFilter,
    sort,
    seedIds,
  ]);

  const readyCount = useMemo(
    () => banks.filter((b) => b.status === "ready").length,
    [banks],
  );
  const linkedCount = useMemo(
    () => banks.filter((b) => Boolean(b.sourceBankRef)).length,
    [banks],
  );
  const bundledCount = useMemo(
    () => banks.filter((b) => seedIds.has(b.id)).length,
    [banks, seedIds],
  );

  const onCreate = () => {
    navigate(`/courses/${courseId}/question-banks/new`);
  };

  /** Create (or replace) a bank from a staged import once conflicts are resolved. */
  const createBankFromImport = (
    bundle: PendingBankImport,
    mode: ImportConflictMode,
  ) => {
    const all = loadQuestionBanks(courseId);
    const desired = bundle.title.trim() || "Imported bank";

    if (mode === "replace") {
      const target = all.find(
        (b) => b.title.trim().toLowerCase() === desired.toLowerCase(),
      );
      if (target) {
        updateQuestionBank(courseId, target.id, {
          questions: bundle.questions,
          notes: bundle.notes ?? target.notes,
          audience: bundle.audience ?? target.audience,
          difficulty: bundle.difficulty ?? target.difficulty,
          examUse: bundle.examUse ?? target.examUse,
          status: bundle.status ?? target.status,
          tags: bundle.tags ?? target.tags,
        });
        showToast(`Replaced questions in “${target.title}”`, "positive", "saved");
        navigate(questionBankEditorPath(courseId, target.id));
        return;
      }
    }

    const title = resolveImportTitle(
      desired,
      all.map((b) => b.title),
      mode === "replace" ? "rename" : mode,
    );
    if (!title) {
      showToast(`Skipped “${desired}” — a bank with that title already exists`, "neutral", "saved");
      return;
    }
    const bank = createQuestionBank(courseId, title);
    updateQuestionBank(courseId, bank.id, {
      questions: bundle.questions,
      notes: bundle.notes ?? "",
      audience: bundle.audience,
      difficulty: bundle.difficulty,
      examUse: bundle.examUse,
      status: bundle.status ?? "draft",
      tags: bundle.tags,
    });
    showToast(
      `Imported ${bundle.questions.length} question${
        bundle.questions.length === 1 ? "" : "s"
      } into “${title}”`,
      "positive",
      "files",
    );
    navigate(questionBankEditorPath(courseId, bank.id));
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseAnyQuestionImport(file.name, text);
      if (parsed.questions.length === 0) {
        showToast(parsed.warnings[0] ?? "No questions found in file", "negative");
        return;
      }
      if (parsed.warnings.length > 0) showToast(parsed.warnings[0]!, "neutral", "errors");
      const bundle: PendingBankImport = {
        title: parsed.title.trim() || titleFromFilename(file.name) || "Imported bank",
        questions: remapImportedQuestions(parsed.questions),
        notes: parsed.notes,
        audience: parsed.audience,
        difficulty: parsed.difficulty,
        examUse: parsed.examUse,
        status: parsed.status,
        tags: parsed.tags,
      };
      const conflict = loadQuestionBanks(courseId).some(
        (b) => b.title.trim().toLowerCase() === bundle.title.trim().toLowerCase(),
      );
      if (conflict) {
        setPendingImport(bundle);
        return;
      }
      createBankFromImport(bundle, "rename");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "negative");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onMergeSelected = () => {
    const titles = selectedIds
      .map((id) => banks.find((b) => b.id === id)?.title)
      .filter(Boolean) as string[];
    const merged = mergeQuestionBanks(
      courseId,
      selectedIds,
      `Merged: ${titles.join(" + ")}`,
    );
    if (!merged) {
      showToast("Select at least two banks to merge", "negative");
      return;
    }
    setSelectedIds([]);
    showToast(
      `Merged ${titles.length} banks into “${merged.title}” (${merged.questions.length} questions)`,
      "positive",
      "saved",
    );
    navigate(questionBankEditorPath(courseId, merged.id));
  };

  const exportQti = (bank: QuestionBank) => {
    downloadTextFile(
      quizQtiFilename(bank.title || "question-bank"),
      exportBankToQtiXml({ ...bank, questions: resolveBankQuestions(bank) }),
      "application/xml",
    );
    showToast("Bank exported as QTI XML", "positive", "files");
  };

  const usageRows = useMemo(
    () => (usageOpen ? buildBankUsageReport(courseId) : []),
    [usageOpen, courseId],
  );

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="relative flex-1 overflow-y-auto bg-transparent">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-canvas-blueTint/50 to-transparent"
          aria-hidden
        />
        <div className="relative px-8 py-8">
          <PageIdentityHeader
            size="md"
            icon="library"
            label="Question Banks"
            description="Build shared pools once, then pull them into any quiz."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}/quizzes`)}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quizzes
                </button>
                <button
                  type="button"
                  onClick={() => setUsageOpen(true)}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  Usage
                </button>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <FileUp className="h-4 w-4" />
                  Import
                </button>
                <button
                  type="button"
                  onClick={onCreate}
                  className="btn-canvas-primary inline-flex items-center gap-1.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  New bank
                </button>
              </div>
            }
          />

          <input
            ref={importRef}
            type="file"
            accept=".json,.csv,.md,.markdown,.txt,.xml,application/json,text/csv,text/plain,application/xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onImportFile(file);
            }}
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total banks", value: banks.length, hint: `${filtered.length} visible` },
              { label: "Ready", value: readyCount, hint: "Marked ready for quizzes" },
              { label: "Linked", value: linkedCount, hint: "Shared from another course" },
              { label: "Bundled packs", value: bundledCount, hint: "Built-in library banks" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-arc-paper px-4 py-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-canvas-grayDark">{card.value}</p>
                <p className="mt-1 text-xs text-gray-500">{card.hint}</p>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-canvas-grayDark">Find the right bank</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Search, then narrow by year, difficulty, or topic.
                </p>
              </div>
              <p className="text-xs font-medium text-gray-500">
                {filtered.length} of {banks.length} bank{banks.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, notes, topics, or questions…"
                  className="form-input w-full py-2.5 pl-9 pr-9 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen((open) => !open)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                    moreFiltersOpen || advancedFiltersActive
                      ? "border-canvas-blue bg-canvas-blueTint text-canvas-blueDark"
                      : "border-gray-200 bg-arc-paper text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  More filters
                  {advancedFiltersActive && (
                    <span className="rounded-full bg-canvas-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {[
                        statusFilter !== "all",
                        kindFilter !== "all",
                        typeFilter !== "all",
                      ].filter(Boolean).length}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${moreFiltersOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilters();
                      setMoreFiltersOpen(false);
                    }}
                    className="inline-flex h-10 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-canvas-blue hover:bg-canvas-blueTint"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Year
                </span>
                <select
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value as BankAudience | "all")}
                  className={FILTER_SELECT}
                  aria-label="Filter by year of instruction"
                >
                  <option value="all">All years</option>
                  {BANK_AUDIENCES.filter((k) => k !== "any").map((key) => (
                    <option key={key} value={key}>
                      {BANK_AUDIENCE_LABELS[key]}
                    </option>
                  ))}
                  <option value="any">Unspecified year</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Difficulty
                </span>
                <select
                  value={difficultyFilter}
                  onChange={(e) =>
                    setDifficultyFilter(e.target.value as BankDifficulty | "all")
                  }
                  className={FILTER_SELECT}
                  aria-label="Filter by difficulty"
                >
                  <option value="all">All difficulties</option>
                  {BANK_DIFFICULTIES.map((key) => (
                    <option key={key} value={key}>
                      {BANK_DIFFICULTY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Intended use
                </span>
                <select
                  value={useFilter}
                  onChange={(e) => setUseFilter(e.target.value as BankExamUse | "all")}
                  className={FILTER_SELECT}
                  aria-label="Filter by intended use"
                >
                  <option value="all">All uses</option>
                  {BANK_EXAM_USES.filter((k) => k !== "any").map((key) => (
                    <option key={key} value={key}>
                      {BANK_EXAM_USE_LABELS[key]}
                    </option>
                  ))}
                  <option value="any">Unspecified use</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Sort
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as BankSortKey)}
                  className={FILTER_SELECT}
                  aria-label="Sort banks"
                >
                  <option value="updated">Recently updated</option>
                  <option value="title">Title A–Z</option>
                  <option value="questions">Most questions</option>
                  <option value="audience">Year of instruction</option>
                </select>
              </label>
            </div>

            {moreFiltersOpen && (
              <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as BankStatus | "all")}
                    className={FILTER_SELECT}
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    {BANK_STATUSES.map((key) => (
                      <option key={key} value={key}>
                        {BANK_STATUS_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Source
                  </span>
                  <select
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value as BankKindFilter)}
                    className={FILTER_SELECT}
                    aria-label="Filter by bank source"
                  >
                    <option value="all">All sources</option>
                    <option value="bundled">Bundled packs</option>
                    <option value="custom">Course banks</option>
                    <option value="linked">Linked</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Question type
                  </span>
                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as QuizQuestionType | "all")
                    }
                    className={FILTER_SELECT}
                    aria-label="Filter by question type"
                  >
                    <option value="all">Any question type</option>
                    {(Object.keys(QUIZ_QUESTION_TYPE_LABELS) as QuizQuestionType[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          Has {QUIZ_QUESTION_TYPE_LABELS[key]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            )}

            {allTags.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Popular topics
                  </span>
                  {allTags.length > TOPIC_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setTopicsExpanded((open) => !open)}
                      className="text-xs font-medium text-canvas-blue hover:underline"
                    >
                      {topicsExpanded
                        ? "Show fewer"
                        : `Show all ${allTags.length}`}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleTags.map((tag) => {
                    const active = tagFilter?.toLowerCase() === tag.label.toLowerCase();
                    return (
                      <button
                        key={tag.label}
                        type="button"
                        onClick={() => setTagFilter(active ? null : tag.label)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-canvas-blue text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-canvas-blueTint"
                        }`}
                      >
                        {tag.label}
                        <span className={active ? "text-white/80" : "text-gray-400"}>
                          {tag.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <BankImportHint />
            <button
              type="button"
              onClick={() =>
                downloadText(
                  "question-bank-template.csv",
                  bankImportTemplateCsv(),
                  "text/csv",
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-canvas-blue hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              CSV template
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-canvas-border bg-canvas-grayLight px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-canvas-grayDark">
                {selectedIds.length} bank{selectedIds.length === 1 ? "" : "s"} selected
              </span>
              <button
                type="button"
                onClick={onMergeSelected}
                disabled={selectedIds.length < 2}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm disabled:opacity-50"
              >
                <Merge className="h-3.5 w-3.5" />
                Merge selected
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const id of selectedIds) {
                    updateQuestionBank(courseId, id, { status: "ready" });
                  }
                  showToast(
                    `Marked ${selectedIds.length} bank${selectedIds.length === 1 ? "" : "s"} ready`,
                    "positive",
                    "saved",
                  );
                }}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark ready
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

          {filtered.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-canvas-blue/30 bg-canvas-blueTint/20 px-6 py-12 text-center">
              <Library className="mx-auto h-10 w-10 text-canvas-blue/50" />
              <p className="mt-3 text-sm font-semibold text-canvas-grayDark">
                {banks.length === 0 ? "No question banks yet" : "No banks match these filters"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {banks.length === 0
                  ? "Create a bank or import JSON / CSV / Markdown / QTI / Moodle / Aiken to get started."
                  : "Try clearing filters or using a different search term."}
              </p>
              {banks.length === 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={onCreate} className="btn-canvas-primary text-sm">
                    Create bank
                  </button>
                  <button
                    type="button"
                    onClick={() => importRef.current?.click()}
                    className="btn-canvas-secondary text-sm"
                  >
                    Import file
                  </button>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((bank) => {
                const bankQuestions = resolveBankQuestions(bank);
                return (
                <li key={bank.id} className="h-full">
                  <div className="group flex h-full flex-col rounded-3xl border border-gray-200 bg-arc-paper p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-canvas-blue/40 hover:shadow-md">
                    <div className="flex min-h-0 flex-1 items-stretch gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(bank.id)}
                        onChange={() => toggleSelected(bank.id)}
                        aria-label={`Select ${bank.title} for merge`}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                    <div className="flex min-w-0 flex-1 flex-col">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(questionBankEditorPath(courseId, bank.id))
                      }
                      className="flex flex-1 flex-col text-left"
                    >
                      <p className="truncate text-base font-semibold text-canvas-grayDark group-hover:text-canvas-blue">
                        {bank.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {bank.sourceBankRef && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2 py-0.5 text-[11px] font-medium text-canvas-blueDark">
                            <Link2 className="h-3 w-3" />
                            Linked
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            bank.status === "ready"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {BANK_STATUS_LABELS[bank.status]}
                        </span>
                        {bankMetaChipLabel(bank).map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                          >
                            {chip}
                          </span>
                        ))}
                        {(bank.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-canvas-blueTint/70 px-2 py-0.5 text-[11px] font-medium text-canvas-blueDark"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {bankQuestions.length} question
                        {bankQuestions.length === 1 ? "" : "s"} ·{" "}
                        {totalQuizQuestionPoints(bankQuestions)} pts
                      </p>
                      <div className="mt-2 min-h-[2.5rem]">
                        {htmlPreview(bank.notes).text ? (
                          <p className="line-clamp-2 text-xs text-gray-500">
                            {htmlPreview(bank.notes).text}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-auto pt-3 text-[11px] text-gray-400">
                        Updated{" "}
                        {new Date(bank.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </button>
                    </div>
                    </div>
                    <div className="mt-4 flex min-h-[2.75rem] shrink-0 flex-wrap items-center gap-1 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => navigate(questionBankEditorPath(courseId, bank.id))}
                        className="btn-canvas-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadText(
                            `${bank.title.replace(/[^\w.-]+/g, "_").slice(0, 40) || "bank"}.json`,
                            exportBankToJson({ ...bank, questions: bankQuestions }),
                            "application/json",
                          );
                          showToast("Bank exported", "positive", "files");
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export
                      </button>
                      <Tooltip label="Download QTI 1.2 XML">
                        <button
                          type="button"
                          onClick={() => exportQti(bank)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          QTI
                        </button>
                      </Tooltip>
                      {otherCourses.length > 0 && (
                        <>
                          <Tooltip label="Copy a full duplicate to another course">
                            <button
                              type="button"
                              onClick={() => {
                                setCopyMode("copy");
                                setCopyBank(bank);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              aria-label="Copy bank to another course"
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                              Copy
                            </button>
                          </Tooltip>
                          <Tooltip label="Link this bank into another course (edits there make a local copy)">
                            <button
                              type="button"
                              onClick={() => {
                                setCopyMode("link");
                                setCopyBank(bank);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              aria-label="Link bank to another course"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Link
                            </button>
                          </Tooltip>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(bank)}
                        className="ml-auto rounded-md p-1.5 text-canvas-red hover:bg-red-50"
                        aria-label="Delete bank"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete question bank?"
        description={
          deleteTarget
            ? deleteTarget.sourceBankRef
              ? `The link to “${
                  deleteTarget.sourceBankRef.titleAtLink ?? deleteTarget.title
                }” will be removed from this course. The source bank is not affected.`
              : `“${deleteTarget.title}” and its ${deleteTarget.questions.length} question${
                  deleteTarget.questions.length === 1 ? "" : "s"
                } will be removed. This cannot be undone.`
            : undefined
        }
        confirmText="Delete bank"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteQuestionBank(courseId, deleteTarget.id);
          showToast("Bank deleted", "neutral", "deleted");
          setDeleteTarget(null);
        }}
      />

      <CoursePickerModal
        open={Boolean(copyBank)}
        onClose={() => setCopyBank(null)}
        title={copyMode === "link" ? "Link bank into course" : "Copy bank to course"}
        courses={otherCourses}
        onSelect={(targetCourseId) => {
          if (!copyBank) return;
          const course = loadCourses().find((c) => c.id === targetCourseId);
          const courseLabel = course?.code || course?.title || "course";
          if (copyMode === "link") {
            const link = linkQuestionBankToCourse(copyBank, targetCourseId);
            setCopyBank(null);
            showToast(
              `Linked “${link.title}” into ${courseLabel} — edits there create a local copy`,
              "positive",
              "created",
            );
            return;
          }
          const copy = copyQuestionBankToCourse(copyBank, targetCourseId);
          setCopyBank(null);
          showToast(`Copied “${copy.title}” to ${courseLabel}`, "positive", "created");
        }}
      />

      <ImportConflictModal
        open={Boolean(pendingImport)}
        conflictTitle={pendingImport?.title ?? ""}
        kind="question bank"
        replaceHint="Overwrite the questions in the existing bank with this title."
        onClose={() => setPendingImport(null)}
        onResolve={(mode) => {
          if (pendingImport) createBankFromImport(pendingImport, mode);
        }}
      />

      {usageOpen && (
        <CanvasModal title="Bank usage" onClose={() => setUsageOpen(false)} size="lg">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Quizzes in this course that draw questions from a bank pool.
            </p>
            {usageRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-sm text-gray-600">
                No quiz in this course draws from a question bank yet.
              </p>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Bank</th>
                      <th className="px-3 py-2">Quiz</th>
                      <th className="px-3 py-2 text-right">Picks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row) => (
                      <tr
                        key={`${row.bankId}-${row.quizId}`}
                        className="border-t border-gray-100"
                      >
                        <td className="px-3 py-2 font-medium text-canvas-grayDark">
                          {row.bankTitle}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{row.quizTitle}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                          {row.pickCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CanvasModal>
      )}
    </div>
  );
}
