import { Link } from "react-router-dom";
import { getItemsNeedingGrading } from "../../utils/gradingCounts";

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-sm font-semibold text-canvas-grayDark">{title}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

const KIND_LABEL: Record<"assignment" | "quiz" | "discussion", string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  discussion: "Discussion",
};

export default function NeedsGradingWidget({ courseId }: { courseId: string }) {
  const items = getItemsNeedingGrading(courseId);

  return (
    <WidgetCard title="Needs Grading">
      {items.length === 0 ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          All caught up — no submissions awaiting grade.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.kind}:${item.itemId}`}>
              <Link
                to={item.gradePath}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-canvas-grayLight"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-canvas-grayDark">
                    {item.title}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-gray-400">
                    {KIND_LABEL[item.kind]}
                  </span>
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-canvas-red/10 px-2 py-0.5 text-xs font-semibold text-canvas-red">
                  {item.pendingCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`/courses/${courseId}/grades`}
        className="mt-3 inline-block text-sm text-canvas-blue hover:underline"
      >
        View gradebook →
      </Link>
    </WidgetCard>
  );
}
