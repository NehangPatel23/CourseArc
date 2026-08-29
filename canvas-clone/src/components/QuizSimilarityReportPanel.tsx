import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink, ShieldAlert } from "lucide-react";
import {
  highlightSharedPhrases,
  questionIdForAttempt,
  similarityBand,
  similarityBandClasses,
  summarizeAttemptSimilarity,
  type EssaySimilarityPair,
} from "../utils/quizEssaySimilarity";
import {
  buildSourcesForAttempt,
  MATCH_SOURCE_COLORS,
} from "../utils/quizSimilarityCorpus";

type QuestionMeta = { id: string; label: string };

function SimilarityGauge({ pct }: { pct: number }) {
  const band = similarityBand(pct);
  const colors = similarityBandClasses(band);
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[96px] w-[96px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-gray-200" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={colors.ring}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold tabular-nums ${colors.fill}`}>{pct}%</span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">
            Similar
          </span>
        </div>
      </div>
      <p className={`mt-1 text-[11px] font-medium ${colors.text}`}>
        {band === "blue" && "No significant matches"}
        {band === "green" && "Low similarity"}
        {band === "yellow" && "Moderate similarity"}
        {band === "orange" && "High similarity"}
        {band === "red" && "Very high similarity"}
      </p>
    </div>
  );
}

/** Compact GradePro panel: current submission matches only. */
export default function QuizSimilarityReportPanel({
  courseId,
  quizId,
  attemptId,
  pairs,
  questionMeta,
  textsByAttemptQuestion,
  onOpenAttempt,
}: {
  courseId: string;
  quizId: string;
  attemptId: string;
  pairs: EssaySimilarityPair[];
  questionMeta: QuestionMeta[];
  textsByAttemptQuestion: Record<string, Record<string, string>>;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const fullReportPath = `/courses/${courseId}/quizzes/${quizId}/similarity?attempt=${attemptId}`;
  const inboxPath = `/courses/${courseId}/quizzes/${quizId}/similarity`;

  const attemptPairs = useMemo(
    () =>
      pairs.filter((p) => p.attemptIdA === attemptId || p.attemptIdB === attemptId),
    [pairs, attemptId],
  );

  const summary = useMemo(
    () => summarizeAttemptSimilarity(attemptId, attemptPairs),
    [attemptId, attemptPairs],
  );

  const sources = useMemo(
    () => buildSourcesForAttempt(attemptId, attemptPairs),
    [attemptId, attemptPairs],
  );

  const labelFor = (qid: string) =>
    questionMeta.find((q) => q.id === qid)?.label ?? "Question";

  const band = similarityBand(summary.overallPct);
  const colors = similarityBandClasses(band);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-canvas-blue" />
          <h3 className="text-sm font-semibold text-canvas-grayDark">Similarity</h3>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
          Soft originality for this submission. Open the full report for side-by-side
          highlights, peer/self layers, and the class inbox.
        </p>
      </div>

      <div className={`border-b px-3 py-3 ${colors.badge}`}>
        <SimilarityGauge pct={summary.overallPct} />
        <div className="mt-2 flex justify-center gap-3 text-[11px] text-gray-600">
          <span>
            Peer <span className="font-semibold tabular-nums">{summary.peerPct}%</span>
          </span>
          <span>
            Self <span className="font-semibold tabular-nums">{summary.selfPct}%</span>
          </span>
        </div>
        <p className="mt-1 text-center text-[11px] text-gray-600">
          {sources.length === 0
            ? "No overlaps found."
            : `${sources.length} source${sources.length === 1 ? "" : "s"} · ${summary.matchCount} match${summary.matchCount === 1 ? "" : "es"}`}
        </p>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto p-3">
        {sources.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
            No overlapping submissions.
          </p>
        ) : (
          sources.slice(0, 8).map((s) => {
            const color =
              MATCH_SOURCE_COLORS[(s.sourceIndex - 1) % MATCH_SOURCE_COLORS.length]!;
            const open = expanded === s.sourceIndex;
            const top = s.pairs[0]!;
            const selfQ = questionIdForAttempt(top, attemptId);
            const otherId =
              top.attemptIdA === attemptId ? top.attemptIdB : top.attemptIdA;
            const otherQ = questionIdForAttempt(top, otherId);
            const selfText = textsByAttemptQuestion[attemptId]?.[selfQ] ?? "";
            const parts = highlightSharedPhrases(selfText, top.sharedPhrases).slice(0, 40);
            return (
              <div key={s.otherAttemptId} className="rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : s.sourceIndex)}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50"
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${color.bg}`}
                  >
                    {s.sourceIndex}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-canvas-grayDark">
                        {s.otherStudentName}
                      </span>
                      <span className="text-xs font-bold tabular-nums">{s.pct}%</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                      <span
                        className={`rounded px-1 py-0.5 font-semibold ${
                          s.matchKind === "self"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {s.matchKind === "self" ? "Self" : "Peer"}
                      </span>
                      {s.crossQuiz && (
                        <span className="rounded bg-amber-50 px-1 py-0.5 font-medium text-amber-800">
                          Cross-quiz
                        </span>
                      )}
                      <span>
                        {s.matchCount} match{s.matchCount === 1 ? "" : "es"} ·{" "}
                        {s.questionIds.map(labelFor).join(", ")}
                      </span>
                    </span>
                  </span>
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {open && (
                  <div className="space-y-2 border-t border-gray-100 bg-gray-50 px-2.5 py-2 text-[11px]">
                    <p className="font-medium text-canvas-grayDark">
                      Top overlap · {labelFor(selfQ)}
                      {otherQ !== selfQ ? ` ↔ ${labelFor(otherQ)}` : ""}
                    </p>
                    <p className="line-clamp-4 whitespace-pre-wrap text-gray-700">
                      {parts.map((part, i) =>
                        part.hit ? (
                          <mark key={i} className={`rounded-sm px-0.5 ${color.mark}`}>
                            {part.text}
                          </mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenAttempt(s.otherAttemptId)}
                      className="text-canvas-blue hover:underline"
                    >
                      Open matched attempt in GradePro
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
        <Link
          to={fullReportPath}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-canvas-blue hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full originality report
        </Link>
        <Link
          to={inboxPath}
          className="text-[11px] text-gray-500 hover:text-canvas-blue hover:underline"
        >
          Class similarity inbox
        </Link>
      </div>
    </div>
  );
}
