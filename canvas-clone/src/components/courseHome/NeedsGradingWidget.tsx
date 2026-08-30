import { Link } from "react-router-dom";
import { getItemsNeedingGrading } from "../../utils/gradingCounts";

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-arc-ink/10 pb-5">
      <h3 className="font-display text-lg font-medium italic text-arc-ink">{title}</h3>
      <div className="mt-3">{children}</div>
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
        <p className="border border-arc-sage/30 bg-arc-sage/10 px-3 py-2 text-sm text-arc-sage">
          All caught up — no submissions awaiting grade.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.kind}:${item.itemId}`}>
              <Link
                to={item.gradePath}
                className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-arc-paper"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-arc-ink">
                    {item.title}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-arc-mute">
                    {KIND_LABEL[item.kind]}
                  </span>
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-arc-brick/10 px-2 py-0.5 text-xs font-semibold text-arc-brick">
                  {item.pendingCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`/courses/${courseId}/grades`}
        className="mt-3 inline-block text-sm text-arc-copper hover:underline"
      >
        View gradebook →
      </Link>
    </WidgetCard>
  );
}
