import { getUpcomingDeadlines } from "../../../utils/deadlines";
import { StatusAlertBanner } from "../../ui/StatusAlert";

export default function UpcomingDeadlines() {
  const items = getUpcomingDeadlines("all").slice(0, 8);

  if (!items.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm font-medium">No upcoming deadlines</p>
      </StatusAlertBanner>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.courseId}-${item.label}`}>
          <StatusAlertBanner tone={item.overdue ? "negative" : "neutral"}>
            <p className="text-sm">{item.displayLabel}</p>
            <span className="text-xs opacity-70">
              {item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </StatusAlertBanner>
        </li>
      ))}
    </ul>
  );
}
