import {
  applyNumericalBandPreset,
  NUMERICAL_BAND_PRESET_LABELS,
  uid,
  type NumericalBandPreset,
  type QuizQuestion,
} from "../utils/quizzes";

type PatchFn = (patch: Partial<QuizQuestion>) => void;

export function QuizPhase7EditorFields({
  question,
  onPatch,
}: {
  question: QuizQuestion;
  onPatch: PatchFn;
}) {
  switch (question.type) {
    case "ordering":
      return <OrderingEditor question={question} onPatch={onPatch} />;
    case "fill_in_multiple_blanks":
      return <FillBlanksEditor question={question} onPatch={onPatch} />;
    case "calculated":
      return <CalculatedEditor question={question} onPatch={onPatch} />;
    case "likert":
      return <LikertEditor question={question} onPatch={onPatch} />;
    case "hotspot":
      return <HotspotEditor question={question} onPatch={onPatch} />;
    default:
      return null;
  }
}

/** Pieces for Feedback / Advanced disclosures in QuizQuestionsEditor. */
export function QuizPhase7QuestionOptions({
  question,
  onPatch,
  variant,
}: {
  question: QuizQuestion;
  onPatch: PatchFn;
  variant: "feedback" | "advanced";
}) {
  if (variant === "feedback") {
    if (question.type !== "multiple_choice" && question.type !== "multiple_answers") {
      return null;
    }
    return (
      <div className="space-y-3">
        {(question.choices ?? []).map((_choice, i) => (
          <label key={i} className="block text-sm">
            <span className="text-xs text-arc-mute">Feedback if student picks choice {i + 1}</span>
            <input
              value={question.choiceFeedbacks?.[i] ?? ""}
              onChange={(e) => {
                const next = [...(question.choiceFeedbacks ?? [])];
                while (next.length <= i) next.push("");
                next[i] = e.target.value;
                onPatch({ choiceFeedbacks: next });
              }}
              className="form-input mt-0.5"
              placeholder="Optional per-choice feedback"
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(question.extraCredit)}
          onChange={(e) => onPatch({ extraCredit: e.target.checked || undefined })}
        />
        Extra credit (bonus — does not increase quiz total)
      </label>
      {question.type === "essay" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(question.requireEssayComment)}
            onChange={(e) => onPatch({ requireEssayComment: e.target.checked || undefined })}
          />
          Require reflection comment before submit
        </label>
      )}
      {question.type === "numerical" && (
        <label className="block text-sm">
          <span className="font-medium text-arc-ink">Partial-credit band preset</span>
          <select
            value={question.numericalBandPreset ?? "exact"}
            onChange={(e) => {
              const preset = e.target.value as NumericalBandPreset;
              const bands = applyNumericalBandPreset(
                preset,
                typeof question.correctNumber === "number" ? question.correctNumber : 1,
              );
              onPatch({
                numericalBandPreset: preset,
                tolerance: bands.tolerance,
                partialTolerance: bands.partialTolerance,
                partialCredit: preset !== "exact" ? true : question.partialCredit,
              });
            }}
            className="form-input mt-1 max-w-xs"
          >
            {(Object.keys(NUMERICAL_BAND_PRESET_LABELS) as NumericalBandPreset[]).map((k) => (
              <option key={k} value={k}>
                {NUMERICAL_BAND_PRESET_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function OrderingEditor({ question, onPatch }: { question: QuizQuestion; onPatch: PatchFn }) {
  const items = question.orderingItems ?? [];
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-arc-mute">Correct order is the list below (top = first).</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <span className="mt-2 w-6 text-xs text-arc-mute">{i + 1}.</span>
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onPatch({ orderingItems: next, correctOrder: next.map((_, j) => j) });
            }}
            className="form-input flex-1"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-arc-copper hover:underline"
        onClick={() => {
          const next = [...items, `Item ${items.length + 1}`];
          onPatch({ orderingItems: next, correctOrder: next.map((_, j) => j) });
        }}
      >
        + Add item
      </button>
    </div>
  );
}

function FillBlanksEditor({ question, onPatch }: { question: QuizQuestion; onPatch: PatchFn }) {
  const blanks = question.fillBlanks ?? [];
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-arc-mute">Use {"{{blankId}}"} in the prompt for each blank.</p>
      {blanks.map((b, i) => (
        <div key={b.id} className="rounded border border-arc-ink/10 bg-arc-ivory p-2">
          <input
            value={b.id}
            onChange={(e) => {
              const next = blanks.map((x, j) => (j === i ? { ...x, id: e.target.value } : x));
              onPatch({ fillBlanks: next });
            }}
            className="form-input mb-1 text-xs"
            placeholder="blank id"
          />
          <input
            value={(b.acceptedAnswers ?? []).join(", ")}
            onChange={(e) => {
              const next = blanks.map((x, j) =>
                j === i
                  ? { ...x, acceptedAnswers: e.target.value.split(",").map((s) => s.trim()) }
                  : x,
              );
              onPatch({ fillBlanks: next });
            }}
            className="form-input text-sm"
            placeholder="Accepted answers, comma-separated"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-arc-copper hover:underline"
        onClick={() =>
          onPatch({
            fillBlanks: [
              ...blanks,
              { id: uid("fb"), acceptedAnswers: [""] },
            ],
          })
        }
      >
        + Add blank
      </button>
    </div>
  );
}

function CalculatedEditor({ question, onPatch }: { question: QuizQuestion; onPatch: PatchFn }) {
  const vars = question.calculatedVariables ?? [];
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-arc-mute">
        Use [varName] in the prompt and a formula referencing those names (e.g. x + y).
      </p>
      <label className="block text-sm">
        <span className="font-medium">Formula</span>
        <input
          value={question.calculatedFormula ?? ""}
          onChange={(e) => onPatch({ calculatedFormula: e.target.value })}
          className="form-input mt-1 font-mono text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Tolerance (±)</span>
        <input
          type="number"
          value={question.calculatedTolerance ?? 0}
          onChange={(e) => onPatch({ calculatedTolerance: Number(e.target.value) })}
          className="form-input mt-1 max-w-[8rem]"
        />
      </label>
      {vars.map((v, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input
            value={v.name}
            onChange={(e) => {
              const next = vars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x));
              onPatch({ calculatedVariables: next });
            }}
            className="form-input w-20"
            placeholder="name"
          />
          <input
            type="number"
            value={v.min}
            onChange={(e) => {
              const next = vars.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x));
              onPatch({ calculatedVariables: next });
            }}
            className="form-input w-20"
            placeholder="min"
          />
          <input
            type="number"
            value={v.max}
            onChange={(e) => {
              const next = vars.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x));
              onPatch({ calculatedVariables: next });
            }}
            className="form-input w-20"
            placeholder="max"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-arc-copper hover:underline"
        onClick={() =>
          onPatch({
            calculatedVariables: [...vars, { name: "z", min: 1, max: 10, decimals: 0 }],
          })
        }
      >
        + Add variable
      </button>
    </div>
  );
}

function LikertEditor({ question, onPatch }: { question: QuizQuestion; onPatch: PatchFn }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-sm">
        Min
        <input
          type="number"
          value={question.likertMin ?? 1}
          onChange={(e) => onPatch({ likertMin: Number(e.target.value) })}
          className="form-input mt-1"
        />
      </label>
      <label className="text-sm">
        Max
        <input
          type="number"
          value={question.likertMax ?? 5}
          onChange={(e) => onPatch({ likertMax: Number(e.target.value) })}
          className="form-input mt-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Min label
        <input
          value={question.likertMinLabel ?? ""}
          onChange={(e) => onPatch({ likertMinLabel: e.target.value })}
          className="form-input mt-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Max label
        <input
          value={question.likertMaxLabel ?? ""}
          onChange={(e) => onPatch({ likertMaxLabel: e.target.value })}
          className="form-input mt-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Correct value (optional — graded surveys)
        <input
          type="number"
          value={question.correctLikertValue ?? ""}
          onChange={(e) =>
            onPatch({
              correctLikertValue:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="form-input mt-1 max-w-[8rem]"
        />
      </label>
    </div>
  );
}

function HotspotEditor({ question, onPatch }: { question: QuizQuestion; onPatch: PatchFn }) {
  const regions = question.hotspotRegions ?? [];
  return (
    <div className="mt-3 space-y-3">
      <label className="block text-sm">
        <span className="font-medium">Image URL or data URL</span>
        <input
          value={question.hotspotImageUrl ?? ""}
          onChange={(e) => onPatch({ hotspotImageUrl: e.target.value })}
          className="form-input mt-1 font-mono text-xs"
          placeholder="https://… or data:image/png;base64,…"
        />
      </label>
      {regions.map((r, i) => (
        <div key={r.id} className="grid grid-cols-5 gap-1 text-xs">
          <input
            value={r.label ?? ""}
            placeholder="label"
            onChange={(e) => {
              const next = regions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
              onPatch({ hotspotRegions: next });
            }}
            className="form-input col-span-5"
          />
          {(["x", "y", "w", "h"] as const).map((k) => (
            <input
              key={k}
              type="number"
              value={r[k]}
              onChange={(e) => {
                const next = regions.map((x, j) =>
                  j === i ? { ...x, [k]: Number(e.target.value) } : x,
                );
                onPatch({ hotspotRegions: next });
              }}
              className="form-input"
              placeholder={k}
            />
          ))}
          <label className="col-span-5 flex items-center gap-1">
            <input
              type="checkbox"
              checked={(question.correctHotspotIds ?? []).includes(r.id)}
              onChange={(e) => {
                const set = new Set(question.correctHotspotIds ?? []);
                if (e.target.checked) set.add(r.id);
                else set.delete(r.id);
                onPatch({ correctHotspotIds: [...set] });
              }}
            />
            Correct region
          </label>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-arc-copper hover:underline"
        onClick={() =>
          onPatch({
            hotspotRegions: [
              ...regions,
              { id: uid("hs"), x: 10, y: 10, w: 20, h: 20, label: "Region" },
            ],
          })
        }
      >
        + Add region (% of image)
      </button>
    </div>
  );
}
