import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { QuizQuestion } from "../utils/quizzes";
import type { QuizAnswer } from "../utils/quizSubmissions";
import {
  generateCalculatedVariables,
  substituteCalculatedPrompt,
} from "../utils/quizFormula";
import QuizPrompt from "./QuizPrompt";

type Props = {
  question: QuizQuestion;
  answer?: QuizAnswer;
  disabled?: boolean;
  review?: boolean;
  revealKey?: boolean;
  attemptSeed?: string;
  onChange: (patch: QuizAnswer) => void;
};

export function QuizPhase7Inputs({
  question,
  answer,
  disabled,
  review,
  revealKey,
  attemptSeed,
  onChange,
}: Props) {
  switch (question.type) {
    case "fill_in_multiple_blanks":
      return (
        <FillMultipleBlanksInput
          question={question}
          answer={answer}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "ordering":
      return (
        <OrderingInput
          question={question}
          answer={answer}
          disabled={disabled}
          review={review}
          revealKey={revealKey}
          onChange={onChange}
        />
      );
    case "calculated":
      return (
        <CalculatedInput
          question={question}
          answer={answer}
          disabled={disabled}
          attemptSeed={attemptSeed}
          onChange={onChange}
        />
      );
    case "likert":
      return (
        <LikertInput question={question} answer={answer} disabled={disabled} onChange={onChange} />
      );
    case "hotspot":
      return (
        <HotspotInput
          question={question}
          answer={answer}
          disabled={disabled}
          review={review}
          revealKey={revealKey}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

function FillMultipleBlanksInput({
  question,
  answer,
  disabled,
  onChange,
}: Omit<Props, "review" | "revealKey" | "attemptSeed">) {
  const blanks = question.fillBlanks ?? [];
  const prompt = question.prompt || "";
  const parts = prompt.split(/(\{\{[^}]+\}\})/g);

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm leading-relaxed text-canvas-grayDark">
        {parts.map((part, i) => {
          const m = /^\{\{([^}]+)\}\}$/.exec(part);
          if (!m) return <span key={i}>{part}</span>;
          const id = m[1]!.trim();
          const blank = blanks.find((b) => b.id === id || b.label === id);
          const blankId = blank?.id ?? id;
          return (
            <input
              key={i}
              type="text"
              disabled={disabled}
              value={answer?.blankAnswers?.[blankId] ?? ""}
              onChange={(e) =>
                onChange({
                  questionId: question.id,
                  blankAnswers: { ...(answer?.blankAnswers ?? {}), [blankId]: e.target.value },
                })
              }
              className="mx-1 inline-block min-w-[6rem] border-b-2 border-canvas-blue bg-canvas-blueTint/30 px-2 py-0.5 text-sm"
              aria-label={blank?.label ?? id}
            />
          );
        })}
      </div>
      {blanks.length === 0 && (
        <p className="text-xs text-amber-700">No blanks configured — use {"{{blankId}}"} in the prompt.</p>
      )}
    </div>
  );
}

function OrderingInput({
  question,
  answer,
  disabled,
  review,
  revealKey,
  onChange,
}: Omit<Props, "attemptSeed">) {
  const items = question.orderingItems ?? [];
  const order = Array.isArray(answer?.ordering)
    ? answer.ordering
    : items.map((_, i) => i);

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const tmp = next[from]!;
    next[from] = next[to]!;
    next[to] = tmp;
    onChange({ questionId: question.id, ordering: next });
  };

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-gray-500">Put items in the correct order (top = first).</p>
      {order.map((itemIdx, pos) => {
        const label = items[itemIdx] ?? `Item ${itemIdx + 1}`;
        const keyPos = question.correctOrder?.indexOf(itemIdx);
        const showKey = review && revealKey && typeof keyPos === "number";
        const atKey = showKey && keyPos === pos;
        return (
          <div
            key={`${pos}-${itemIdx}`}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              atKey ? "border-green-300 bg-green-50" : review && showKey && !atKey ? "border-red-200 bg-red-50/50" : "border-gray-200"
            }`}
          >
            <span className="w-6 shrink-0 text-xs font-semibold text-gray-400">{pos + 1}.</span>
            <span className="min-w-0 flex-1">{label}</span>
            {!disabled && (
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(pos, -1)} disabled={pos === 0} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30" aria-label="Move up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(pos, 1)} disabled={pos === order.length - 1} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30" aria-label="Move down">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CalculatedInput({
  question,
  answer,
  disabled,
  attemptSeed,
  onChange,
}: Omit<Props, "review" | "revealKey">) {
  const seed = `${attemptSeed ?? question.id}:calc`;
  const vars = useMemo(() => {
    if (answer?.calculatedVars && Object.keys(answer.calculatedVars).length > 0) {
      return answer.calculatedVars;
    }
    return generateCalculatedVariables(question.calculatedVariables ?? [], seed);
  }, [answer?.calculatedVars, question.calculatedVariables, seed]);

  const seededRef = useRef(false);
  useEffect(() => {
    if (answer?.calculatedVars && Object.keys(answer.calculatedVars).length > 0) {
      seededRef.current = true;
      return;
    }
    if (seededRef.current) return;
    seededRef.current = true;
    onChange({ questionId: question.id, calculatedVars: vars, number: answer?.number });
  }, [answer?.calculatedVars, answer?.number, onChange, question.id, vars]);

  const displayPrompt = substituteCalculatedPrompt(question.prompt, vars);

  return (
    <div className="mt-4 space-y-3">
      <QuizPrompt text={displayPrompt} />
      <label className="block text-sm">
        <span className="font-medium text-gray-700">Your answer</span>
        <input
          type="number"
          disabled={disabled}
          value={answer?.number ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? undefined : Number(e.target.value);
            onChange({
              questionId: question.id,
              calculatedVars: vars,
              number: n,
            });
          }}
          className="form-input mt-1 max-w-xs"
        />
      </label>
    </div>
  );
}

function LikertInput({ question, answer, disabled, onChange }: Omit<Props, "review" | "revealKey" | "attemptSeed">) {
  const minRaw = Number(question.likertMin ?? 1);
  const maxRaw = Number(question.likertMax ?? 5);
  const min = Number.isFinite(minRaw) ? minRaw : 1;
  const max = Number.isFinite(maxRaw) ? maxRaw : 5;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const count = Math.min(21, Math.max(1, Math.floor(hi - lo) + 1));
  const values = Array.from({ length: count }, (_, i) => lo + i);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>{question.likertMinLabel ?? min}</span>
        <span>{question.likertMaxLabel ?? max}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((v) => (
          <label
            key={v}
            className={`flex min-w-[2.5rem] cursor-pointer flex-col items-center rounded-md border px-2 py-2 text-sm ${
              answer?.likertValue === v ? "border-canvas-blue bg-canvas-blueTint" : "border-gray-200"
            } ${disabled ? "cursor-default opacity-70" : "hover:bg-gray-50"}`}
          >
            <input
              type="radio"
              name={`likert-${question.id}`}
              checked={answer?.likertValue === v}
              disabled={disabled}
              onChange={() => onChange({ questionId: question.id, likertValue: v })}
              className="sr-only"
            />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

function HotspotInput({
  question,
  answer,
  disabled,
  review,
  revealKey,
  onChange,
}: Omit<Props, "attemptSeed">) {
  const [imgError, setImgError] = useState(false);
  const regions = question.hotspotRegions ?? [];
  const selected = answer?.hotspotIds ?? [];
  const url = question.hotspotImageUrl?.trim();

  const toggle = (id: string) => {
    if (disabled) return;
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ questionId: question.id, hotspotIds: [...set] });
  };

  if (!url) {
    return <p className="mt-4 text-sm text-amber-700">No hotspot image configured.</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      {!imgError ? (
        <div className="relative inline-block max-w-full overflow-hidden rounded-lg border border-gray-200">
          <img
            src={url}
            alt="Hotspot question"
            className="max-h-80 max-w-full object-contain"
            onError={() => setImgError(true)}
          />
          {regions.map((r) => {
            const isSelected = selected.includes(r.id);
            const isKey = review && revealKey && (question.correctHotspotIds ?? []).includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(r.id)}
                title={r.label ?? r.id}
                className={`absolute border-2 transition ${
                  isKey
                    ? "border-green-500 bg-green-400/30"
                    : isSelected
                      ? "border-canvas-blue bg-canvas-blue/30"
                      : "border-white/80 bg-black/10 hover:bg-canvas-blue/20"
                }`}
                style={{
                  left: `${r.x}%`,
                  top: `${r.y}%`,
                  width: `${r.w}%`,
                  height: `${r.h}%`,
                }}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-red-600">Could not load image.</p>
      )}
      <p className="text-xs text-gray-500">
        Click region(s) on the image.{regions.length === 0 ? " No regions defined yet." : ""}
      </p>
    </div>
  );
}

/** Essay reflection comment when required (#85). */
export function EssayCommentInput({
  question,
  answer,
  disabled,
  required,
  onChange,
}: {
  question: QuizQuestion;
  answer?: QuizAnswer;
  disabled?: boolean;
  required?: boolean;
  onChange: (patch: QuizAnswer) => void;
}) {
  if (!required) return null;
  return (
    <label className="mt-3 block text-sm">
      <span className="font-medium text-gray-700">
        Reflection comment {required ? "(required)" : ""}
      </span>
      <textarea
        value={answer?.essayComment ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange({ questionId: question.id, essayComment: e.target.value, shortAnswer: answer?.shortAnswer })
        }
        rows={2}
        placeholder="Brief note on your approach or assumptions"
        className="form-input mt-1 min-h-[4rem] resize-y"
      />
    </label>
  );
}
