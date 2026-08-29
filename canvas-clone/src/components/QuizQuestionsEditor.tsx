import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileUp,
  FolderInput,
  GripVertical,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Library,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuizQuestionCard from "./QuizQuestionCard";
import QuizCodeEditor from "./QuizCodeEditor";
import BankImportHint from "./BankImportHint";
import { QuizPhase7EditorFields, QuizPhase7QuestionOptions } from "./QuizPhase7EditorFields";
import QuizEditorDisclosure from "./QuizEditorDisclosure";
import CanvasModal from "./CanvasModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { useToast } from "./ui/Toast";
import { bankImportTemplateCsv } from "../utils/questionBankImport";
import {
  parseAnyQuestionImport,
  remapImportedQuestions,
} from "../utils/quizImportFormats";
import {
  downloadJsonFile,
  exportQuizQuestionsToJson,
  quizExportFilename,
} from "../utils/quizExport";
import {
  applyAssignedQuestionPoints,
  summarizePointAssignments,
} from "../utils/questionPointsAgent";
import { searchQuestionsInBanks } from "../utils/questionBanks";
import {
  createDefaultEssayRubric,
  createEssayRubricCriterion,
  sumRubricMaxPoints,
  withEssayCriterionPoints,
} from "../utils/assignmentRubric";
import {
  CODE_LANGUAGE_LABELS,
  codingUsesTestRunner,
  countInlineAttemptItems,
  createCodeTestCase,
  createMatchingPair,
  createQuizQuestion,
  formatPoints,
  groupExpectedPoints,
  isCodeRunnerLanguage,
  isHtmlCssRunnerLanguage,
  loadQuizzes,
  saveQuizzes,
  starterForLanguage,
  quizItemLabel,
  QUIZ_QUESTION_TYPE_LABELS,
  totalQuizQuestionPoints,
  uid,
  withCodeTestHashes,
  type BloomLevel,
  type CodeLanguage,
  type CodeFile,
  type CodeTestCase,
  type MatchingPair,
  type QuestionDifficulty,
  type Quiz,
  type QuizQuestion,
  type QuizQuestionType,
} from "../utils/quizzes";
import {
  runCodeTests,
  type CodeTestRunResult,
} from "../utils/codeRunner";
import {
  downloadTextFile,
  exportQuizToQtiXml,
  quizQtiFilename,
} from "../utils/quizQtiExport";

type Props = {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  /** Extra questions drawn from banks each attempt (quiz editor only). */
  bankDrawCount?: number;
  /** Quiz total points — when set, attempt scores scale to this. */
  quizPointsTarget?: number;
  /** Survey quizzes have no answer keys or points. */
  surveyMode?: boolean;
  /** Nested editor for question-group members (hides import chrome). */
  nested?: boolean;
  /** Restrict selectable types (e.g. exclude nested groups). */
  allowedTypes?: QuizQuestionType[];
  /** Used for JSON export filename / title. */
  quizTitle?: string;
  /** Enables “Copy to another quiz…” on each item (quiz + bank editors). */
  courseId?: string;
  /** Excluded from the copy-target list. */
  currentQuizId?: string;
  /** Bank editor: multi-select, bulk edit/delete, and confirm before removing items. */
  bankMode?: boolean;
  /** Quiz editor: same bulk/select tools without bank-only labels (#63). */
  bulkEditMode?: boolean;
  /** Monaco code editor for coding fields (#31). */
  useMonacoEditor?: boolean;
};

const ALL_QUESTION_TYPES = Object.keys(QUIZ_QUESTION_TYPE_LABELS) as QuizQuestionType[];
const MEMBER_QUESTION_TYPES = ALL_QUESTION_TYPES.filter((t) => t !== "group");

function questionHasFeedback(q: QuizQuestion): boolean {
  return Boolean(
    (q.correctFeedback ?? "").trim() ||
      (q.incorrectFeedback ?? "").trim() ||
      (q.feedback ?? "").trim() ||
      (q.choiceFeedbacks ?? []).some((t) => (t ?? "").trim()),
  );
}

function codingTestOptionsActive(t: CodeTestCase): boolean {
  return (
    (t.weight != null && t.weight !== 1) ||
    t.timeoutMs != null ||
    Boolean((t.expectedRegex ?? "").trim()) ||
    Boolean((t.assertJs ?? "").trim()) ||
    Boolean(t.propertyHarness?.enabled)
  );
}

function codingAdvancedActive(q: QuizQuestion): boolean {
  if (q.type !== "coding") return false;
  if (q.tsTranspileMode && q.tsTranspileMode !== "transpile") return true;
  if (q.codeTimeoutMs != null && q.codeTimeoutMs !== 2000) return true;
  if ((q.sqlSetup ?? "").trim()) return true;
  if ((q.codeFiles ?? []).length > 0) return true;
  return false;
}

function questionAdvancedActive(q: QuizQuestion): boolean {
  if (q.omitFromAnswerKey) return true;
  if ((q.tags ?? []).length > 0) return true;
  if (q.difficulty) return true;
  if (q.bloomLevel) return true;
  if (q.extraCredit) return true;
  if (q.requireEssayComment) return true;
  if (q.partialCredit !== undefined) return true;
  if (q.partialCreditPenalty !== undefined) return true;
  if (q.nearMatchThreshold !== undefined) return true;
  if (q.numericalBandPreset && q.numericalBandPreset !== "exact") return true;
  if (codingAdvancedActive(q)) return true;
  return false;
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SortableQuestionRow({
  id,
  enabled,
  className,
  setShellRef,
  children,
}: {
  id: string;
  enabled: boolean;
  className?: string;
  setShellRef?: (el: HTMLDivElement | null) => void;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !enabled });
  const style = enabled
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.92 : 1,
      }
    : undefined;
  const dragHandle = enabled ? (
    <button
      type="button"
      className="cursor-grab rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
      title="Drag to reorder"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  ) : null;
  return (
    <div
      ref={(el) => {
        if (enabled) setNodeRef(el);
        setShellRef?.(el);
      }}
      style={style}
      className={className}
    >
      {children(dragHandle)}
    </div>
  );
}

/** Hazy line + circle plus to insert a question after `afterIndex` (−1 = at start). */
function InsertQuestionDivider({
  onInsert,
  label = "Add question here",
}: {
  onInsert: () => void;
  label?: string;
}) {
  return (
    <div className="group relative flex h-7 items-center justify-center">
      <div
        className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gray-300/50 transition-colors group-hover:bg-canvas-blue/40"
        aria-hidden
      />
      <button
        type="button"
        onClick={onInsert}
        title={label}
        aria-label={label}
        className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border border-gray-300/70 bg-white text-gray-400 opacity-45 shadow-sm transition-all hover:border-canvas-blue hover:bg-canvas-blueTint hover:text-canvas-blue hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-blue/40 group-hover:opacity-100"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export default function QuizQuestionsEditor({
  questions,
  onChange,
  bankDrawCount = 0,
  quizPointsTarget,
  surveyMode = false,
  nested = false,
  allowedTypes,
  quizTitle = "Quiz",
  courseId,
  currentQuizId,
  bankMode = false,
  bulkEditMode = false,
  useMonacoEditor = false,
}: Props) {
  const bulkTools = bankMode || bulkEditMode;
  const { showToast } = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const questionElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollId = useRef<string | null>(null);
  const QUESTION_TYPES = allowedTypes?.length ? allowedTypes : ALL_QUESTION_TYPES;
  const [sampleRunById, setSampleRunById] = useState<
    Record<string, CodeTestRunResult[]>
  >({});
  const [sampleRunningId, setSampleRunningId] = useState<string | null>(null);
  /** Collapsed question bodies (id → true). New questions start expanded. */
  const [collapsedById, setCollapsedById] = useState<Record<string, boolean>>({});
  /** Question staged for “Copy to another quiz…”. */
  const [copySource, setCopySource] = useState<QuizQuestion | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPoints, setBulkPoints] = useState("");
  const [questionQuery, setQuestionQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<QuizQuestionType[]>([]);
  const [itemScope, setItemScope] = useState<"all" | "scored" | "unscored" | "empty">("all");
  const lastAnchorId = useRef<string | null>(null);
  const canCopyToQuiz = Boolean(courseId) && !nested;

  useEffect(() => {
    const id = pendingScrollId.current;
    if (!id) return;
    pendingScrollId.current = null;
    const frame = requestAnimationFrame(() => {
      questionElRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [questions]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => questions.some((q) => q.id === id)));
  }, [questions]);

  const defaultQuestionType = (): QuizQuestionType =>
    QUESTION_TYPES.includes("multiple_choice")
      ? "multiple_choice"
      : QUESTION_TYPES[0] ?? "multiple_choice";

  const toastForNewQuestion = (next: QuizQuestion[], position: number) => {
    const q = next[position];
    if (!q) return;
    const kind =
      q.type === "group"
        ? "group"
        : q.type === "note"
          ? "note"
          : surveyMode
            ? "item"
            : "question";
    showToast(`Added ${kind} ${quizItemLabel(next, position)}`, "positive");
  };

  const insertQuestionAt = (index: number, type?: QuizQuestionType) => {
    const q = createQuizQuestion(type ?? defaultQuestionType());
    const next = [...questions];
    next.splice(index, 0, q);
    pendingScrollId.current = q.id;
    setCollapsedById((prev) => {
      const cleared = { ...prev };
      delete cleared[q.id];
      return cleared;
    });
    onChange(next);
    toastForNewQuestion(next, index);
  };

  const addQuestion = () => {
    insertQuestionAt(questions.length);
  };

  const addGroup = () => {
    insertQuestionAt(questions.length, "group");
  };

  const addQuestionBelow = (index: number) => {
    insertQuestionAt(index + 1);
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const mergeImported = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseAnyQuestionImport(file.name, text);
      if (parsed.questions.length === 0) {
        showToast(parsed.warnings[0] ?? "No questions found in file", "negative");
        return;
      }
      if (parsed.warnings.length > 0) showToast(parsed.warnings[0]!, "neutral");
      const importedRaw = remapImportedQuestions(parsed.questions);
      const imported = surveyMode
        ? importedRaw.map((q) => ({ ...q, points: 0 }))
        : applyAssignedQuestionPoints(importedRaw, { overwrite: true });
      if (imported[0]) pendingScrollId.current = imported[0].id;
      onChange([...questions, ...imported]);
      showToast(
        surveyMode
          ? `Imported ${imported.length} survey item${imported.length === 1 ? "" : "s"}`
          : `Imported ${imported.length} question${imported.length === 1 ? "" : "s"} · ${summarizePointAssignments(imported)}`,
        "positive",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "negative");
    }
  };

  /** Append a remapped copy of the staged item to another quiz in this course. */
  const copyQuestionToQuiz = (targetQuizId: string) => {
    if (!courseId || !copySource) return;
    const all = loadQuizzes(courseId);
    const target = all.find((q) => q.id === targetQuizId);
    if (!target) {
      showToast("That quiz no longer exists", "negative");
      setCopySource(null);
      return;
    }
    const merged = [...(target.questions ?? []), ...remapImportedQuestions([copySource])];
    const next: Quiz = {
      ...target,
      questions: merged,
      questionCount: merged.length,
      updatedAt: Date.now(),
    };
    saveQuizzes(
      courseId,
      all.map((q) => (q.id === target.id ? next : q)),
    );
    const kind =
      copySource.type === "group"
        ? "Group"
        : copySource.type === "note"
          ? "Note"
          : "Question";
    setCopySource(null);
    showToast(`${kind} copied to “${target.title}”`, "positive");
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remapQuestionCopy = (question: QuizQuestion): QuizQuestion => ({
    ...question,
    id: uid("qq"),
    codeTests: question.codeTests?.map((t) => ({ ...t, id: uid("ct") })),
    groupQuestions: question.groupQuestions?.map(remapQuestionCopy),
    matchingPairs: question.matchingPairs?.map((p) => ({ ...p, id: uid("mp") })),
  });

  const duplicateQuestion = (index: number) => {
    const q = questions[index];
    if (!q) return;
    const copy = remapQuestionCopy(q);
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    onChange(next);
    showToast(`Duplicated ${quizItemLabel(questions, index)}`, "positive");
  };

  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findBanksOpen, setFindBanksOpen] = useState(false);
  const [findBanksQuery, setFindBanksQuery] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const applyFindReplace = () => {
    const needle = findText.trim();
    if (!needle) {
      showToast("Enter text to find", "negative");
      return;
    }
    let hits = 0;
    const next = questions.map((q) => {
      if (!q.prompt.includes(needle)) return q;
      hits += 1;
      return { ...q, prompt: q.prompt.split(needle).join(replaceText) };
    });
    onChange(next);
    showToast(`Updated ${hits} prompt${hits === 1 ? "" : "s"}`, hits ? "positive" : "neutral");
    setFindReplaceOpen(false);
  };

  const [previewQuestion, setPreviewQuestion] = useState<QuizQuestion | null>(null);
  const [previewAnswer, setPreviewAnswer] = useState<Record<string, import("../utils/quizSubmissions").QuizAnswer>>({});

  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    onChange(
      questions.map((q) => {
        if (q.id !== id) return q;
        const next = { ...q, ...patch };
        if ("codeTests" in patch || ("language" in patch && next.codeTests)) {
          next.codeTests = withCodeTestHashes(
            next.language,
            next.codeTests,
          );
        }
        // Allow clearing optional overrides.
        if ("partialCredit" in patch && patch.partialCredit === undefined) {
          delete next.partialCredit;
        }
        if ("partialCreditPenalty" in patch && patch.partialCreditPenalty === undefined) {
          delete next.partialCreditPenalty;
        }
        if ("partialTolerance" in patch && patch.partialTolerance === undefined) {
          delete next.partialTolerance;
        }
        if ("nearMatchThreshold" in patch && patch.nearMatchThreshold === undefined) {
          delete next.nearMatchThreshold;
        }
        if ("rubric" in patch && patch.rubric === undefined) {
          delete next.rubric;
        }
        return next;
      }),
    );
  };

  const itemKind = (q?: QuizQuestion) =>
    q?.type === "group"
      ? "group"
      : q?.type === "note"
        ? "note"
        : surveyMode
          ? "item"
          : "question";

  const performRemove = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    if (ids.length === 1) {
      const index = questions.findIndex((q) => q.id === ids[0]);
      const removed = index >= 0 ? questions[index] : undefined;
      const label =
        removed && index >= 0 ? quizItemLabel(questions, index) : "question";
      onChange(questions.filter((q) => q.id !== ids[0]));
      showToast(`Removed ${itemKind(removed)} ${label}`, "neutral");
    } else {
      onChange(questions.filter((q) => !idSet.has(q.id)));
      showToast(`Removed ${ids.length} items`, "neutral");
    }
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
  };

  const requestRemove = (ids: string[]) => {
    if (ids.length === 0) return;
    if (bulkTools) {
      setPendingDeleteIds(ids);
      return;
    }
    performRemove(ids);
  };

  const toggleSelected = (id: string, shiftKey = false) => {
    if (shiftKey && lastAnchorId.current) {
      const order = questions.map((q) => q.id);
      const a = order.indexOf(lastAnchorId.current);
      const b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = order.slice(lo, hi + 1);
        setSelectedIds((prev) => [...new Set([...prev, ...range])]);
        lastAnchorId.current = id;
        return;
      }
    }
    lastAnchorId.current = id;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const expandSelected = () => {
    const selected = new Set(selectedIds);
    setCollapsedById((prev) => {
      const next = { ...prev };
      for (const q of questions) {
        next[q.id] = !selected.has(q.id);
      }
      return next;
    });
    const first = questions.find((q) => selected.has(q.id));
    if (first) {
      requestAnimationFrame(() => {
        questionElRefs.current[first.id]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  };

  const applyBulkPoints = () => {
    const n = Number(bulkPoints);
    if (!Number.isFinite(n) || n < 0) {
      showToast("Enter a valid point value", "negative");
      return;
    }
    const pts = Math.max(0, Math.round(n));
    const selected = new Set(selectedIds);
    let updated = 0;
    const next = questions.map((q) => {
      if (!selected.has(q.id) || q.type === "note" || q.type === "group") return q;
      updated += 1;
      return { ...q, points: pts };
    });
    if (updated === 0) {
      showToast("None of the selected items take points", "neutral");
      return;
    }
    onChange(next);
    showToast(
      `Set ${pts} pt${pts === 1 ? "" : "s"} on ${updated} question${updated === 1 ? "" : "s"}`,
      "positive",
    );
  };

  const changeType = (question: QuizQuestion, type: QuizQuestionType) => {
    if (allowedTypes && !allowedTypes.includes(type)) return;
    const replacement = createQuizQuestion(type);
    const unscored = type === "note" || type === "group";
    const wasUnscored = question.type === "note" || question.type === "group";
    onChange(
      questions.map((q) =>
        q.id === question.id
          ? {
              ...replacement,
              id: q.id,
              prompt: q.prompt,
              points: unscored ? 0 : wasUnscored ? replacement.points : q.points,
            }
          : q,
      ),
    );
  };

  const updateChoice = (question: QuizQuestion, index: number, value: string) => {
    const choices = [...(question.choices ?? [])];
    choices[index] = value;
    updateQuestion(question.id, { choices });
  };

  const addChoice = (question: QuizQuestion) => {
    updateQuestion(question.id, { choices: [...(question.choices ?? []), ""] });
  };

  const removeChoice = (question: QuizQuestion, index: number) => {
    const choices = (question.choices ?? []).filter((_, i) => i !== index);
    const patch: Partial<QuizQuestion> = { choices };
    if (question.type === "multiple_choice") {
      const cur = question.correctChoiceIndex ?? 0;
      patch.correctChoiceIndex = cur === index ? 0 : cur > index ? cur - 1 : cur;
    } else if (question.type === "multiple_answers") {
      patch.correctChoiceIndices = (question.correctChoiceIndices ?? [])
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    }
    updateQuestion(question.id, patch);
  };

  const toggleCorrectIndex = (question: QuizQuestion, index: number) => {
    const set = new Set(question.correctChoiceIndices ?? []);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    updateQuestion(question.id, {
      correctChoiceIndices: [...set].sort((a, b) => a - b),
    });
  };

  const updateAccepted = (question: QuizQuestion, index: number, value: string) => {
    const acceptedAnswers = [...(question.acceptedAnswers ?? [])];
    acceptedAnswers[index] = value;
    updateQuestion(question.id, { acceptedAnswers });
  };

  const addAccepted = (question: QuizQuestion) => {
    updateQuestion(question.id, {
      acceptedAnswers: [...(question.acceptedAnswers ?? []), ""],
    });
  };

  const removeAccepted = (question: QuizQuestion, index: number) => {
    updateQuestion(question.id, {
      acceptedAnswers: (question.acceptedAnswers ?? []).filter((_, i) => i !== index),
    });
  };

  const updatePair = (question: QuizQuestion, pairId: string, patch: Partial<MatchingPair>) => {
    updateQuestion(question.id, {
      matchingPairs: (question.matchingPairs ?? []).map((p) =>
        p.id === pairId ? { ...p, ...patch } : p,
      ),
    });
  };

  const addPair = (question: QuizQuestion) => {
    updateQuestion(question.id, {
      matchingPairs: [...(question.matchingPairs ?? []), createMatchingPair()],
    });
  };

  const removePair = (question: QuizQuestion, pairId: string) => {
    updateQuestion(question.id, {
      matchingPairs: (question.matchingPairs ?? []).filter((p) => p.id !== pairId),
    });
  };

  const pointsTotal = totalQuizQuestionPoints(questions);
  const inlineAttemptItems = countInlineAttemptItems(questions);
  const attemptCount = inlineAttemptItems + Math.max(0, bankDrawCount);
  const targetPts =
    typeof quizPointsTarget === "number" && quizPointsTarget > 0
      ? quizPointsTarget
      : undefined;

  const typeCounts = useMemo(() => {
    const counts = {} as Record<QuizQuestionType, number>;
    for (const q of questions) {
      counts[q.type] = (counts[q.type] ?? 0) + 1;
    }
    return counts;
  }, [questions]);

  const displayed = useMemo(() => {
    const qtext = questionQuery.trim().toLowerCase();
    const typeSet = new Set(typeFilters);
    return questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => {
        if (!bulkTools || nested) return true;
        if (typeSet.size > 0 && !typeSet.has(question.type)) return false;
        if (itemScope === "scored" && (question.type === "note" || question.type === "group")) {
          return false;
        }
        if (itemScope === "unscored" && question.type !== "note" && question.type !== "group") {
          return false;
        }
        if (itemScope === "empty" && question.prompt.trim()) return false;
        if (qtext && !question.prompt.toLowerCase().includes(qtext)) return false;
        return true;
      });
  }, [questions, bulkTools, nested, questionQuery, typeFilters, itemScope]);

  const displayedIds = displayed.map(({ question }) => question.id);
  const questionFiltersActive =
    bulkTools &&
    (questionQuery.trim() !== "" || typeFilters.length > 0 || itemScope !== "all");
  const allSelected =
    bulkTools && displayedIds.length > 0 && displayedIds.every((id) => selectedIds.includes(id));
  const someSelected = bulkTools && selectedIds.length > 0 && !allSelected;
  const canReorder = !questionFiltersActive && displayed.length === questions.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === String(active.id));
    const newIndex = questions.findIndex((q) => q.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(questions, oldIndex, newIndex));
  };

  return (
    <div className={nested ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!nested && (
            <div className="flex items-center gap-2">
              {bulkTools && questions.length > 0 && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => {
                    if (allSelected) setSelectedIds([]);
                    else setSelectedIds(displayedIds);
                  }}
                  aria-label="Select all questions"
                  className="h-4 w-4 shrink-0"
                />
              )}
              <div className="form-section-title">Questions</div>
              {bulkTools && questions.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedById(
                        Object.fromEntries(questions.map((q) => [q.id, false])),
                      )
                    }
                    className="font-medium text-canvas-blue hover:underline"
                  >
                    Expand all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedById(
                        Object.fromEntries(questions.map((q) => [q.id, true])),
                      )
                    }
                    className="font-medium text-canvas-blue hover:underline"
                  >
                    Collapse all
                  </button>
                </div>
              )}
            </div>
          )}
          {nested ? (
            <p className="text-sm text-gray-600">
              {questions.length} question{questions.length === 1 ? "" : "s"} in pool
              {!surveyMode && pointsTotal > 0 ? (
                <> · {formatPoints(pointsTotal)} pts in pool</>
              ) : null}
            </p>
          ) : (
          <p className="mt-1 text-sm text-gray-600">
              {bankDrawCount > 0 ? (
                <>
                  {inlineAttemptItems} from quiz
                  {questions.some((q) => q.type === "group") ? " (incl. group picks)" : ""} +{" "}
                  {bankDrawCount} from banks ={" "}
                  <span className="font-medium text-canvas-grayDark">{attemptCount}</span> per
                  attempt
                </>
              ) : questions.some((q) => q.type === "group") ? (
                <>
                  {questions.length} item{questions.length === 1 ? "" : "s"} →{" "}
                  <span className="font-medium text-canvas-grayDark">
                    {inlineAttemptItems}
                  </span>{" "}
                  per attempt
                </>
              ) : (
                <>
                  {questions.length}{" "}
                  {surveyMode
                    ? `item${questions.length === 1 ? "" : "s"}`
                    : `question${questions.length === 1 ? "" : "s"}`}
                </>
              )}
              {!surveyMode && pointsTotal > 0 ? (
                <>
                  {" · "}
                  {targetPts != null ? (
                    <>
                      weights {formatPoints(pointsTotal)} pts → scaled to{" "}
                      <span className="font-medium text-canvas-grayDark">
                        {formatPoints(targetPts)}
                      </span>{" "}
                      pts
                    </>
                  ) : (
                    <>{formatPoints(pointsTotal)} pts (fixed weights)</>
                  )}
                </>
              ) : surveyMode ? (
                <span className="text-gray-500"> · no answer keys or points</span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!nested && (
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <FileUp className="h-4 w-4" />
              Import
            </button>
          )}
          {!nested && courseId && (
            <button
              type="button"
              onClick={() => setFindBanksOpen(true)}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Library className="h-4 w-4" />
              Find in banks
            </button>
          )}
          {!nested && questions.length > 0 && (
            <button
              type="button"
              onClick={() => setFindReplaceOpen(true)}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Search className="h-4 w-4" />
              Find / replace
            </button>
          )}
          {!nested && questions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                downloadJsonFile(
                  quizExportFilename(quizTitle),
                  exportQuizQuestionsToJson(quizTitle, questions),
                );
                showToast("Questions exported as JSON", "positive");
              }}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              title="Download questions as JSON (re-importable)"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
          {!nested && questions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const stub = {
                  id: "export",
                  title: quizTitle,
                  questions,
                } as Quiz;
                downloadTextFile(
                  quizQtiFilename(quizTitle),
                  exportQuizToQtiXml(stub),
                  "application/xml",
                );
                showToast("Questions exported as QTI XML", "positive");
              }}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              title="Download basic QTI 1.2 XML"
            >
              <Download className="h-4 w-4" />
              Export QTI
            </button>
          )}
          {!nested && !surveyMode && questions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = applyAssignedQuestionPoints(questions, { overwrite: true });
                onChange(next);
                showToast(
                  `Points updated · ${summarizePointAssignments(next)}`,
                  "positive",
                );
              }}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              title="Assign points from question type and content (recall → synthesis)"
            >
              <Sparkles className="h-4 w-4" />
              Auto-assign points
            </button>
          )}
          {!nested && QUESTION_TYPES.includes("group") && (
            <button
              type="button"
              onClick={addGroup}
              className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              title="Add a local pick-N question group"
            >
              <Plus className="h-4 w-4" />
              Group
            </button>
          )}
        <button
          type="button"
          onClick={addQuestion}
          className="btn-canvas-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
        >
          <Plus className="h-4 w-4" />
            {nested ? "Add to group" : surveyMode ? "Item" : "Question"}
        </button>
        </div>
      </div>

      {!nested && (
      <div className="flex flex-wrap items-center gap-3">
        <BankImportHint />
        <button
          type="button"
          onClick={() =>
            downloadText("quiz-questions-template.csv", bankImportTemplateCsv(), "text/csv")
          }
          className="inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          CSV template
        </button>
      </div>
      )}

      {!nested && (
      <input
        ref={importRef}
        type="file"
        accept=".json,.csv,.md,.markdown,.txt,.xml,application/json,text/csv,text/plain,application/xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void mergeImported(file);
        }}
      />
      )}

      {bulkTools && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-canvas-border bg-canvas-grayLight px-3 py-2">
          <span className="text-sm font-medium text-canvas-grayDark">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => {
              expandSelected();
              setBulkPoints("");
              setBulkEditOpen(true);
            }}
            className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit selected
          </button>
          <button
            type="button"
            onClick={() => requestRemove(selectedIds)}
            className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1 text-sm text-canvas-red hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
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

      {bulkTools && questions.length > 0 && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={questionQuery}
                onChange={(e) => setQuestionQuery(e.target.value)}
                placeholder="Filter questions by prompt…"
                className="form-input w-full py-1.5 pl-8 text-sm"
              />
            </label>
            <select
              value={itemScope}
              onChange={(e) =>
                setItemScope(e.target.value as "all" | "scored" | "unscored" | "empty")
              }
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              aria-label="Filter by item kind"
            >
              <option value="all">All items</option>
              <option value="scored">Scored questions</option>
              <option value="unscored">Notes & groups</option>
              <option value="empty">Empty prompts</option>
            </select>
            {questionFiltersActive && (
              <button
                type="button"
                onClick={() => {
                  setQuestionQuery("");
                  setTypeFilters([]);
                  setItemScope("all");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(QUIZ_QUESTION_TYPE_LABELS) as QuizQuestionType[])
              .filter((type) => (typeCounts[type] ?? 0) > 0)
              .map((type) => {
                const active = typeFilters.includes(type);
                const count = typeCounts[type] ?? 0;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setTypeFilters((prev) =>
                        prev.includes(type)
                          ? prev.filter((t) => t !== type)
                          : [...prev, type],
                      )
                    }
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? "bg-canvas-blue text-white"
                        : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-canvas-blueTint"
                    }`}
                  >
                    {QUIZ_QUESTION_TYPE_LABELS[type]} · {count}
                  </button>
                );
              })}
          </div>
          {questionFiltersActive && (
            <p className="text-xs text-gray-500">
              Showing {displayed.length} of {questions.length} items
            </p>
          )}
        </div>
      )}

      {questions.length === 0 ? (
        <div
          className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600 ${
            nested ? "py-5" : ""
          }`}
        >
          {nested
            ? "No questions in this group yet. Click “Add to group”."
            : "No questions yet. Click “Question” to add one, or Import JSON / CSV / Markdown / QTI / Moodle / Aiken."}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          No items match these filters.{" "}
          <button
            type="button"
            onClick={() => {
              setQuestionQuery("");
              setTypeFilters([]);
              setItemScope("all");
            }}
            className="font-medium text-canvas-blue hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onQuestionDragEnd}
        >
          <SortableContext
            items={displayedIds}
            strategy={verticalListSortingStrategy}
          >
        <div className="space-y-0">
          {displayed.map(({ question, index }) => {
            const collapsed = Boolean(collapsedById[question.id]);
            const promptPreview =
              (question.prompt ?? "").trim().replace(/\s+/g, " ").slice(0, 72) ||
              "Empty prompt";
            const stripe = index % 2 === 0 ? "bg-white" : "bg-slate-50";
            const isSelected = selectedIds.includes(question.id);
            return (
              <SortableQuestionRow
                key={question.id}
                id={question.id}
                enabled={canReorder}
                className={`scroll-mt-4 rounded-lg border p-4 shadow-sm ${stripe} ${
                  isSelected
                    ? "border-canvas-blue ring-1 ring-canvas-blue/30"
                    : "border-gray-200"
                }`}
                setShellRef={(el) => {
                  questionElRefs.current[question.id] = el;
                }}
              >
                {(dragHandle) => (
                  <>
              <div className="flex items-start justify-between gap-3">
                {bulkTools && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      toggleSelected(
                        question.id,
                        e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey,
                      )
                    }
                    aria-label={`Select ${quizItemLabel(questions, index)}`}
                    className="mt-1.5 h-4 w-4 shrink-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggleCollapsed(question.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left hover:bg-black/[0.03] -m-1 p-1"
                  aria-expanded={!collapsed}
                >
                  <span className="mt-0.5 shrink-0 text-gray-400">
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-canvas-grayDark">
                        {quizItemLabel(questions, index)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {QUIZ_QUESTION_TYPE_LABELS[question.type]}
                      </span>
                      {!surveyMode &&
                        question.type !== "note" &&
                        question.type !== "group" && (
                          <span className="text-[11px] tabular-nums text-gray-500">
                            {formatPoints(question.points)} pts
                          </span>
                        )}
                    </span>
                    {collapsed && (
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {promptPreview}
                        {(question.prompt ?? "").trim().length > 72 ? "…" : ""}
                      </span>
                    )}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {canReorder ? dragHandle : null}
                  {!canReorder && (
                    <>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                    </>
                  )}
                  {canCopyToQuiz && (
                    <button
                      type="button"
                      onClick={() => setCopySource(question)}
                      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                      title="Copy to another quiz…"
                      aria-label="Copy to another quiz"
                    >
                      <FolderInput className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => duplicateQuestion(index)}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                    title="Duplicate question"
                    aria-label="Duplicate question"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewQuestion(question);
                      setPreviewAnswer({});
                    }}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                    title="Preview question"
                    aria-label="Preview question"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestRemove([question.id])}
                    className="rounded-md p-1.5 text-canvas-red hover:bg-red-50"
                    title="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!collapsed && (
              <div className="mt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <div>
                  <div className="form-label">Type</div>
                  <select
                    value={question.type}
                    onChange={(e) => changeType(question, e.target.value as QuizQuestionType)}
                    className="form-input"
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUIZ_QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                {!surveyMode && (
                <div>
                  <div className="form-label">Points</div>
                    {question.type === "note" || question.type === "group" ? (
                      <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                        {question.type === "group"
                          ? `~${formatPoints(groupExpectedPoints(question))} expected`
                          : "0 (not scored)"}
                      </div>
                    ) : (
                  <input
                    type="number"
                    min={0}
                        step={1}
                    value={question.points}
                    onChange={(e) =>
                          updateQuestion(question.id, {
                            points: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          })
                    }
                    className="form-input h-10"
                  />
                    )}
                </div>
                )}
              </div>

              <div className="mt-3">
                <div className="form-label">
                  {question.type === "note"
                    ? "Note text"
                    : question.type === "group"
                      ? "Group title"
                      : "Question"}
                </div>
                <textarea
                  value={question.prompt}
                  onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })}
                  placeholder={
                    question.type === "note"
                      ? "Instructions, section header, or other non-scored text for students"
                      : question.type === "group"
                        ? "Optional label for this pick-N group (not shown as a scored question)"
                        : "Enter the question prompt"
                  }
                  rows={question.type === "group" ? 2 : 3}
                  className="form-input min-h-[88px] resize-y"
                />
              </div>

              {question.type === "group" && (
                <div className="mt-3 space-y-3 rounded-md border border-sky-200 bg-sky-50/50 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                    <div>
                      <div className="form-label">Pick count</div>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, question.groupQuestions?.length ?? 0)}
                        step={1}
                        value={question.pickCount ?? 0}
                        onChange={(e) => {
                          const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                          const max = question.groupQuestions?.length ?? 0;
                          updateQuestion(question.id, {
                            pickCount: max === 0 ? 0 : Math.min(n, max),
                          });
                        }}
                        className="form-input h-10"
                      />
                    </div>
                    <p className="self-end text-xs text-gray-600 sm:pb-2">
                      Each attempt draws{" "}
                      <span className="font-medium text-canvas-grayDark">
                        {Math.min(
                          question.pickCount ?? 0,
                          question.groupQuestions?.length ?? 0,
                        )}
                      </span>{" "}
                      of {question.groupQuestions?.length ?? 0} questions below (seeded per
                      student/attempt, same idea as bank pools). Nested groups are not allowed.
                    </p>
                  </div>
                  <QuizQuestionsEditor
                    nested
                    allowedTypes={MEMBER_QUESTION_TYPES}
                    questions={question.groupQuestions ?? []}
                    onChange={(members) => {
                      const cleaned = members.filter((m) => m.type !== "group");
                      const pick = Math.min(
                        Math.max(0, Math.floor(question.pickCount ?? 0)),
                        cleaned.length,
                      );
                      updateQuestion(question.id, {
                        groupQuestions: cleaned,
                        pickCount:
                          cleaned.length === 0
                            ? 0
                            : pick > 0
                              ? pick
                              : Math.min(1, cleaned.length),
                      });
                    }}
                    surveyMode={surveyMode}
                  />
                </div>
              )}

              {question.type !== "group" && (question.type === "multiple_choice" ||
                question.type === "multiple_answers") && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Answer choices
                    {!surveyMode && (
                    <span className="ml-1 font-normal text-gray-400">
                      (
                      {question.type === "multiple_choice"
                        ? "select the one correct answer"
                        : "check all correct answers"}
                      )
                    </span>
                    )}
                    {surveyMode && (
                      <span className="ml-1 font-normal text-gray-400">
                        (no correct answer — students pick a response)
                      </span>
                    )}
                  </div>
                  {(question.choices ?? []).map((choice, choiceIndex) => {
                    const isCorrect =
                      !surveyMode &&
                      (question.type === "multiple_choice"
                        ? question.correctChoiceIndex === choiceIndex
                        : (question.correctChoiceIndices ?? []).includes(choiceIndex));
                    return (
                      <div key={choiceIndex} className="flex items-center gap-2">
                        {!surveyMode && (
                        <input
                          type={question.type === "multiple_choice" ? "radio" : "checkbox"}
                          name={`correct-${question.id}`}
                          checked={isCorrect}
                          onChange={() =>
                            question.type === "multiple_choice"
                              ? updateQuestion(question.id, {
                                  correctChoiceIndex: choiceIndex,
                                })
                              : toggleCorrectIndex(question, choiceIndex)
                          }
                          title="Mark correct"
                          className="accent-canvas-green"
                        />
                        )}
                        <input
                          value={choice}
                          onChange={(e) => updateChoice(question, choiceIndex, e.target.value)}
                          placeholder={`Choice ${choiceIndex + 1}`}
                          className={`form-input ${
                            isCorrect ? "border-green-300 bg-green-50" : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => removeChoice(question, choiceIndex)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                          title="Remove choice"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addChoice(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add choice
                  </button>
                </div>
              )}

              {question.type === "true_false" && !surveyMode && (
                <div className="mt-3">
                  <div className="form-label">Correct answer</div>
                  <div className="flex gap-4 text-sm">
                    <label className="form-checkbox-label">
                      <input
                        type="radio"
                        name={`tf-${question.id}`}
                        checked={question.correctTrueFalse === true}
                        onChange={() => updateQuestion(question.id, { correctTrueFalse: true })}
                        className="accent-canvas-green"
                      />
                      True
                    </label>
                    <label className="form-checkbox-label">
                      <input
                        type="radio"
                        name={`tf-${question.id}`}
                        checked={question.correctTrueFalse === false}
                        onChange={() => updateQuestion(question.id, { correctTrueFalse: false })}
                        className="accent-canvas-green"
                      />
                      False
                    </label>
                  </div>
                </div>
              )}
              {question.type === "true_false" && surveyMode && (
                <p className="mt-3 text-xs text-gray-500">
                  Students choose True or False — there is no correct answer for surveys.
                </p>
              )}

              {question.type === "short_answer" && !surveyMode && (
                <div className="mt-3">
                  <div className="form-label">Expected answer</div>
                  <input
                    value={question.correctShortAnswer ?? ""}
                    onChange={(e) =>
                      updateQuestion(question.id, { correctShortAnswer: e.target.value })
                    }
                    placeholder="Correct answer (case-insensitive)"
                    className="form-input"
                  />
                </div>
              )}
              {question.type === "short_answer" && surveyMode && (
                <p className="mt-3 text-xs text-gray-500">
                  Students enter free text — no expected answer for surveys.
                </p>
              )}

              {question.type === "fill_in_blank" && !surveyMode && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Accepted answers
                    <span className="ml-1 font-normal text-gray-400">
                      (any match counts as correct)
                    </span>
                  </div>
                  {(question.acceptedAnswers ?? []).map((value, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-canvas-green" />
                      <input
                        value={value}
                        onChange={(e) => updateAccepted(question, i, e.target.value)}
                        placeholder={`Accepted answer ${i + 1}`}
                        className="form-input"
                      />
                      <button
                        type="button"
                        onClick={() => removeAccepted(question, i)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAccepted(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add accepted answer
                  </button>
                </div>
              )}
              {question.type === "fill_in_blank" && surveyMode && (
                <p className="mt-3 text-xs text-gray-500">
                  Students fill in a blank — no accepted answers for surveys.
                </p>
              )}

              {question.type === "numerical" && !surveyMode && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="form-label">Correct value</div>
                    <input
                      type="number"
                      value={question.correctNumber ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          correctNumber: Number(e.target.value),
                        })
                      }
                      className="form-input h-10"
                    />
                  </div>
                  <div>
                      <div className="form-label">Full-credit margin (±)</div>
                    <input
                      type="number"
                      min={0}
                      value={question.tolerance ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          tolerance: Math.abs(Number(e.target.value)) || 0,
                        })
                      }
                      className="form-input h-10"
                    />
                    </div>
                  </div>
                  <div>
                    <div className="form-label">Partial-credit margin (±)</div>
                    <input
                      type="number"
                      min={0}
                      value={question.partialTolerance ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          updateQuestion(question.id, { partialTolerance: undefined });
                          return;
                        }
                        updateQuestion(question.id, {
                          partialTolerance: Math.abs(Number(raw)) || 0,
                        });
                      }}
                      placeholder="Optional — wider than full-credit margin"
                      className="form-input h-10"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      When partial credit is on, answers between the full and partial margins
                      earn a linearly decreasing share of points.
                    </p>
                  </div>
                </div>
              )}
              {question.type === "numerical" && surveyMode && (
                <p className="mt-3 text-xs text-gray-500">
                  Students enter a number — no correct value for surveys.
                </p>
              )}

              <QuizPhase7EditorFields
                question={question}
                onPatch={(patch) => updateQuestion(question.id, patch)}
              />

              {question.type === "matching" && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Matching pairs
                    <span className="ml-1 font-normal text-gray-400">
                      {surveyMode
                        ? "(prompt → response options; not scored)"
                        : "(students match left to right)"}
                    </span>
                  </div>
                  {(question.matchingPairs ?? []).map((pair) => (
                    <div key={pair.id} className="flex items-center gap-2">
                      <input
                        value={pair.left}
                        onChange={(e) => updatePair(question, pair.id, { left: e.target.value })}
                        placeholder="Left"
                        className="form-input"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        value={pair.right}
                        onChange={(e) => updatePair(question, pair.id, { right: e.target.value })}
                        placeholder={surveyMode ? "Option" : "Right (match)"}
                        className="form-input"
                      />
                      <button
                        type="button"
                        onClick={() => removePair(question, pair.id)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                        title="Remove pair"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPair(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add pair
                  </button>
                </div>
              )}

              {question.type === "essay" && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                    {surveyMode
                      ? "Open response — collected for review, not scored."
                      : "Essay questions are graded manually in GradePro. Attach an optional rubric to score by criteria."}
                  </div>
                  {!surveyMode && (
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="form-checkbox-label text-sm">
                          <input
                            type="checkbox"
                            checked={(question.rubric?.length ?? 0) > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const rubric = createDefaultEssayRubric(
                                  question.points > 0 ? question.points : 5,
                                );
                                updateQuestion(question.id, {
                                  rubric,
                                  points: Math.max(
                                    question.points > 0 ? question.points : 0,
                                    sumRubricMaxPoints(rubric),
                                  ),
                                });
                              } else {
                                updateQuestion(question.id, { rubric: undefined });
                              }
                            }}
                          />
                          Use grading rubric
                        </label>
                        {(question.rubric?.length ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const rubric = createDefaultEssayRubric(
                                question.points > 0 ? question.points : 5,
                              );
                              updateQuestion(question.id, {
                                rubric,
                                points: Math.max(
                                  question.points > 0 ? question.points : 0,
                                  sumRubricMaxPoints(rubric),
                                ),
                              });
                            }}
                            className="text-xs font-medium text-canvas-blue hover:underline"
                          >
                            Reset to suggested
                          </button>
                        )}
                      </div>
                      {(question.rubric?.length ?? 0) > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-gray-500">
                            Rubric total{" "}
                            <span className="font-medium text-canvas-grayDark">
                              {sumRubricMaxPoints(question.rubric ?? [])}
                            </span>{" "}
                            pts
                            {question.points > 0 &&
                            sumRubricMaxPoints(question.rubric ?? []) !== question.points
                              ? ` · question is ${question.points} pts (GradePro clamps to the question max)`
                              : null}
                          </p>
                          {(question.rubric ?? []).map((criterion, cIndex) => (
                            <div
                              key={criterion.id}
                              className="flex flex-wrap items-end gap-2 rounded border border-gray-100 bg-gray-50/80 p-2"
                            >
                              <label className="min-w-[10rem] flex-1 text-sm">
                                <span className="form-label">Criterion {cIndex + 1}</span>
                                <input
                                  value={criterion.title}
                                  onChange={(e) => {
                                    const title = e.target.value;
                                    updateQuestion(question.id, {
                                      rubric: (question.rubric ?? []).map((c) =>
                                        c.id === criterion.id
                                          ? {
                                              ...c,
                                              title,
                                              // Keep authored description unless it was just a title echo.
                                              description:
                                                !c.description || c.description === c.title
                                                  ? title
                                                  : c.description,
                                            }
                                          : c,
                                      ),
                                    });
                                  }}
                                  className="form-input h-9"
                                  placeholder="e.g. Evidence & examples"
                                />
                                {criterion.description &&
                                  criterion.description !== criterion.title && (
                                    <p className="mt-1 text-xs text-gray-500">
                                      {criterion.description}
                                    </p>
                                  )}
                              </label>
                              <label className="w-24 text-sm">
                                <span className="form-label">Points</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={criterion.points}
                                  onChange={(e) => {
                                    const pts = Math.max(
                                      0,
                                      Math.round(Number(e.target.value) || 0),
                                    );
                                    updateQuestion(question.id, {
                                      rubric: (question.rubric ?? []).map((c) =>
                                        c.id === criterion.id
                                          ? withEssayCriterionPoints(c, pts)
                                          : c,
                                      ),
                                    });
                                  }}
                                  className="form-input h-9"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(question.id, {
                                    rubric: (question.rubric ?? []).filter(
                                      (c) => c.id !== criterion.id,
                                    ),
                                  })
                                }
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                                title="Remove criterion"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(question.id, {
                                rubric: [
                                  ...(question.rubric ?? []),
                                  createEssayRubricCriterion("New criterion", 1),
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add criterion
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(question.type === "inline_code" || question.type === "coding") && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="form-label">Language</span>
                      <select
                        value={question.language ?? "javascript"}
                        onChange={(e) => {
                          const language = e.target.value as CodeLanguage;
                          const patch: Partial<QuizQuestion> = { language };
                          if (!(question.starterCode ?? "").trim()) {
                            patch.starterCode = starterForLanguage(language);
                          }
                          updateQuestion(question.id, patch);
                        }}
                        className="form-input"
                      >
                        {Object.entries(CODE_LANGUAGE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                            {value === "other" ? " (manual only)" : ""}
                          </option>
                        ))}
                      </select>
                      {question.language === "other" && (
                        <p className="mt-1 text-xs text-amber-700">
                          Other has no auto-runner — grade manually in GradePro (or switch language).
                        </p>
                      )}
                    </label>
                    {question.type === "inline_code" && (
                      <label className="block text-sm">
                        <span className="form-label">Suggested max lines</span>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={question.codeMaxLines ?? 5}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              codeMaxLines: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="form-input"
                        />
                      </label>
                    )}
                  </div>
                  <label className="block text-sm">
                    <span className="form-label">Starter code (optional)</span>
                    <div className="mb-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(question.id, {
                            starterCode: starterForLanguage(question.language),
                          })
                        }
                        className="text-xs font-medium text-canvas-blue hover:underline"
                      >
                        Insert language template
                      </button>
                    </div>
                    <QuizCodeEditor
                      value={question.starterCode ?? ""}
                      onChange={(v) => updateQuestion(question.id, { starterCode: v })}
                      language={question.language}
                      useMonaco={useMonacoEditor}
                      minHeight={question.type === "coding" ? 120 : 80}
                      placeholder="// shown to students"
                    />
                  </label>
                  {question.type === "coding" && !surveyMode && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <label className="block min-w-0 flex-1 text-sm">
                          <span className="form-label">
                            Sample answer{" "}
                            <span className="font-normal text-gray-500">
                              (printed on answer key)
                            </span>
                          </span>
                          <QuizCodeEditor
                            value={question.correctCode ?? ""}
                            onChange={(v) =>
                              updateQuestion(question.id, {
                                correctCode: v,
                                correctCodeUpdatedAt: Date.now(),
                              })
                            }
                            language={question.language}
                            useMonaco={useMonacoEditor}
                            minHeight={180}
                            placeholder={
                              starterForLanguage(question.language) ||
                              "Full working solution students should arrive at"
                            }
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const starter = question.starterCode ?? "";
                            if (!starter.trim()) {
                              showToast("Starter code is empty", "neutral");
                              return;
                            }
                            updateQuestion(question.id, {
                              correctCode: starter,
                              correctCodeUpdatedAt: Date.now(),
                            });
                            showToast("Copied starter into sample answer", "positive");
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy starter → sample
                        </button>
                        {(question.codeTests ?? []).length > 0 &&
                          isCodeRunnerLanguage(question.language) && (
                            <button
                              type="button"
                              disabled={sampleRunningId === question.id}
                              onClick={async () => {
                                const code = question.correctCode ?? "";
                                if (!code.trim()) {
                                  showToast("Add a sample answer first", "negative");
                                  return;
                                }
                                setSampleRunningId(question.id);
                                try {
                                  const results = await runCodeTests({
                                    language: question.language,
                                    code,
                                    tests: question.codeTests ?? [],
                                    timeoutMs: question.codeTimeoutMs,
                                    files: question.codeFiles,
                                    sqlSetup: question.sqlSetup,
                                    tsTranspileMode: question.tsTranspileMode,
                                  });
                                  setSampleRunById((prev) => ({
                                    ...prev,
                                    [question.id]: results,
                                  }));
                                  const passed = results.filter((r) => r.passed).length;
                                  showToast(
                                    `Sample: ${passed}/${results.length} tests passed`,
                                    passed === results.length ? "positive" : "neutral",
                                  );
                                } catch (err) {
                                  showToast(
                                    err instanceof Error ? err.message : "Sample run failed",
                                    "negative",
                                  );
                                } finally {
                                  setSampleRunningId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Play className="h-3.5 w-3.5" />
                              {sampleRunningId === question.id
                                ? "Running…"
                                : "Run sample vs tests"}
                            </button>
                          )}
                      </div>
                      {typeof question.correctCodeUpdatedAt === "number" &&
                        question.correctCodeUpdatedAt > 0 && (
                          <p className="text-xs text-gray-500">
                            Sample last edited{" "}
                            {new Date(question.correctCodeUpdatedAt).toLocaleString()}
                          </p>
                        )}
                      {(sampleRunById[question.id] ?? []).length > 0 && (
                        <ul className="space-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                          {sampleRunById[question.id].map((r, i) => (
                            <li
                              key={r.testId}
                              className={
                                r.passed ? "text-green-700" : "text-canvas-red"
                              }
                            >
                              Test {i + 1}: {r.passed ? "passed" : "failed"}
                              {r.error ? ` — ${r.error}` : ""}
                              {!r.passed && r.stdout != null && r.stdout !== "" && (
                                <pre className="mt-0.5 overflow-x-auto font-mono text-[11px] text-gray-600">
                                  got: {r.stdout}
                                </pre>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-gray-500">
                        Shown when you print with answer key. Separate from starter code and
                        test cases.
                      </p>
                    </div>
                  )}
                  {question.type === "inline_code" && !surveyMode && (
                    <div>
                      <p className="form-label mb-1">Accepted solutions (auto-graded)</p>
                      <p className="mb-2 text-xs text-gray-500">
                        Compared with whitespace normalized. Add alternate valid snippets.
                      </p>
                      {(question.acceptedAnswers ?? [""]).map((ans, index) => (
                        <div key={index} className="mb-2 flex gap-2">
                          <textarea
                            value={ans}
                            onChange={(e) => updateAccepted(question, index, e.target.value)}
                            rows={2}
                            className="form-input flex-1 font-mono text-xs"
                            placeholder="Accepted code"
                          />
                          <button
                            type="button"
                            onClick={() => removeAccepted(question, index)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addAccepted(question)}
                        className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add accepted solution
                      </button>
                    </div>
                  )}
                  {question.type === "coding" && !surveyMode && (
                    <>
                      <div>
                        <p className="form-label mb-1">
                          {isHtmlCssRunnerLanguage(question.language)
                            ? "Test cases (HTML/CSS)"
                            : "Test cases (stdin → stdout)"}
                        </p>
                        <details className="mb-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600">
                          <summary className="cursor-pointer font-medium text-gray-700">
                            How tests work
                          </summary>
                          <p className="mt-2">
                            Auto-grade when language is supported and at least one test exists.
                            Local (offline): JavaScript, TypeScript, Python — use{" "}
                            <code className="rounded bg-gray-100 px-1">stdin</code> /{" "}
                            <code className="rounded bg-gray-100 px-1">console.log</code> or Python{" "}
                            <code className="rounded bg-gray-100 px-1">print</code>. Remote (free{" "}
                            <a
                              href="https://wandbox.org/"
                              target="_blank"
                              rel="noreferrer"
                              className="text-canvas-blue hover:underline"
                            >
                              Wandbox
                            </a>{" "}
                            API): C, C++, Java, SQL — needs network; Java should use{" "}
                            <code className="rounded bg-gray-100 px-1">class Main</code> (not{" "}
                            <code className="rounded bg-gray-100 px-1">public</code>). HTML / CSS:
                            expected may be full source (normalized) or, for HTML, plain body text.
                            For CSS, expected can be property checklist lines (
                            <code className="rounded bg-gray-100 px-1">color: red</code> without{" "}
                            <code className="rounded bg-gray-100 px-1">{"{}"}</code>) or full CSS.
                            CSS tests may use stdin as preview scaffold HTML. Students see pass/fail
                            for full-source HTML/CSS keys; property checklists may show as required
                            properties. Other stays manual / reference-match only.
                          </p>
                        </details>
                        {(question.codeTests ?? []).map((test, index) => (
                          <div
                            key={test.id}
                            className="mb-3 space-y-2 rounded-md border border-gray-200 bg-gray-50/80 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <input
                                type="text"
                                value={test.label ?? ""}
                                onChange={(e) => {
                                  const next = [...(question.codeTests ?? [])];
                                  next[index] = { ...test, label: e.target.value };
                                  updateQuestion(question.id, { codeTests: next });
                                }}
                                placeholder={`Test ${index + 1} label (optional)`}
                                className="form-input max-w-xs text-sm"
                              />
                              <div className="flex items-center gap-3">
                                <label className="form-checkbox-label text-xs">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(test.hidden)}
                                    onChange={(e) => {
                                      const next = [...(question.codeTests ?? [])];
                                      next[index] = { ...test, hidden: e.target.checked };
                                      updateQuestion(question.id, { codeTests: next });
                                    }}
                                  />
                                  Hidden from students
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (question.codeTests ?? []).filter(
                                      (_, i) => i !== index,
                                    );
                                    updateQuestion(question.id, { codeTests: next });
                                  }}
                                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                                  aria-label="Remove test"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <label className="block text-sm">
                              <span className="form-label">
                                {question.language === "css"
                                  ? "Scaffold HTML (preview)"
                                  : question.language === "html"
                                    ? "stdin (unused for HTML)"
                                    : "stdin"}
                              </span>
                              <textarea
                                value={test.stdin}
                                onChange={(e) => {
                                  const next = [...(question.codeTests ?? [])];
                                  next[index] = { ...test, stdin: e.target.value };
                                  updateQuestion(question.id, { codeTests: next });
                                }}
                                rows={2}
                                className="form-input font-mono text-xs"
                                placeholder={
                                  question.language === "css"
                                    ? '<div class="target">…</div>'
                                    : "Input provided as stdin"
                                }
                              />
                            </label>
                            <label className="block text-sm">
                              <span className="form-label">
                                {isHtmlCssRunnerLanguage(question.language)
                                  ? question.language === "css"
                                    ? "Expected CSS (full source or property lines)"
                                    : "Expected HTML or body text"
                                  : "Expected stdout"}
                              </span>
                              <textarea
                                value={test.expectedStdout}
                                onChange={(e) => {
                                  const next = [...(question.codeTests ?? [])];
                                  next[index] = {
                                    ...test,
                                    expectedStdout: e.target.value,
                                  };
                                  updateQuestion(question.id, { codeTests: next });
                                }}
                                rows={2}
                                className="form-input font-mono text-xs"
                                placeholder={
                                  question.language === "css"
                                    ? "color: red  OR  computed:#target color:rgb(255, 0, 0)"
                                    : question.language === "html"
                                      ? "<h1>Hello</h1> or Hello"
                                      : question.language === "python"
                                        ? "Expected print() output (use {{n}} with property harness)"
                                        : "Expected console.log output"
                                }
                              />
                            </label>
                            <QuizEditorDisclosure
                              title="Test options"
                              forceOpen={codingTestOptionsActive(test)}
                              badge={codingTestOptionsActive(test) ? "set" : undefined}
                              className="border-gray-200 bg-white"
                            >
                              <div className="space-y-2">
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className="block text-sm">
                                    <span className="form-label">Weight</span>
                                    <input
                                      type="number"
                                      min={0.1}
                                      step={0.1}
                                      value={test.weight ?? 1}
                                      onChange={(e) => {
                                        const next = [...(question.codeTests ?? [])];
                                        next[index] = {
                                          ...test,
                                          weight: Math.max(0.1, Number(e.target.value) || 1),
                                        };
                                        updateQuestion(question.id, { codeTests: next });
                                      }}
                                      className="form-input text-sm"
                                    />
                                  </label>
                                  <label className="block text-sm">
                                    <span className="form-label">Timeout ms</span>
                                    <input
                                      type="number"
                                      min={200}
                                      max={60000}
                                      placeholder="default"
                                      value={test.timeoutMs ?? ""}
                                      onChange={(e) => {
                                        const next = [...(question.codeTests ?? [])];
                                        const v = e.target.value.trim();
                                        next[index] = {
                                          ...test,
                                          timeoutMs: v
                                            ? Math.max(200, Number(v) || 2000)
                                            : undefined,
                                        };
                                        updateQuestion(question.id, { codeTests: next });
                                      }}
                                      className="form-input text-sm"
                                    />
                                  </label>
                                  <label className="block text-sm">
                                    <span className="form-label">Expected regex</span>
                                    <input
                                      type="text"
                                      value={test.expectedRegex ?? ""}
                                      onChange={(e) => {
                                        const next = [...(question.codeTests ?? [])];
                                        next[index] = {
                                          ...test,
                                          expectedRegex: e.target.value || undefined,
                                        };
                                        updateQuestion(question.id, { codeTests: next });
                                      }}
                                      className="form-input font-mono text-xs"
                                      placeholder="optional RegExp"
                                    />
                                  </label>
                                </div>
                                {(question.language === "javascript" ||
                                  question.language === "typescript") && (
                                  <>
                                    <label className="block text-sm">
                                      <span className="form-label">
                                        assertJs{" "}
                                        <span className="font-normal text-gray-500">
                                          (stdout, stdin, expected)
                                        </span>
                                      </span>
                                      <textarea
                                        value={test.assertJs ?? ""}
                                        onChange={(e) => {
                                          const next = [...(question.codeTests ?? [])];
                                          next[index] = {
                                            ...test,
                                            assertJs: e.target.value || undefined,
                                          };
                                          updateQuestion(question.id, { codeTests: next });
                                        }}
                                        rows={2}
                                        className="form-input font-mono text-xs"
                                        placeholder="if (Number(stdout) !== Number(stdin)*2) throw new Error('bad');"
                                      />
                                    </label>
                                    <div className="rounded border border-indigo-100 bg-indigo-50/50 p-2">
                                      <label className="form-checkbox-label text-xs">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(test.propertyHarness?.enabled)}
                                          onChange={(e) => {
                                            const next = [...(question.codeTests ?? [])];
                                            next[index] = {
                                              ...test,
                                              propertyHarness: {
                                                enabled: e.target.checked,
                                                count: test.propertyHarness?.count ?? 5,
                                                min: test.propertyHarness?.min ?? 0,
                                                max: test.propertyHarness?.max ?? 100,
                                              },
                                            };
                                            updateQuestion(question.id, { codeTests: next });
                                          }}
                                        />
                                        Property harness (random ints → stdin, use {"{{n}}"} in
                                        expected)
                                      </label>
                                      {test.propertyHarness?.enabled && (
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                          {(
                                            [
                                              ["count", "Count"],
                                              ["min", "Min"],
                                              ["max", "Max"],
                                            ] as const
                                          ).map(([key, lab]) => (
                                            <label key={key} className="block text-xs">
                                              <span className="form-label">{lab}</span>
                                              <input
                                                type="number"
                                                value={
                                                  test.propertyHarness?.[key] ??
                                                  (key === "count" ? 5 : key === "min" ? 0 : 100)
                                                }
                                                onChange={(e) => {
                                                  const next = [...(question.codeTests ?? [])];
                                                  next[index] = {
                                                    ...test,
                                                    propertyHarness: {
                                                      enabled: true,
                                                      count: test.propertyHarness?.count ?? 5,
                                                      min: test.propertyHarness?.min ?? 0,
                                                      max: test.propertyHarness?.max ?? 100,
                                                      [key]: Number(e.target.value) || 0,
                                                    },
                                                  };
                                                  updateQuestion(question.id, {
                                                    codeTests: next,
                                                  });
                                                }}
                                                className="form-input text-xs"
                                              />
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </QuizEditorDisclosure>
                            {test.hidden && (
                              <details className="rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5 text-xs">
                                <summary className="cursor-pointer font-medium text-amber-900">
                                  Instructor preview (hidden I/O)
                                </summary>
                                <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-gray-700">
                                  {`stdin:\n${test.stdin || "(empty)"}\n\nexpected:\n${test.expectedStdout || "(empty)"}${
                                    test.expectedRegex
                                      ? `\n\nregex: ${test.expectedRegex}`
                                      : ""
                                  }`}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const next: CodeTestCase[] = [
                              ...(question.codeTests ?? []),
                              createCodeTestCase(),
                            ];
                            updateQuestion(question.id, { codeTests: next });
                          }}
                          className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add test case
                        </button>
                        {(question.codeTests ?? []).length > 0 &&
                          !isCodeRunnerLanguage(question.language) && (
                            <p className="mt-2 text-xs text-amber-700">
                              Tests are saved, but Other has no auto-runner. Switch language or
                              grade in GradePro.
                            </p>
                          )}
                      </div>
                      {codingUsesTestRunner(question) ? (
                        <p className="text-xs text-gray-500">
                          Auto-grade uses the test runner (partial credit = passed / total).
                          The sample answer above is for the printed answer key only.
                        </p>
                      ) : (
                        <>
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={Boolean(question.autoGradeCode)}
                              onChange={(e) =>
                                updateQuestion(question.id, {
                                  autoGradeCode: e.target.checked,
                                })
                              }
                            />
                            Auto-grade by matching sample answer (normalized)
                          </label>
                          {!question.autoGradeCode && (
                            <p className="text-xs text-gray-500">
                              Without tests or reference auto-grade, coding answers are scored
                              manually in GradePro.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {(question.type === "inline_code" || question.type === "coding") &&
                    surveyMode && (
                      <p className="text-xs text-gray-500">
                        Students write code as a response — no reference or auto-grade for surveys.
                      </p>
                    )}
                </div>
              )}

              {question.type !== "note" && question.type !== "group" && (
              <div className="mt-3 space-y-3">
                {!surveyMode && (
                  <QuizEditorDisclosure
                    title="Feedback"
                    forceOpen={questionHasFeedback(question)}
                    badge={questionHasFeedback(question) ? "set" : undefined}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="form-label">Correct feedback</label>
                        <textarea
                          value={question.correctFeedback ?? ""}
                          onChange={(e) =>
                            updateQuestion(question.id, { correctFeedback: e.target.value })
                          }
                          rows={2}
                          placeholder="Shown when the answer is fully correct"
                          className="form-input resize-y"
                        />
                      </div>
                      <div>
                        <label className="form-label">Incorrect feedback</label>
                        <textarea
                          value={question.incorrectFeedback ?? ""}
                          onChange={(e) =>
                            updateQuestion(question.id, { incorrectFeedback: e.target.value })
                          }
                          rows={2}
                          placeholder="Shown when the answer is incorrect or only partially correct"
                          className="form-input resize-y"
                        />
                      </div>
                      <div>
                        <label className="form-label">General feedback (fallback)</label>
                        <textarea
                          value={question.feedback ?? ""}
                          onChange={(e) =>
                            updateQuestion(question.id, { feedback: e.target.value })
                          }
                          rows={2}
                          placeholder="Optional note if correct/incorrect feedback is empty"
                          className="form-input resize-y"
                        />
                      </div>
                      <QuizPhase7QuestionOptions
                        question={question}
                        onPatch={(patch) => updateQuestion(question.id, patch)}
                        variant="feedback"
                      />
                    </div>
                  </QuizEditorDisclosure>
                )}

                <QuizEditorDisclosure
                  title="Advanced"
                  forceOpen={questionAdvancedActive(question)}
                  badge={questionAdvancedActive(question) ? "set" : undefined}
                >
                  <div className="space-y-4">
                    {!surveyMode && (
                      <label className="form-checkbox-label text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={Boolean(question.omitFromAnswerKey)}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              omitFromAnswerKey: e.target.checked,
                            })
                          }
                        />
                        Omit from printed answer key
                      </label>
                    )}

                    {!nested && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="block text-sm sm:col-span-3">
                          <span className="form-label">Tags (comma-separated)</span>
                          <input
                            type="text"
                            value={(question.tags ?? []).join(", ")}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                tags: e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="e.g. arrays, week-3"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="form-label">Difficulty</span>
                          <select
                            value={question.difficulty ?? ""}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                difficulty: (e.target.value || undefined) as
                                  | QuestionDifficulty
                                  | undefined,
                              })
                            }
                            className="form-input mt-1"
                          >
                            <option value="">—</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="form-label">Bloom level</span>
                          <select
                            value={question.bloomLevel ?? ""}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                bloomLevel: (e.target.value || undefined) as
                                  | BloomLevel
                                  | undefined,
                              })
                            }
                            className="form-input mt-1"
                          >
                            <option value="">—</option>
                            <option value="remember">Remember</option>
                            <option value="understand">Understand</option>
                            <option value="apply">Apply</option>
                            <option value="analyze">Analyze</option>
                            <option value="evaluate">Evaluate</option>
                            <option value="create">Create</option>
                          </select>
                        </label>
                      </div>
                    )}

                    {!surveyMode && (
                      <QuizPhase7QuestionOptions
                        question={question}
                        onPatch={(patch) => updateQuestion(question.id, patch)}
                        variant="advanced"
                      />
                    )}

                    {!surveyMode &&
                      (question.type === "multiple_answers" ||
                        question.type === "matching" ||
                        question.type === "ordering" ||
                        question.type === "fill_in_multiple_blanks" ||
                        question.type === "numerical" ||
                        question.type === "fill_in_blank" ||
                        question.type === "short_answer") && (
                        <fieldset className="rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2.5">
                          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Partial credit
                          </legend>
                          <p className="mb-2 text-xs text-gray-500">
                            Override the quiz setting for this question only. Default follows the
                            quiz toggle.
                            {question.type === "numerical" &&
                              " Numerical partial credit also needs a partial-credit margin above."}
                            {(question.type === "fill_in_blank" ||
                              question.type === "short_answer") &&
                              " Near matches (at/above the threshold) earn proportional credit."}
                          </p>
                          <div className="flex flex-wrap gap-3 text-sm">
                            {(
                              [
                                { value: "default", label: "Use quiz setting" },
                                { value: "on", label: "Always award" },
                                { value: "off", label: "Never award" },
                              ] as const
                            ).map((opt) => {
                              const current =
                                question.partialCredit === true
                                  ? "on"
                                  : question.partialCredit === false
                                    ? "off"
                                    : "default";
                              return (
                                <label
                                  key={opt.value}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  <input
                                    type="radio"
                                    name={`partial-${question.id}`}
                                    checked={current === opt.value}
                                    onChange={() =>
                                      updateQuestion(question.id, {
                                        partialCredit:
                                          opt.value === "on"
                                            ? true
                                            : opt.value === "off"
                                              ? false
                                              : undefined,
                                      })
                                    }
                                  />
                                  {opt.label}
                                </label>
                              );
                            })}
                          </div>
                          {(question.type === "fill_in_blank" ||
                            question.type === "short_answer") && (
                            <label className="mt-3 block border-t border-gray-200 pt-3 text-sm">
                              <span className="text-xs font-medium text-gray-600">
                                Near-match threshold override (%)
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={
                                  typeof question.nearMatchThreshold === "number"
                                    ? String(Math.round(question.nearMatchThreshold * 100))
                                    : ""
                                }
                                placeholder="Use quiz default"
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  if (raw === "") {
                                    updateQuestion(question.id, {
                                      nearMatchThreshold: undefined,
                                    });
                                    return;
                                  }
                                  const n = Number(raw);
                                  if (!Number.isFinite(n)) return;
                                  updateQuestion(question.id, {
                                    nearMatchThreshold: Math.min(
                                      1,
                                      Math.max(0, Math.round(n) / 100),
                                    ),
                                  });
                                }}
                                className="form-input mt-1 h-9 w-28"
                              />
                            </label>
                          )}
                          {question.type === "multiple_answers" && (
                            <div className="mt-3 border-t border-gray-200 pt-3">
                              <p className="mb-2 text-xs text-gray-500">
                                Penalize incorrect picks (subtract wrong selections from the
                                ratio).
                              </p>
                              <div className="flex flex-wrap gap-3 text-sm">
                                {(
                                  [
                                    { value: "default", label: "Use quiz setting" },
                                    { value: "on", label: "Always penalize" },
                                    { value: "off", label: "Never penalize" },
                                  ] as const
                                ).map((opt) => {
                                  const current =
                                    question.partialCreditPenalty === true
                                      ? "on"
                                      : question.partialCreditPenalty === false
                                        ? "off"
                                        : "default";
                                  return (
                                    <label
                                      key={opt.value}
                                      className="inline-flex items-center gap-1.5"
                                    >
                                      <input
                                        type="radio"
                                        name={`partial-penalty-${question.id}`}
                                        checked={current === opt.value}
                                        onChange={() =>
                                          updateQuestion(question.id, {
                                            partialCreditPenalty:
                                              opt.value === "on"
                                                ? true
                                                : opt.value === "off"
                                                  ? false
                                                  : undefined,
                                          })
                                        }
                                      />
                                      {opt.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </fieldset>
                      )}

                    {question.type === "coding" && (
                      <QuizEditorDisclosure
                        title="Coding advanced"
                        forceOpen={codingAdvancedActive(question)}
                        badge={codingAdvancedActive(question) ? "set" : undefined}
                      >
                        <div className="space-y-3">
                          {question.language === "typescript" && (
                            <label className="block text-sm">
                              <span className="form-label">TypeScript mode</span>
                              <select
                                value={question.tsTranspileMode ?? "transpile"}
                                onChange={(e) =>
                                  updateQuestion(question.id, {
                                    tsTranspileMode: e.target.value as "transpile" | "strip",
                                  })
                                }
                                className="form-input"
                              >
                                <option value="transpile">Transpile (Sucrase)</option>
                                <option value="strip">Strip types only</option>
                              </select>
                              <p className="mt-1 text-xs text-gray-500">
                                Browser runner cannot enforce full{" "}
                                <code>tsc --strict</code>; both modes strip types via Sucrase.
                              </p>
                            </label>
                          )}
                          {!surveyMode && (
                            <label className="block text-sm">
                              <span className="form-label">Default test timeout (ms)</span>
                              <input
                                type="number"
                                min={200}
                                max={60000}
                                step={100}
                                value={question.codeTimeoutMs ?? 2000}
                                onChange={(e) =>
                                  updateQuestion(question.id, {
                                    codeTimeoutMs: Math.max(
                                      200,
                                      Math.min(60_000, Number(e.target.value) || 2000),
                                    ),
                                  })
                                }
                                className="form-input"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Soft wall-clock limit. Memory limits are not enforceable in the
                                browser.
                              </p>
                            </label>
                          )}
                          {question.language === "sql" && !surveyMode && (
                            <label className="block text-sm">
                              <span className="form-label">SQL setup / schema</span>
                              <QuizCodeEditor
                                value={question.sqlSetup ?? ""}
                                onChange={(v) => updateQuestion(question.id, { sqlSetup: v })}
                                language="sql"
                                useMonaco={useMonacoEditor}
                                minHeight={100}
                                placeholder={
                                  "CREATE TABLE t (id INT);\nINSERT INTO t VALUES (1);"
                                }
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Prepended before the student SQL on every run (Wandbox SQLite).
                              </p>
                            </label>
                          )}
                          {!surveyMode && (
                            <div className="space-y-2 rounded-md border border-dashed border-gray-300 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="form-label mb-0">Multi-file scaffold (optional)</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const files: CodeFile[] = [
                                      ...(question.codeFiles ?? []),
                                      {
                                        path:
                                          question.language === "python"
                                            ? `mod${(question.codeFiles?.length ?? 0) + 1}.py`
                                            : `file${(question.codeFiles?.length ?? 0) + 1}.js`,
                                        content: "",
                                        main: !(question.codeFiles ?? []).some((f) => f.main),
                                      },
                                    ];
                                    updateQuestion(question.id, { codeFiles: files });
                                  }}
                                  className="text-xs font-medium text-canvas-blue hover:underline"
                                >
                                  Add file
                                </button>
                              </div>
                              {(question.codeFiles ?? []).length === 0 ? (
                                <p className="text-xs text-gray-500">
                                  Single-file mode uses starter code above. Add files for tabbed
                                  multi-file.
                                </p>
                              ) : (
                                (question.codeFiles ?? []).map((file, fi) => (
                                  <div
                                    key={`${file.path}-${fi}`}
                                    className="space-y-1 rounded border border-gray-200 bg-white p-2"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={file.path}
                                        onChange={(e) => {
                                          const next = [...(question.codeFiles ?? [])];
                                          next[fi] = { ...file, path: e.target.value };
                                          updateQuestion(question.id, { codeFiles: next });
                                        }}
                                        className="form-input max-w-xs text-xs"
                                        placeholder="path"
                                      />
                                      <label className="form-checkbox-label text-xs">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(file.main)}
                                          onChange={(e) => {
                                            const next = (question.codeFiles ?? []).map(
                                              (f, i) => ({
                                                ...f,
                                                main: i === fi ? e.target.checked : false,
                                              }),
                                            );
                                            updateQuestion(question.id, { codeFiles: next });
                                          }}
                                        />
                                        Main
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (question.codeFiles ?? []).filter(
                                            (_, i) => i !== fi,
                                          );
                                          updateQuestion(question.id, {
                                            codeFiles: next.length ? next : undefined,
                                          });
                                        }}
                                        className="text-xs text-canvas-red hover:underline"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <QuizCodeEditor
                                      value={file.content}
                                      onChange={(v) => {
                                        const next = [...(question.codeFiles ?? [])];
                                        next[fi] = { ...file, content: v };
                                        updateQuestion(question.id, { codeFiles: next });
                                      }}
                                      language={question.language}
                                      useMonaco={useMonacoEditor}
                                      minHeight={100}
                                    />
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </QuizEditorDisclosure>
                    )}
                  </div>
                </QuizEditorDisclosure>
              </div>
              )}
              </div>
              )}
            <InsertQuestionDivider
              onInsert={() => addQuestionBelow(index)}
              label={
                nested
                  ? "Add question after this one"
                  : surveyMode
                    ? "Add item after this one"
                    : "Add question after this one"
              }
            />
                  </>
                )}
              </SortableQuestionRow>
            );
          })}
        </div>
          </SortableContext>
        </DndContext>
      )}

      {copySource && courseId && (
        <CanvasModal
          title="Copy to another quiz"
          onClose={() => setCopySource(null)}
          size="md"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Append a copy of this{" "}
              {copySource.type === "group"
                ? "question group"
                : copySource.type === "note"
                  ? "note"
                  : "question"}{" "}
              to another quiz in this course. New IDs are generated, so the two copies
              stay independent.
            </p>
            {(() => {
              const targets = loadQuizzes(courseId).filter(
                (q) => q.id !== currentQuizId,
              );
              if (targets.length === 0) {
                return (
                  <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-sm text-gray-600">
                    No other quizzes in this course yet.
                  </p>
                );
              }
              return (
                <ul className="max-h-[45vh] space-y-1 overflow-y-auto">
                  {targets.map((target) => (
                    <li key={target.id}>
                      <button
                        type="button"
                        onClick={() => copyQuestionToQuiz(target.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas-grayLight"
                      >
                        <span className="min-w-0 truncate font-medium text-canvas-grayDark">
                          {target.title}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {(target.questions?.length ?? 0)} question
                          {(target.questions?.length ?? 0) === 1 ? "" : "s"}
                          {target.status === "published" || target.published
                            ? " · Published"
                            : " · Draft"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </CanvasModal>
      )}

      <ConfirmDeleteModal
        isOpen={pendingDeleteIds != null && pendingDeleteIds.length > 0}
        title={
          pendingDeleteIds?.length === 1
            ? "Delete this item?"
            : `Delete ${pendingDeleteIds?.length ?? 0} items?`
        }
        description={
          pendingDeleteIds?.length === 1
            ? "This item will be removed from the bank. Save the bank to make the deletion permanent."
            : "The selected items will be removed from the bank. Save the bank to make the deletion permanent."
        }
        confirmText={pendingDeleteIds?.length === 1 ? "Delete" : "Delete items"}
        onClose={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          if (pendingDeleteIds) performRemove(pendingDeleteIds);
          setPendingDeleteIds(null);
        }}
      />

      {bulkEditOpen && (
        <CanvasModal
          title={`Edit ${selectedIds.length} selected item${selectedIds.length === 1 ? "" : "s"}`}
          onClose={() => setBulkEditOpen(false)}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selected items are expanded below. Set the same points on every scored
              question, or edit each prompt and answer in the list.
            </p>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Points</span>
              <span className="ml-1 text-xs font-normal text-gray-500">
                (scored questions only; notes and groups stay 0)
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={bulkPoints}
                  onChange={(e) => setBulkPoints(e.target.value)}
                  className="form-input w-28"
                  placeholder="pts"
                />
                <button
                  type="button"
                  onClick={applyBulkPoints}
                  className="btn-canvas-secondary text-sm"
                >
                  Apply points
                </button>
              </div>
            </label>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setBulkEditOpen(false)}
                className="btn-canvas-primary text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </CanvasModal>
      )}

      {findReplaceOpen && (
        <CanvasModal title="Find and replace in prompts" onClose={() => setFindReplaceOpen(false)} size="md">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="form-label">Find</span>
              <input
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="form-input mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="form-label">Replace with</span>
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="form-input mt-1"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFindReplaceOpen(false)} className="btn-canvas-secondary text-sm">
                Cancel
              </button>
              <button type="button" onClick={applyFindReplace} className="btn-canvas-primary text-sm">
                Replace all
              </button>
            </div>
          </div>
        </CanvasModal>
      )}

      {findBanksOpen && courseId && (
        <CanvasModal title="Find questions in banks" onClose={() => setFindBanksOpen(false)} size="lg">
          <div className="space-y-3">
            <input
              value={findBanksQuery}
              onChange={(e) => setFindBanksQuery(e.target.value)}
              placeholder="Search stems and tags…"
              className="form-input"
            />
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {searchQuestionsInBanks(courseId, findBanksQuery).map((hit) => (
                <li
                  key={`${hit.bankId}:${hit.question.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{hit.bankTitle}</p>
                    <p className="line-clamp-2 text-sm text-canvas-grayDark">
                      {hit.question.prompt?.replace(/<[^>]+>/g, " ") || "Untitled"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-canvas-secondary shrink-0 text-xs"
                    onClick={() => {
                      const clone = {
                        ...hit.question,
                        id: `qq_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                      };
                      onChange([...questions, clone]);
                      showToast("Question added from bank", "positive");
                    }}
                  >
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CanvasModal>
      )}

      {previewQuestion && (
        <CanvasModal
          title="Question preview"
          onClose={() => setPreviewQuestion(null)}
          size="lg"
        >
          <QuizQuestionCard
            question={previewQuestion}
            index={questions.findIndex((q) => q.id === previewQuestion.id)}
            label={quizItemLabel(questions, Math.max(0, questions.findIndex((q) => q.id === previewQuestion.id)))}
            answer={previewAnswer[previewQuestion.id]}
            onChange={(patch) =>
              setPreviewAnswer((prev) => ({
                ...prev,
                [previewQuestion.id]: { ...prev[previewQuestion.id], ...patch, questionId: previewQuestion.id },
              }))
            }
            disabled={false}
          />
        </CanvasModal>
      )}
    </div>
  );
}
