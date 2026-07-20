export type QuizStatsView = "overview" | "questions" | "attempts";

const TABS: { id: QuizStatsView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "questions", label: "Questions" },
  { id: "attempts", label: "Attempts" },
];

export default function QuizStatsTabBar({
  active,
  onChange,
  questionCount,
  attemptCount,
}: {
  active: QuizStatsView;
  onChange: (view: QuizStatsView) => void;
  questionCount: number;
  attemptCount: number;
}) {
  const counts: Record<QuizStatsView, number | undefined> = {
    overview: undefined,
    questions: questionCount,
    attempts: attemptCount,
  };

  return (
    <div className="flex border-b border-gray-200 text-sm">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 transition-colors ${
            active === tab.id
              ? "border-canvas-blue font-medium text-canvas-blue"
              : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700"
          }`}
        >
          {tab.label}
          {counts[tab.id] != null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                active === tab.id
                  ? "bg-canvas-blue/10 text-canvas-blue"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function isQuizStatsView(value: string | null): value is QuizStatsView {
  return value === "overview" || value === "questions" || value === "attempts";
}
