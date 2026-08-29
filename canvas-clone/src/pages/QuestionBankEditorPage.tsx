import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Library, Link2, Save } from "lucide-react";
import BankTagInput from "../components/BankTagInput";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import QuizQuestionsEditor from "../components/QuizQuestionsEditor";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import {
  BANK_AUDIENCE_LABELS,
  BANK_AUDIENCES,
  BANK_DIFFICULTIES,
  BANK_DIFFICULTY_LABELS,
  BANK_EXAM_USE_LABELS,
  BANK_EXAM_USES,
  BANK_STATUS_LABELS,
  BANK_STATUSES,
  DEFAULT_BANK_META,
  type BankAudience,
  type BankDifficulty,
  type BankExamUse,
  type BankStatus,
} from "../utils/bankMeta";
import {
  QUESTION_BANKS_CHANGED_EVENT,
  createQuestionBank,
  getQuestionBank,
  loadQuestionBanks,
  materializeLinkedBank,
  questionBankEditorPath,
  resolveBankQuestions,
  updateQuestionBank,
  type QuestionBankSourceRef,
} from "../utils/questionBanks";
import { exportBankToJson } from "../utils/questionBankImport";
import type { QuizQuestion } from "../utils/quizzes";
import { totalQuizQuestionPoints } from "../utils/quizzes";

export default function QuestionBankEditorPage() {
  const { courseId = "", bankId = "" } = useParams();
  const navigate = useNavigate();
  const { canEditCourseContent } = usePermissions();
  const { showToast } = useToast();
  const isNew = bankId === "new";

  const [title, setTitle] = useState(isNew ? "New question bank" : "");
  const [notes, setNotes] = useState("");
  const [audience, setAudience] = useState<BankAudience>(DEFAULT_BANK_META.audience);
  const [difficulty, setDifficulty] = useState<BankDifficulty>(DEFAULT_BANK_META.difficulty);
  const [examUse, setExamUse] = useState<BankExamUse>(DEFAULT_BANK_META.examUse);
  const [status, setStatus] = useState<BankStatus>(DEFAULT_BANK_META.status);
  const [tags, setTags] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [dirty, setDirty] = useState(isNew);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [ready, setReady] = useState(isNew);
  /** Set while this bank is still a read-only alias of a bank in another course. */
  const [sourceRef, setSourceRef] = useState<QuestionBankSourceRef | null>(null);

  const hasChangesToSave = dirty || isNew;

  const tagSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const bank of loadQuestionBanks(courseId)) {
      if (!isNew && bank.id === bankId) continue;
      for (const tag of bank.tags ?? []) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [courseId, bankId, isNew, dirty]);

  const applyBank = (bank: ReturnType<typeof getQuestionBank>) => {
    if (!bank) return;
    setTitle(bank.title);
    setNotes(bank.notes ?? "");
    setAudience(bank.audience);
    setDifficulty(bank.difficulty);
    setExamUse(bank.examUse);
    setStatus(bank.status);
    setTags(bank.tags ?? []);
    setQuestions(resolveBankQuestions(bank));
    setSourceRef(bank.sourceBankRef ?? null);
  };

  useEffect(() => {
    if (!canEditCourseContent) navigate(`/courses/${courseId}/quizzes`, { replace: true });
  }, [canEditCourseContent, courseId, navigate]);

  useEffect(() => {
    if (isNew) {
      setTitle("New question bank");
      setNotes("");
      setAudience(DEFAULT_BANK_META.audience);
      setDifficulty(DEFAULT_BANK_META.difficulty);
      setExamUse(DEFAULT_BANK_META.examUse);
      setStatus(DEFAULT_BANK_META.status);
      setTags([]);
      setQuestions([]);
      setSourceRef(null);
      setDirty(true);
      setReady(true);
      return;
    }
    const bank = getQuestionBank(courseId, bankId);
    if (!bank) {
      navigate(`/courses/${courseId}/question-banks`, { replace: true });
      return;
    }
    applyBank(bank);
    setDirty(false);
    setReady(true);
  }, [courseId, bankId, isNew, navigate]);

  useEffect(() => {
    if (isNew) return;
    const refresh = () => {
      const bank = getQuestionBank(courseId, bankId);
      if (!bank || dirty) return;
      applyBank(bank);
    };
    window.addEventListener(QUESTION_BANKS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUESTION_BANKS_CHANGED_EVENT, refresh);
  }, [courseId, bankId, dirty, isNew]);

  const listPath = `/courses/${courseId}/question-banks`;

  /** Copy-on-write: the first edit to a linked bank turns it into a local copy. */
  const unlinkIfNeeded = () => {
    if (isNew || !sourceRef) return;
    materializeLinkedBank(courseId, bankId);
    setSourceRef(null);
    showToast("Unlinked from source bank — local copy", "neutral");
  };

  const markDirty = () => {
    unlinkIfNeeded();
    setDirty(true);
  };

  const metaPatch = { audience, difficulty, examUse, status, tags };
  const summaryChips = [
    BANK_AUDIENCE_LABELS[audience],
    BANK_DIFFICULTY_LABELS[difficulty],
    BANK_EXAM_USE_LABELS[examUse],
    BANK_STATUS_LABELS[status],
  ];

  const requestLeave = (path: string) => {
    if (!hasChangesToSave) {
      navigate(path);
      return;
    }
    setPendingPath(path);
    setLeaveOpen(true);
  };

  const confirmLeave = () => {
    const path = pendingPath ?? listPath;
    setLeaveOpen(false);
    setPendingPath(null);
    setDirty(false);
    navigate(path);
  };

  const save = () => {
    if (!hasChangesToSave) return;
    if (isNew) {
      const bank = createQuestionBank(courseId, title.trim() || "Untitled bank");
      updateQuestionBank(courseId, bank.id, { questions, notes, ...metaPatch });
      setDirty(false);
      showToast("Question bank saved", "positive");
      navigate(questionBankEditorPath(courseId, bank.id), { replace: true });
      return;
    }
    const updated = updateQuestionBank(courseId, bankId, {
      title,
      questions,
      notes,
      ...metaPatch,
    });
    if (updated) {
      setDirty(false);
      showToast("Bank saved", "positive");
    }
  };

  if (!ready) return null;

  const selectClass = "form-input mt-1";

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="relative flex-1 overflow-y-auto bg-white">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-canvas-blueTint/40 to-transparent"
          aria-hidden
        />
        <div className="relative px-8 py-8">
          <PageIdentityHeader
            size="md"
            icon={Library}
            label="Question Banks"
            title={title || "Untitled bank"}
            description={`${questions.length} questions · ${totalQuizQuestionPoints(questions)} pts · ${
              BANK_AUDIENCE_LABELS[audience]
            } · ${BANK_STATUS_LABELS[status]}${sourceRef ? " · Linked bank" : ""}${
              hasChangesToSave ? " · Not saved yet" : ""
            }`}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => requestLeave(listPath)}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Question Banks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const payload = exportBankToJson({
                      id: bankId === "new" ? "draft" : bankId,
                      courseId,
                      title,
                      notes,
                      questions,
                      ...metaPatch,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                    const blob = new Blob([payload], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${(title || "bank").replace(/[^\w.-]+/g, "_").slice(0, 40)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!hasChangesToSave}
                  title={hasChangesToSave ? "Save bank" : "No changes to save"}
                  className="btn-canvas-primary inline-flex items-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  Save bank
                </button>
              </div>
            }
          />

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-canvas-grayDark">Bank details</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Name the pool and tag who it is for so you can find it when building quizzes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summaryChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-gray-700">Title</span>
              <input
                value={title}
                onChange={(e) => {
                  markDirty();
                  setTitle(e.target.value);
                }}
                className="form-input mt-1 w-full"
                placeholder="e.g. Midterm — Algorithms"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Year of instruction</span>
                <select
                  value={audience}
                  onChange={(e) => {
                    markDirty();
                    setAudience(e.target.value as BankAudience);
                  }}
                  className={selectClass}
                >
                  {BANK_AUDIENCES.map((key) => (
                    <option key={key} value={key}>
                      {BANK_AUDIENCE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    markDirty();
                    setDifficulty(e.target.value as BankDifficulty);
                  }}
                  className={selectClass}
                >
                  {BANK_DIFFICULTIES.map((key) => (
                    <option key={key} value={key}>
                      {BANK_DIFFICULTY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Intended use</span>
                <select
                  value={examUse}
                  onChange={(e) => {
                    markDirty();
                    setExamUse(e.target.value as BankExamUse);
                  }}
                  className={selectClass}
                >
                  {BANK_EXAM_USES.map((key) => (
                    <option key={key} value={key}>
                      {BANK_EXAM_USE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => {
                    markDirty();
                    setStatus(e.target.value as BankStatus);
                  }}
                  className={selectClass}
                >
                  {BANK_STATUSES.map((key) => (
                    <option key={key} value={key}>
                      {BANK_STATUS_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="font-medium text-gray-700">Topics</span>
              <div className="mt-1">
                <BankTagInput
                  tags={tags}
                  onChange={(next) => {
                    markDirty();
                    setTags(next);
                  }}
                  suggestions={tagSuggestions}
                />
              </div>
              <span className="mt-1 block text-xs text-gray-500">
                Short labels like “graphs” or “CS2”. Used to filter this bank on the list page.
              </span>
            </label>

            <label className="mt-4 block text-sm">
              <span className="font-medium text-gray-700">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => {
                  markDirty();
                  setNotes(e.target.value);
                }}
                rows={4}
                className="form-input mt-1 w-full resize-y"
                placeholder="What’s in this bank, intended courses, or anything instructors should know…"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Instructor-only. Not shown to students taking a quiz.
              </span>
            </label>
            {sourceRef && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-canvas-blueTint/60 px-3 py-2 text-xs text-canvas-blueDark">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Linked to “{sourceRef.titleAtLink ?? "source bank"}” in another course.
                  Questions follow the source until you edit — the first change makes a
                  local copy.
                </span>
              </p>
            )}
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-canvas-grayDark">At a glance</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Questions
                    </p>
                    <p className="mt-1 text-lg font-semibold text-canvas-grayDark">
                      {questions.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Points
                    </p>
                    <p className="mt-1 text-lg font-semibold text-canvas-grayDark">
                      {totalQuizQuestionPoints(questions)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-canvas-grayDark">{BANK_STATUS_LABELS[status]}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Save state
                    </p>
                    <p className="mt-1 text-sm font-semibold text-canvas-grayDark">
                      {hasChangesToSave ? "Unsaved changes" : "Up to date"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-canvas-grayDark">Editing tips</h3>
                <ul className="mt-3 space-y-2 text-xs text-gray-500">
                  <li>Use topics and year filters so this bank is easy to find later.</li>
                  <li>Filter question types below when bulk-editing or cleaning up imports.</li>
                  <li>Mark finished banks as ready once they are quiz-safe.</li>
                </ul>
              </section>
            </aside>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <QuizQuestionsEditor
              questions={questions}
              onChange={(next) => {
                markDirty();
                setQuestions(next);
              }}
              courseId={courseId}
              bankMode
            />
          </div>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={leaveOpen}
        title={isNew ? "Discard this bank?" : "Leave without saving?"}
        description={
          isNew
            ? "This bank has not been saved. If you leave now, it will not be created."
            : "You have unsaved changes. If you leave now, those edits will be lost."
        }
        confirmText={isNew ? "Discard bank" : "Leave without saving"}
        cancelText="Keep editing"
        tone="danger"
        onClose={() => {
          setLeaveOpen(false);
          setPendingPath(null);
        }}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
