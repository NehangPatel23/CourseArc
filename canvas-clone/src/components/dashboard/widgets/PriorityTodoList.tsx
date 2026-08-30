import { Link } from "react-router-dom";
import { getOverdueItems, getUpcomingDeadlines } from "../../../utils/deadlines";
import { StatusAlertBanner } from "../../ui/StatusAlert";

export default function PriorityTodoList({ studentView }: { studentView: boolean }) {
  if (!studentView) {
    return <p className="text-sm text-arc-mute">Switch to student view for your to-do list.</p>;
  }

  const overdue = getOverdueItems();
  const upcoming = getUpcomingDeadlines("all").filter(
    (e) => !e.overdue && (e.type === "due" || e.type === "office"),
  );

  if (!overdue.length && !upcoming.length) {
    return (
      <div className="space-y-3">
        <StatusAlertBanner tone="positive">
          <p className="text-sm">All caught up</p>
        </StatusAlertBanner>
        <Link to="/planner" className="text-sm text-arc-copper hover:underline">
          Open Planner
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {overdue.map((item) => (
          <li key={`overdue-${item.courseId}-${item.label}`}>
            <StatusAlertBanner tone="negative">
              <Link to={item.path ?? "/calendar"} className="text-sm font-medium hover:underline">
                {item.displayLabel}
              </Link>
            </StatusAlertBanner>
          </li>
        ))}
        {upcoming.slice(0, 5).map((item) => (
          <li key={`due-${item.path ?? `${item.courseId}-${item.label}-${item.date.getTime()}`}`}>
            <StatusAlertBanner tone="neutral">
              <Link to={item.path ?? "/planner"} className="text-sm hover:underline">
                {item.displayLabel}
              </Link>
              <span className="block text-[11px] opacity-70">{item.dayLabel}</span>
            </StatusAlertBanner>
          </li>
        ))}
      </ul>
      <Link to="/planner" className="text-sm text-arc-copper hover:underline">
        Open Planner
      </Link>
    </div>
  );
}
