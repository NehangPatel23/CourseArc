import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Columns2,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Filter,
  Info,
  Layers,
  ListTree,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldOff,
  UserRound,
  Users,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import UnavailableScreen from "../components/UnavailableScreen";
import { useStudentView } from "../hooks/useStudentView";
import { graderDisplayName } from "../utils/anonymousGrading";
import {
  highlightSharedPhrases,
  parseExcludeText,
  questionIdForAttempt,
  similarityBand,
  similarityBandClasses,
  summarizeAttemptSimilarity,
  type SimilarityBand,
  type SimilarityMatchKind,
} from "../utils/quizEssaySimilarity";
import {
  buildClassSimilarityInbox,
  buildQuizSimilarityCorpus,
  buildSourcesForAttempt,
  estimateSubmissionCoveragePct,
  exportSimilarityInboxCsv,
  exportSimilarityReportJson,
  MATCH_SOURCE_COLORS,
  resolveSoftOriginalitySettings,
  type QuizSimilarityCorpus,
  type SimilaritySourceCard,
} from "../utils/quizSimilarityCorpus";
import {
  formatQuizDateTime,
  getQuizById,
  type SoftOriginalitySettings,
} from "../utils/quizzes";
import {
  getAttemptsForQuiz,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  type QuizAttempt,
} from "../utils/quizSubmissions";

type InsightTab = "overview" | "sources" | "filters";
type InboxSort = "similarity" | "name" | "newest" | "words";
type MatchLayer = "all" | "peer" | "self";
type DocumentView = "document" | "compare";
type LayerCounts = Record<MatchLayer, number>;

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileSlug(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 48) || "quiz";
}

function corpusScopeLabel(settings: QuizSimilarityCorpus["settings"]): string {
  return settings.includeOtherQuizzes ? "Course-wide corpus" : "This quiz only";
}

function ScoreBadge({ pct, large }: { pct: number; large?: boolean }) {
  const band = similarityBand(pct);
  const c = similarityBandClasses(band);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border font-bold tabular-nums ${c.badge} ${
        large ? "min-w-[3.75rem] px-2.5 py-1.5 text-xl" : "min-w-[2.75rem] px-2 py-1 text-sm"
      }`}
    >
      {pct}%
    </span>
  );
}

function KindBadge({ kind }: { kind: SimilarityMatchKind }) {
  const isSelf = kind === "self";
  const Icon = isSelf ? UserRound : Users;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
        isSelf
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : "border-sky-200 bg-sky-50 text-sky-800"
      }`}
    >
      <Icon className="h-3 w-3" />
      {isSelf ? "Self" : "Peer"}
    </span>
  );
}

function CrossQuizBadge({ quizTitle }: { quizTitle?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
      <Layers className="h-3 w-3" />
      Cross-quiz{quizTitle ? ` · ${quizTitle}` : ""}
    </span>
  );
}

function LayerControl({
  value,
  onChange,
  counts,
}: {
  value: MatchLayer;
  onChange: (layer: MatchLayer) => void;
  counts: LayerCounts;
}) {
  const items: { id: MatchLayer; label: string }[] = [
    { id: "all", label: "All" },
    { id: "peer", label: "Peer" },
    { id: "self", label: "Self" },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-[11px] font-semibold shadow-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-md px-2.5 py-1 transition ${
            value === item.id
              ? "bg-canvas-blue text-white shadow-sm"
              : "text-gray-500 hover:text-canvas-grayDark"
          }`}
        >
          {item.label}
          <span className="ml-1 tabular-nums opacity-75">{counts[item.id]}</span>
        </button>
      ))}
    </div>
  );
}

function BandLegend() {
  const items: { band: SimilarityBand; label: string }[] = [
    { band: "blue", label: "0%" },
    { band: "green", label: "1–24" },
    { band: "yellow", label: "25–49" },
    { band: "orange", label: "50–74" },
    { band: "red", label: "75–100" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(({ band, label }) => {
        const c = similarityBandClasses(band);
        return (
          <span
            key={band}
            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${c.badge}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function OriginalityDisabledState({ quizEditPath }: { quizEditPath: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md rounded-2xl border border-gray-200/80 bg-white px-8 py-10 text-center shadow-sm">
        <ShieldOff className="mx-auto h-10 w-10 text-gray-300" />
        <h2 className="mt-3 text-lg font-semibold text-canvas-grayDark">
          Soft originality is off for this quiz
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No submissions are being compared because originality checking is disabled in
          this quiz&rsquo;s settings. Turn it back on to rebuild the similarity corpus.
        </p>
        <Link to={quizEditPath} className="btn-canvas-primary mt-5 inline-flex text-sm">
          Open quiz settings
        </Link>
      </div>
    </div>
  );
}

function ClassInbox({
  courseId,
  quizId,
  quizTitle,
  rows,
  settings,
  onOpen,
}: {
  courseId: string;
  quizId: string;
  quizTitle: string;
  rows: ReturnType<typeof buildClassSimilarityInbox>;
  settings: QuizSimilarityCorpus["settings"];
  onOpen: (attemptId: string) => void;
}) {
  const [minPct, setMinPct] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<InboxSort>("similarity");

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { avg: 0, high: 0, flagged: 0, clean: 0, peerFlagged: 0, selfMatched: 0 };
    }
    const avg = Math.round(
      rows.reduce((s, r) => s + r.overallPct, 0) / rows.length,
    );
    const high = Math.max(...rows.map((r) => r.overallPct));
    const flagged = rows.filter((r) => r.overallPct >= 50).length;
    const clean = rows.filter((r) => r.overallPct < 25).length;
    const peerFlagged = rows.filter((r) => r.peerPct >= 50).length;
    const selfMatched = rows.filter((r) => r.selfMatchCount > 0).length;
    return { avg, high, flagged, clean, peerFlagged, selfMatched };
  }, [rows]);

  const bandCounts = useMemo(() => {
    const counts: Record<SimilarityBand, number> = {
      blue: 0,
      green: 0,
      yellow: 0,
      orange: 0,
      red: 0,
    };
    for (const r of rows) counts[similarityBand(r.overallPct)] += 1;
    return counts;
  }, [rows]);

  const hasSnapshots = useMemo(
    () => rows.some((r) => r.snapshotPct != null),
    [rows],
  );

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.overallPct >= minPct);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.attempt.studentName.toLowerCase().includes(q) ||
          (r.topSourceName ?? "").toLowerCase().includes(q),
      );
    }
    list = [...list];
    switch (sort) {
      case "name":
        list.sort((a, b) =>
          a.attempt.studentName.localeCompare(b.attempt.studentName),
        );
        break;
      case "newest":
        list.sort((a, b) => b.attempt.submittedAt - a.attempt.submittedAt);
        break;
      case "words":
        list.sort((a, b) => b.wordCount - a.wordCount);
        break;
      default:
        list.sort((a, b) => b.overallPct - a.overallPct);
    }
    return list;
  }, [rows, minPct, search, sort]);

  const exportCsv = () => {
    downloadText(
      `${fileSlug(quizTitle)}-similarity-inbox.csv`,
      exportSimilarityInboxCsv(filtered),
      "text/csv;charset=utf-8",
    );
  };

  const summaryCards = [
    { label: "Submissions", value: String(rows.length), hint: "with text answers" },
    { label: "Class average", value: `${stats.avg}%`, hint: "mean similarity" },
    { label: "Highest", value: `${stats.high}%`, hint: "max in class" },
    { label: "Needs review", value: String(stats.flagged), hint: "≥ 50% similarity" },
    { label: "Peer flagged", value: String(stats.peerFlagged), hint: "≥ 50% vs peers" },
    {
      label: "Self matches",
      value: String(stats.selfMatched),
      hint: settings.includeSelfAttempts
        ? "own earlier attempts"
        : "self compare is off",
    },
  ];

  return (
    <div className="w-full px-6 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-canvas-blue">
            Soft originality
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-canvas-grayDark">
            Similarity Inbox
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Peer and self-attempt overview for{" "}
            <span className="font-medium text-canvas-grayDark">{quizTitle}</span>.
            Open a report for highlighted matches, sources, and filters.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
              <Layers className="h-3 w-3 text-canvas-blue" />
              {corpusScopeLabel(settings)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
              <UserRound className="h-3 w-3 text-canvas-blue" />
              Self attempts {settings.includeSelfAttempts ? "included" : "excluded"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
              Min match {settings.minMatchPercent}%
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <BandLegend />
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn-canvas-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-canvas-grayDark">
              {card.value}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">{card.hint}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Score distribution
            </p>
            <p className="text-[11px] text-gray-400">{stats.clean} under 25%</p>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
            {(
              [
                ["blue", bandCounts.blue],
                ["green", bandCounts.green],
                ["yellow", bandCounts.yellow],
                ["orange", bandCounts.orange],
                ["red", bandCounts.red],
              ] as const
            ).map(([band, count]) => {
              if (count === 0) return null;
              const c = similarityBandClasses(band);
              const pct = (count / rows.length) * 100;
              return (
                <div
                  key={band}
                  className={`h-full ${c.bar}`}
                  style={{ width: `${pct}%` }}
                  title={`${band}: ${count}`}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students or top matches…"
              className="form-input h-10 w-full pl-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as InboxSort)}
                className="form-input h-9 text-xs"
              >
                <option value="similarity">Highest similarity</option>
                <option value="name">Student A–Z</option>
                <option value="newest">Newest</option>
                <option value="words">Most words</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Min %
              <input
                type="number"
                min={0}
                max={100}
                value={minPct}
                onChange={(e) => setMinPct(Math.max(0, Number(e.target.value) || 0))}
                className="form-input h-9 w-16 text-xs"
              />
            </label>
            <p className="text-xs text-gray-400">
              {filtered.length} of {rows.length}
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-canvas-grayDark">
              No matching submissions
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {rows.length === 0
                ? "Text answers will appear here after students submit."
                : "Try lowering the minimum % or clearing search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Similarity</th>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Peer / Self</th>
                  <th className="px-5 py-3">Attempt</th>
                  <th className="px-5 py-3">Words</th>
                  <th className="px-5 py-3">Top match</th>
                  {hasSnapshots && <th className="px-5 py-3">At submit</th>}
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const band = similarityBand(row.overallPct);
                  const c = similarityBandClasses(band);
                  const drift =
                    row.snapshotPct != null ? row.overallPct - row.snapshotPct : null;
                  return (
                    <tr
                      key={row.attempt.id}
                      className="group cursor-pointer border-b border-gray-100 transition hover:bg-canvas-blueTint/40"
                      onClick={() => onOpen(row.attempt.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <ScoreBadge pct={row.overallPct} />
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 sm:block">
                            <div
                              className={`h-full rounded-full ${c.bar}`}
                              style={{ width: `${Math.max(4, row.overallPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-canvas-grayDark">
                          {row.attempt.studentName}
                        </p>
                        {row.matchCount > 0 && (
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {row.matchCount} match
                            {row.matchCount === 1 ? "" : "es"}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="inline-flex items-center gap-1.5">
                            <KindBadge kind="peer" />
                            <span className="font-semibold tabular-nums text-canvas-grayDark">
                              {row.peerPct}%
                            </span>
                            <span className="text-gray-400">
                              ({row.peerMatchCount})
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <KindBadge kind="self" />
                            <span className="font-semibold tabular-nums text-canvas-grayDark">
                              {row.selfPct}%
                            </span>
                            <span className="text-gray-400">
                              ({row.selfMatchCount})
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-600">
                        #{row.attempt.attemptNumber}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-600">
                        {row.wordCount}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.topSourceName ? (
                          <div>
                            <p className="font-medium text-canvas-grayDark">
                              {row.topSourceName}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                              {row.topMatchKind && <KindBadge kind={row.topMatchKind} />}
                              {row.topSourcePct}% overlap
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {hasSnapshots && (
                        <td className="px-5 py-3.5 text-xs">
                          {row.snapshotPct != null ? (
                            <div>
                              <span className="font-semibold tabular-nums text-canvas-grayDark">
                                {row.snapshotPct}%
                              </span>
                              {drift != null && drift !== 0 && (
                                <span
                                  className={`ml-1.5 tabular-nums ${
                                    drift > 0 ? "text-orange-600" : "text-emerald-600"
                                  }`}
                                >
                                  {drift > 0 ? "+" : ""}
                                  {drift}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {formatQuizDateTime(row.attempt.submittedAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpen(row.attempt.id)}
                            className="btn-canvas-primary h-8 px-3 text-xs"
                          >
                            Open report
                          </button>
                          <Link
                            to={`/courses/${courseId}/quizzes/${quizId}/grade?attempt=${row.attempt.id}`}
                            className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium leading-8 text-gray-600 hover:bg-gray-50"
                          >
                            GradePro
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightedText({
  text,
  phrases,
  markClass,
}: {
  text: string;
  phrases: string[];
  markClass: string;
}) {
  const parts = useMemo(
    () => highlightSharedPhrases(text, [...new Set(phrases)]),
    [text, phrases],
  );
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className={`rounded px-0.5 ${markClass}`}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function ComparePane({
  attempt,
  displayName,
  source,
  texts,
  textsByAttemptQuestion,
  questionLabel,
  quizTitle,
  onClose,
}: {
  attempt: QuizAttempt;
  displayName: string;
  source: SimilaritySourceCard;
  texts: Record<string, string>;
  textsByAttemptQuestion: Record<string, Record<string, string>>;
  questionLabel: (id: string) => string;
  quizTitle: string;
  onClose: () => void;
}) {
  const color =
    MATCH_SOURCE_COLORS[(source.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!;
  const otherQuizTitle = source.crossQuiz
    ? (source.otherQuizTitle ?? "another quiz")
    : quizTitle;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white px-4 py-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${color.bg}`}
          >
            {source.sourceIndex}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-canvas-grayDark">
              {displayName} vs {source.otherStudentName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <KindBadge kind={source.matchKind} />
              {source.crossQuiz && <CrossQuizBadge quizTitle={source.otherQuizTitle} />}
              <span className="text-[11px] text-gray-500">
                {source.pct}% top overlap · {source.matchCount} question match
                {source.matchCount === 1 ? "" : "es"}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-gray-500 hover:text-canvas-blue hover:underline"
        >
          Back to document
        </button>
      </div>

      {source.pairs.map((pair) => {
        const myQuestionId = questionIdForAttempt(pair, attempt.id);
        const otherQuestionId = questionIdForAttempt(pair, source.otherAttemptId);
        const myText = texts[myQuestionId] ?? "";
        const otherText =
          textsByAttemptQuestion[source.otherAttemptId]?.[otherQuestionId] ?? "";
        return (
          <section
            key={`${myQuestionId}-${otherQuestionId}-${pair.combined}`}
            className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Side-by-side
                </p>
                <h3 className="truncate text-sm font-semibold text-canvas-grayDark">
                  {questionLabel(myQuestionId)}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                <span className="font-semibold tabular-nums text-canvas-grayDark">
                  {Math.round(pair.combined * 100)}% combined
                </span>
                <span>Tokens {Math.round(pair.similarity * 100)}%</span>
                <span>Phrases {Math.round(pair.phraseSimilarity * 100)}%</span>
                {pair.codeNormalized && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-700">
                    Code normalized
                  </span>
                )}
              </div>
            </header>
            <div className="grid gap-px bg-gray-100 lg:grid-cols-2">
              <div className="bg-white px-5 py-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-3.5 w-3.5" />
                  {displayName} · this submission
                </p>
                {myText.trim() ? (
                  <HighlightedText
                    text={myText}
                    phrases={pair.sharedPhrases}
                    markClass={color.mark}
                  />
                ) : (
                  <p className="text-sm text-gray-400">No text for this response.</p>
                )}
              </div>
              <div className="bg-white px-5 py-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-3.5 w-3.5" />
                  {source.otherStudentName} · {otherQuizTitle}
                </p>
                {otherText.trim() ? (
                  <HighlightedText
                    text={otherText}
                    phrases={pair.sharedPhrases}
                    markClass={color.mark}
                  />
                ) : (
                  <p className="text-sm text-gray-400">
                    Matched text is unavailable for this response.
                  </p>
                )}
              </div>
            </div>
            {pair.codeNormalized && (
              <p className="border-t border-gray-100 bg-slate-50 px-5 py-2 text-[11px] text-gray-500">
                Code answers are compared after identifier and literal normalization, so
                highlights may not line up exactly with the original source.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DocumentPane({
  attempt,
  displayName,
  questionMeta,
  texts,
  textsByAttemptQuestion,
  sources,
  activeSourceIndex,
  onSelectSource,
  view,
  setView,
  layer,
  setLayer,
  layerCounts,
  questionLabel,
  quizTitle,
}: {
  attempt: QuizAttempt;
  displayName: string;
  questionMeta: { id: string; label: string }[];
  texts: Record<string, string>;
  textsByAttemptQuestion: Record<string, Record<string, string>>;
  sources: SimilaritySourceCard[];
  activeSourceIndex: number | null;
  onSelectSource: (index: number | null) => void;
  view: DocumentView;
  setView: (view: DocumentView) => void;
  layer: MatchLayer;
  setLayer: (layer: MatchLayer) => void;
  layerCounts: LayerCounts;
  questionLabel: (id: string) => string;
  quizTitle: string;
}) {
  const sourceByQuestion = useMemo(() => {
    const map = new Map<string, SimilaritySourceCard[]>();
    for (const s of sources) {
      for (const qid of s.questionIds) {
        const list = map.get(qid) ?? [];
        list.push(s);
        map.set(qid, list);
      }
    }
    return map;
  }, [sources]);

  const activeSource =
    sources.find((s) => s.sourceIndex === activeSourceIndex) ?? null;
  const answered = questionMeta.filter((q) => texts[q.id]?.trim());

  const toolbar = (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/70 bg-white/85 px-6 py-3 backdrop-blur lg:px-8">
      <LayerControl value={layer} onChange={setLayer} counts={layerCounts} />
      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-[11px] font-semibold shadow-sm">
        <button
          type="button"
          onClick={() => setView("document")}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${
            view === "document"
              ? "bg-canvas-blue text-white shadow-sm"
              : "text-gray-500 hover:text-canvas-grayDark"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Document
        </button>
        <button
          type="button"
          onClick={() => setView("compare")}
          disabled={!activeSource}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            view === "compare" && activeSource
              ? "bg-canvas-blue text-white shadow-sm"
              : "text-gray-500 hover:text-canvas-grayDark"
          }`}
          title={activeSource ? undefined : "Select a source to compare"}
        >
          <Columns2 className="h-3.5 w-3.5" />
          Side-by-side
        </button>
      </div>
    </div>
  );

  if (answered.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
          <ShieldAlert className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-canvas-grayDark">No text to analyze</p>
          <p className="max-w-sm text-sm text-gray-500">
            This attempt has no essay or short-text answers.
          </p>
        </div>
      </div>
    );
  }

  if (view === "compare" && activeSource) {
    return (
      <div>
        {toolbar}
        <ComparePane
          attempt={attempt}
          displayName={displayName}
          source={activeSource}
          texts={texts}
          textsByAttemptQuestion={textsByAttemptQuestion}
          questionLabel={questionLabel}
          quizTitle={quizTitle}
          onClose={() => setView("document")}
        />
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <div className="space-y-5 p-6 lg:p-8">
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-3 text-sm text-gray-600">
          Highlighted spans match other attempts in the corpus. Click a numbered chip to
          focus one source, then switch to side-by-side to read both responses together.
        </div>
        {answered.map((q, qi) => {
          const text = texts[q.id] ?? "";
          const qSources = sourceByQuestion.get(q.id) ?? [];
          const allPhrases = qSources.flatMap((s) =>
            s.pairs
              .filter((p) => questionIdForAttempt(p, attempt.id) === q.id)
              .flatMap((p) => p.sharedPhrases),
          );
          const active = qSources.find((s) => s.sourceIndex === activeSourceIndex);
          const phrases =
            active && active.questionIds.includes(q.id)
              ? active.pairs
                  .filter((p) => questionIdForAttempt(p, attempt.id) === q.id)
                  .flatMap((p) => p.sharedPhrases)
              : allPhrases;
          const markClass =
            active != null
              ? MATCH_SOURCE_COLORS[(active.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!
                  .mark
              : "bg-amber-200/90";

          return (
            <section
              key={q.id}
              className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Response {qi + 1}
                  </p>
                  <h3 className="text-sm font-semibold text-canvas-grayDark">{q.label}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {qSources.length === 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      No matches
                    </span>
                  ) : (
                    qSources.map((s) => {
                      const color =
                        MATCH_SOURCE_COLORS[(s.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!;
                      const selected = activeSourceIndex === s.sourceIndex;
                      return (
                        <button
                          key={s.sourceIndex}
                          type="button"
                          onClick={() => onSelectSource(selected ? null : s.sourceIndex)}
                          className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold text-white shadow-sm transition ${color.bg} ${
                            selected
                              ? "ring-2 ring-canvas-blue ring-offset-2"
                              : "opacity-90 hover:opacity-100"
                          }`}
                          title={`${s.otherStudentName} · ${s.pct}% · ${
                            s.matchKind === "self" ? "Self" : "Peer"
                          }`}
                        >
                          {s.sourceIndex}
                        </button>
                      );
                    })
                  )}
                </div>
              </header>
              <div className="px-5 py-5">
                <HighlightedText text={text} phrases={phrases} markClass={markClass} />
              </div>
            </section>
          );
        })}
        <p className="pb-4 text-center text-xs text-gray-400">
          {displayName} · Attempt #{attempt.attemptNumber} ·{" "}
          {formatQuizDateTime(attempt.submittedAt)}
        </p>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-canvas-blue"
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-canvas-grayDark">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
          {hint}
        </span>
      </span>
    </label>
  );
}

function InsightPanel({
  tab,
  setTab,
  attemptId,
  overallPct,
  peerPct,
  selfPct,
  coveragePct,
  wordCount,
  matchCount,
  sources,
  filteredSources,
  activeSourceIndex,
  setActiveSourceIndex,
  questionLabel,
  layer,
  setLayer,
  layerCounts,
  excludeSmallWords,
  setExcludeSmallWords,
  minPct,
  setMinPct,
  excludedSources,
  toggleExclude,
  onOpenAttempt,
  gradeProPath,
  settings,
  onPatchSettings,
  excludeDraft,
  setExcludeDraft,
  onApplyExclude,
  onResetSettings,
  settingsDirty,
  onExportJson,
}: {
  tab: InsightTab;
  setTab: (t: InsightTab) => void;
  attemptId: string;
  overallPct: number;
  peerPct: number;
  selfPct: number;
  coveragePct: number;
  wordCount: number;
  matchCount: number;
  sources: SimilaritySourceCard[];
  filteredSources: SimilaritySourceCard[];
  activeSourceIndex: number | null;
  setActiveSourceIndex: (n: number | null) => void;
  questionLabel: (id: string) => string;
  layer: MatchLayer;
  setLayer: (layer: MatchLayer) => void;
  layerCounts: LayerCounts;
  excludeSmallWords: number;
  setExcludeSmallWords: (n: number) => void;
  minPct: number;
  setMinPct: (n: number) => void;
  excludedSources: Set<string>;
  toggleExclude: (attemptId: string) => void;
  onOpenAttempt: (id: string) => void;
  gradeProPath: string;
  settings: QuizSimilarityCorpus["settings"];
  onPatchSettings: (patch: Partial<SoftOriginalitySettings>) => void;
  excludeDraft: string;
  setExcludeDraft: (value: string) => void;
  onApplyExclude: () => void;
  onResetSettings: () => void;
  settingsDirty: boolean;
  onExportJson: () => void;
}) {
  const band = similarityBand(overallPct);
  const colors = similarityBandClasses(band);
  const excludeCount = parseExcludeText(settings.excludeText).length;

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-l border-gray-200 bg-white md:w-[400px] xl:w-[440px]">
      <div className={`relative overflow-hidden border-b px-5 py-5 ${colors.badge}`}>
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/30" />
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
          Similarity score
        </p>
        <div className="mt-2 flex items-end gap-4">
          <span className={`text-5xl font-bold tabular-nums tracking-tight ${colors.fill}`}>
            {overallPct}
            <span className="text-2xl">%</span>
          </span>
          <div className="pb-1 text-xs leading-relaxed text-gray-700">
            <p className="font-medium">
              {matchCount} source{matchCount === 1 ? "" : "s"}
            </p>
            <p>~{coveragePct}% coverage</p>
            <p>{wordCount} words analyzed</p>
          </div>
        </div>
        <p className={`mt-3 text-sm font-medium ${colors.text}`}>
          {band === "blue" && "No significant matches"}
          {band === "green" && "Low similarity"}
          {band === "yellow" && "Moderate similarity — review matches"}
          {band === "orange" && "High similarity — review carefully"}
          {band === "red" && "Very high similarity — likely overlap"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            <Users className="h-3 w-3" />
            Peer {peerPct}%
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            <UserRound className="h-3 w-3" />
            Self {selfPct}%
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            <Layers className="h-3 w-3" />
            {corpusScopeLabel(settings)}
          </span>
        </div>
      </div>

      <div className="flex border-b border-gray-100 bg-slate-50/50 text-xs font-semibold">
        {(
          [
            ["overview", "Overview", ListTree],
            ["sources", "Sources", Layers],
            ["filters", "Filters", Filter],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-3 transition ${
              tab === id
                ? "border-b-2 border-canvas-blue bg-white text-canvas-blue"
                : "text-gray-500 hover:text-canvas-grayDark"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Match overview
              </p>
              <LayerControl value={layer} onChange={setLayer} counts={layerCounts} />
            </div>
            {filteredSources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-canvas-grayDark">No matches</p>
                <p className="mt-1 text-xs text-gray-500">
                  {layer === "all"
                    ? "Adjust filters or this submission is unique in the corpus."
                    : `No ${layer} matches at the current filters.`}
                </p>
              </div>
            ) : (
              filteredSources.map((s) => {
                const color =
                  MATCH_SOURCE_COLORS[(s.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!;
                const open = activeSourceIndex === s.sourceIndex;
                return (
                  <div
                    key={s.otherAttemptId}
                    className={`overflow-hidden rounded-xl border transition ${
                      open
                        ? "border-canvas-blue shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSourceIndex(open ? null : s.sourceIndex)}
                      className="flex w-full items-start gap-3 px-3 py-3 text-left"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${color.bg}`}
                      >
                        {s.sourceIndex}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-canvas-grayDark">
                            {s.otherStudentName}
                          </span>
                          <span className="text-base font-bold tabular-nums text-gray-800">
                            {s.pct}%
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <KindBadge kind={s.matchKind} />
                          {s.crossQuiz && <CrossQuizBadge quizTitle={s.otherQuizTitle} />}
                        </span>
                        <span className="mt-1 block text-[11px] text-gray-500">
                          {s.matchCount} match{s.matchCount === 1 ? "" : "es"} · ~
                          {s.matchingWordEstimate} overlapping words
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <span
                            className={`block h-full rounded-full ${color.bg}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </span>
                      </span>
                      {open ? (
                        <ChevronDown className="mt-1 h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="mt-1 h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-gray-100 bg-slate-50/80 px-3 py-3 text-xs">
                        {s.pairs.map((p) => {
                          const qid = questionIdForAttempt(p, attemptId);
                          return (
                            <div
                              key={`${qid}-${p.combined}`}
                              className="rounded-lg border border-gray-200 bg-white p-2.5"
                            >
                              <p className="font-semibold text-canvas-grayDark">
                                {questionLabel(qid)} · {Math.round(p.combined * 100)}%
                              </p>
                              <p className="mt-0.5 text-[10px] text-gray-500">
                                Tokens {Math.round(p.similarity * 100)}% · Phrases{" "}
                                {Math.round(p.phraseSimilarity * 100)}% ·{" "}
                                {p.sharedTokenCount} shared tokens
                                {p.codeNormalized ? " · code normalized" : ""}
                              </p>
                              {p.sharedPhrases.length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-1">
                                  {p.sharedPhrases.slice(0, 8).map((ph) => (
                                    <li
                                      key={ph}
                                      className={`rounded-md border bg-white px-1.5 py-0.5 text-[10px] ${color.border}`}
                                    >
                                      “{ph}”
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenAttempt(s.otherAttemptId)}
                            className="inline-flex items-center gap-1 font-medium text-canvas-blue hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open source report
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExclude(s.otherAttemptId)}
                            className="text-gray-500 hover:underline"
                          >
                            Exclude source
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "sources" && (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[11px] leading-relaxed text-sky-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Every source in the current layer, including overlaps. Exclude noise and the
              score refreshes.
            </div>
            {sources.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">No sources found.</p>
            ) : (
              sources.map((s) => {
                const color =
                  MATCH_SOURCE_COLORS[(s.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!;
                const excluded = excludedSources.has(s.otherAttemptId);
                return (
                  <div
                    key={s.otherAttemptId}
                    className={`rounded-xl border px-3 py-2.5 ${
                      excluded ? "border-gray-200 opacity-45" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${color.bg}`}
                      >
                        {s.sourceIndex}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{s.otherStudentName}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <KindBadge kind={s.matchKind} />
                          {s.crossQuiz && <CrossQuizBadge quizTitle={s.otherQuizTitle} />}
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {s.pct}% · {s.questionIds.map(questionLabel).join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleExclude(s.otherAttemptId)}
                        className="shrink-0 text-[11px] font-medium text-gray-500 hover:text-canvas-blue"
                      >
                        {excluded ? "Restore" : "Exclude"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "filters" && (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Corpus (this session)
              </p>
              <div className="mt-2 space-y-2">
                <SettingToggle
                  label="Compare own earlier attempts"
                  hint="Adds self matches when a student has multiple attempts."
                  checked={settings.includeSelfAttempts}
                  onChange={(next) => onPatchSettings({ includeSelfAttempts: next })}
                />
                <SettingToggle
                  label="Include other quizzes in this course"
                  hint="Widens the corpus to similar prompts on other quizzes."
                  checked={settings.includeOtherQuizzes}
                  onChange={(next) => onPatchSettings({ includeOtherQuizzes: next })}
                />
                <SettingToggle
                  label="Normalize code answers"
                  hint="Strips comments and renames identifiers before comparing code."
                  checked={settings.normalizeCode}
                  onChange={(next) => onPatchSettings({ normalizeCode: next })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600">
                Exclude boilerplate phrases
                <textarea
                  value={excludeDraft}
                  onChange={(e) => setExcludeDraft(e.target.value)}
                  rows={4}
                  placeholder={"One phrase per line, e.g.\nIn this essay I will argue"}
                  className="form-input mt-2 w-full text-xs leading-relaxed"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onApplyExclude}
                  className="btn-canvas-primary h-8 px-3 text-xs"
                >
                  Apply
                </button>
                <span className="text-[11px] text-gray-500">
                  {excludeCount} phrase{excludeCount === 1 ? "" : "s"} ignored
                </span>
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-600">
              Exclude sources below this similarity
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={minPct}
                onChange={(e) => setMinPct(Number(e.target.value))}
                className="mt-3 w-full accent-canvas-blue"
              />
              <span className="mt-1.5 flex justify-between text-xs">
                <span className="text-gray-400">0%</span>
                <span className="font-semibold text-canvas-grayDark">{minPct}%</span>
                <span className="text-gray-400">50%</span>
              </span>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Exclude small matches (overlapping words)
              <input
                type="number"
                min={0}
                max={100}
                value={excludeSmallWords}
                onChange={(e) =>
                  setExcludeSmallWords(Math.max(0, Number(e.target.value) || 0))
                }
                className="form-input mt-2 h-10 w-full"
              />
            </label>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-[11px] leading-relaxed text-amber-950">
              Session overrides only — quiz settings are unchanged. Filters recalculate
              listed sources and highlights; the overall score uses remaining sources only
              (soft client-side approximation).
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-canvas-blue hover:underline"
              >
                <FileJson className="h-3.5 w-3.5" />
                Export report JSON
              </button>
              {settingsDirty && (
                <button
                  type="button"
                  onClick={onResetSettings}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-canvas-grayDark hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to quiz settings
                </button>
              )}
              <Link
                to={gradeProPath}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-canvas-blue hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in GradePro
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 bg-slate-50 px-4 py-2.5 text-[10px] leading-relaxed text-gray-500">
        Soft originality against other attempts in this course — not Turnitin or an
        internet database.
      </div>
    </aside>
  );
}

export default function QuizSimilarityReportPage() {
  const { courseId, quizId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const attemptId = searchParams.get("attempt");

  const quiz = quizId ? getQuizById(effectiveCourseId, quizId) : undefined;
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() =>
    quizId ? getAttemptsForQuiz(effectiveCourseId, quizId) : [],
  );

  useEffect(() => {
    if (!quizId) return;
    const refresh = () => setAttempts(getAttemptsForQuiz(effectiveCourseId, quizId));
    refresh();
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
  }, [effectiveCourseId, quizId]);

  const columnKey = quizId ? `quiz:${quizId}` : "";

  const [settingsOverride, setSettingsOverride] = useState<
    Partial<SoftOriginalitySettings>
  >({});
  const settingsDirty = Object.keys(settingsOverride).length > 0;

  const corpus = useMemo<QuizSimilarityCorpus>(() => {
    if (!quiz) {
      return {
        rows: [],
        pairs: [],
        questionMeta: [],
        textsByAttemptQuestion: {},
        wordCountByAttempt: {},
        settings: resolveSoftOriginalitySettings(undefined),
        attemptQuizTitle: {},
      };
    }
    return buildQuizSimilarityCorpus(quiz, attempts, {
      courseId: effectiveCourseId,
      columnKey,
      anonymousEnabled: Boolean(quiz.anonymousGrading),
      threshold: 0.01,
      settingsOverride,
    });
  }, [quiz, attempts, effectiveCourseId, columnKey, settingsOverride]);

  const inbox = useMemo(
    () => buildClassSimilarityInbox(attempts, corpus),
    [attempts, corpus],
  );

  const attempt = attemptId
    ? attempts.find((a) => a.id === attemptId)
    : undefined;

  const [insightTab, setInsightTab] = useState<InsightTab>("overview");
  const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(null);
  const [minPct, setMinPct] = useState(5);
  const [excludeSmallWords, setExcludeSmallWords] = useState(3);
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set());
  const [layer, setLayer] = useState<MatchLayer>("all");
  const [documentView, setDocumentView] = useState<DocumentView>("document");
  const [excludeDraft, setExcludeDraft] = useState(corpus.settings.excludeText);

  useEffect(() => {
    setActiveSourceIndex(null);
    setExcludedSources(new Set());
    setDocumentView("document");
  }, [attemptId]);

  const attemptPairs = useMemo(() => {
    if (!attempt) return [];
    return corpus.pairs.filter(
      (p) => p.attemptIdA === attempt.id || p.attemptIdB === attempt.id,
    );
  }, [attempt, corpus.pairs]);

  const layerCounts = useMemo<LayerCounts>(
    () => ({
      all: attemptPairs.length,
      peer: attemptPairs.filter((p) => p.matchKind === "peer").length,
      self: attemptPairs.filter((p) => p.matchKind === "self").length,
    }),
    [attemptPairs],
  );

  const layerPairs = useMemo(
    () =>
      layer === "all"
        ? attemptPairs
        : attemptPairs.filter((p) => p.matchKind === layer),
    [attemptPairs, layer],
  );

  const allSources = useMemo(
    () => (attempt ? buildSourcesForAttempt(attempt.id, layerPairs) : []),
    [attempt, layerPairs],
  );

  const activePairs = useMemo(() => {
    if (!attempt) return [];
    return layerPairs.filter((p) => {
      const other = p.attemptIdA === attempt.id ? p.attemptIdB : p.attemptIdA;
      if (excludedSources.has(other)) return false;
      if (p.combined * 100 < minPct) return false;
      const phraseWords = p.sharedPhrases.reduce(
        (n, ph) => n + ph.split(/\s+/).filter(Boolean).length,
        0,
      );
      const words = Math.max(p.sharedTokenCount, phraseWords);
      if (excludeSmallWords > 0 && words < excludeSmallWords) return false;
      return true;
    });
  }, [attempt, layerPairs, excludedSources, minPct, excludeSmallWords]);

  const filteredSources = useMemo(
    () => (attempt ? buildSourcesForAttempt(attempt.id, activePairs) : []),
    [attempt, activePairs],
  );

  const overallSummary = useMemo(
    () =>
      attempt
        ? summarizeAttemptSimilarity(attempt.id, activePairs)
        : {
            overallPct: 0,
            peerPct: 0,
            selfPct: 0,
            matchCount: 0,
            peerMatchCount: 0,
            selfMatchCount: 0,
            byQuestion: [],
            matches: [],
            attemptId: "",
          },
    [attempt, activePairs],
  );

  const wordCount = attempt ? corpus.wordCountByAttempt[attempt.id] ?? 0 : 0;
  const coveragePct = attempt
    ? estimateSubmissionCoveragePct(attempt.id, activePairs, wordCount)
    : 0;

  if (studentView) {
    return (
      <UnavailableScreen
        title="Instructors only"
        message="Similarity reports are only available to instructors."
      />
    );
  }

  if (!quiz || !quizId) {
    return (
      <UnavailableScreen title="Quiz not found" message="This quiz could not be loaded." />
    );
  }

  const openAttempt = (id: string) => {
    setSearchParams({ attempt: id });
  };

  const displayName = attempt
    ? graderDisplayName({
        courseId: effectiveCourseId,
        columnKey,
        studentId: attempt.studentId,
        realName: attempt.studentName,
        anonymousEnabled: Boolean(quiz.anonymousGrading),
      })
    : "";

  const questionLabel = (id: string) =>
    corpus.questionMeta.find((q) => q.id === id)?.label ?? "Matched response";

  const patchSettings = (patch: Partial<SoftOriginalitySettings>) => {
    setSettingsOverride((prev) => ({ ...prev, ...patch }));
    setActiveSourceIndex(null);
    setDocumentView("document");
  };

  const resetSettings = () => {
    setSettingsOverride({});
    setExcludeDraft(quiz.softOriginality?.excludeText ?? "");
    setActiveSourceIndex(null);
    setDocumentView("document");
  };

  const selectSource = (index: number | null) => {
    setActiveSourceIndex(index);
    if (index != null) setDocumentView("compare");
  };

  const exportReportJson = () => {
    if (!attempt) return;
    const payload = {
      kind: "soft-originality-report",
      generatedAt: new Date().toISOString(),
      course: { id: effectiveCourseId },
      quiz: { id: quizId, title: quiz.title },
      settings: corpus.settings,
      filters: {
        layer,
        minPct,
        excludeSmallWords,
        excludedAttemptIds: [...excludedSources],
      },
      attempt: {
        id: attempt.id,
        student: displayName,
        attemptNumber: attempt.attemptNumber,
        submittedAt: new Date(attempt.submittedAt).toISOString(),
        wordCount,
      },
      summary: {
        overallPct: overallSummary.overallPct,
        peerPct: overallSummary.peerPct,
        selfPct: overallSummary.selfPct,
        matchCount: overallSummary.matchCount,
        peerMatchCount: overallSummary.peerMatchCount,
        selfMatchCount: overallSummary.selfMatchCount,
        coveragePct,
        byQuestion: overallSummary.byQuestion.map((q) => ({
          ...q,
          label: questionLabel(q.questionId),
        })),
        snapshotPct: attempt.softOriginalitySnapshot?.overallPct ?? null,
      },
      sources: filteredSources.map((s) => ({
        sourceIndex: s.sourceIndex,
        student: s.otherStudentName,
        attemptId: s.otherAttemptId,
        matchKind: s.matchKind,
        crossQuiz: s.crossQuiz,
        quizTitle: s.otherQuizTitle,
        pct: s.pct,
        matchCount: s.matchCount,
        matchingWordEstimate: s.matchingWordEstimate,
        questions: s.pairs.map((p) => {
          const qid = questionIdForAttempt(p, attempt.id);
          return {
            questionId: qid,
            label: questionLabel(qid),
            combinedPct: Math.round(p.combined * 100),
            tokenPct: Math.round(p.similarity * 100),
            phrasePct: Math.round(p.phraseSimilarity * 100),
            sharedTokenCount: p.sharedTokenCount,
            sharedPhrases: p.sharedPhrases,
            codeNormalized: Boolean(p.codeNormalized),
          };
        }),
      })),
    };
    downloadText(
      `${fileSlug(quiz.title)}-${fileSlug(displayName)}-originality.json`,
      exportSimilarityReportJson(payload),
      "application/json",
    );
  };

  const originalityDisabled = corpus.settings.enabled === false;

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="border-b border-gray-200 bg-white px-6 py-3.5 lg:px-8">
        <div className="flex w-full flex-wrap items-center gap-3">
          <Link
            to={`/courses/${effectiveCourseId}/quizzes/${quizId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Quiz
          </Link>
          <span className="text-gray-300">/</span>
          {attemptId ? (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="text-sm font-medium text-canvas-blue hover:underline"
            >
              Similarity Inbox
            </button>
          ) : (
            <span className="text-sm text-gray-600">Similarity Inbox</span>
          )}
          {attempt && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold text-canvas-grayDark">{displayName}</span>
              <ScoreBadge pct={overallSummary.overallPct} />
            </>
          )}
          <div className="ml-auto flex items-center gap-2 rounded-full border border-gray-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-gray-600">
            {originalityDisabled ? (
              <>
                <ShieldOff className="h-3.5 w-3.5 text-gray-400" />
                Soft originality · disabled
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-canvas-blue" />
                Soft originality · {corpusScopeLabel(corpus.settings).toLowerCase()}
              </>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-sm text-gray-500">{quiz.title}</p>
      </div>

      {originalityDisabled ? (
        <OriginalityDisabledState
          quizEditPath={`/courses/${effectiveCourseId}/quizzes/${quizId}/edit`}
        />
      ) : !attemptId ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ClassInbox
            courseId={effectiveCourseId}
            quizId={quizId}
            quizTitle={quiz.title}
            rows={inbox}
            settings={corpus.settings}
            onOpen={openAttempt}
          />
        </div>
      ) : !attempt ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm text-gray-500">
          Attempt not found.
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="btn-canvas-secondary text-sm"
          >
            Back to inbox
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
            <DocumentPane
              attempt={attempt}
              displayName={displayName}
              questionMeta={corpus.questionMeta}
              texts={corpus.textsByAttemptQuestion[attempt.id] ?? {}}
              textsByAttemptQuestion={corpus.textsByAttemptQuestion}
              sources={filteredSources}
              activeSourceIndex={activeSourceIndex}
              onSelectSource={setActiveSourceIndex}
              view={documentView}
              setView={setDocumentView}
              layer={layer}
              setLayer={setLayer}
              layerCounts={layerCounts}
              questionLabel={questionLabel}
              quizTitle={quiz.title}
            />
          </div>
          <InsightPanel
            tab={insightTab}
            setTab={setInsightTab}
            attemptId={attempt.id}
            overallPct={overallSummary.overallPct}
            peerPct={overallSummary.peerPct}
            selfPct={overallSummary.selfPct}
            coveragePct={coveragePct}
            wordCount={wordCount}
            matchCount={filteredSources.length}
            sources={allSources}
            filteredSources={filteredSources}
            activeSourceIndex={activeSourceIndex}
            setActiveSourceIndex={selectSource}
            questionLabel={questionLabel}
            layer={layer}
            setLayer={setLayer}
            layerCounts={layerCounts}
            excludeSmallWords={excludeSmallWords}
            setExcludeSmallWords={setExcludeSmallWords}
            minPct={minPct}
            setMinPct={setMinPct}
            excludedSources={excludedSources}
            toggleExclude={(id) => {
              setExcludedSources((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onOpenAttempt={openAttempt}
            gradeProPath={`/courses/${effectiveCourseId}/quizzes/${quizId}/grade?attempt=${attempt.id}`}
            settings={corpus.settings}
            onPatchSettings={patchSettings}
            excludeDraft={excludeDraft}
            setExcludeDraft={setExcludeDraft}
            onApplyExclude={() => patchSettings({ excludeText: excludeDraft })}
            onResetSettings={resetSettings}
            settingsDirty={settingsDirty}
            onExportJson={exportReportJson}
          />
        </div>
      )}
    </div>
  );
}
