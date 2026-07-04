import { getOverdueItems, getUpcomingDeadlines } from "../../../utils/deadlines";
import { StatusAlertBanner } from "../../ui/StatusAlert";

export default function PriorityTodoList({ studentView }: { studentView: boolean }) {
  if (!studentView) {
    return <p className="text-sm text-gray-500">Switch to student view for your to-do list.</p>;
  }

  const overdue = getOverdueItems();
  const upcoming = getUpcomingDeadlines("all").filter((e) => !e.overdue && e.type === "due");

  if (!overdue.length && !upcoming.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm font-medium">All caught up!</p>
      </StatusAlertBanner>
    );
  }

  return (
    <ul className="space-y-2">
      {overdue.map((item) => (
        <li key={`overdue-${item.courseId}-${item.label}`}>
          <StatusAlertBanner tone="negative">
            <p className="text-sm font-medium">{item.displayLabel}</p>
          </StatusAlertBanner>
        </li>
      ))}
      {upcoming.slice(0, 5).map((item) => (
        <li key={`due-${item.courseId}-${item.label}`}>
          <StatusAlertBanner tone="neutral">
            <p className="text-sm">{item.displayLabel}</p>
            <span className="text-xs opacity-70">{item.dayLabel}</span>
          </StatusAlertBanner>
        </li>
      ))}
    </ul>
  );
}
