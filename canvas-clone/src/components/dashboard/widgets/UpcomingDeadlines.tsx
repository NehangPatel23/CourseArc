import { Link } from "react-router-dom";
import { getUpcomingDeadlines } from "../../../utils/deadlines";
import { StatusAlertBanner } from "../../ui/StatusAlert";

export default function UpcomingDeadlines() {
  const items = getUpcomingDeadlines("all").slice(0, 8);

  if (!items.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm">No upcoming deadlines</p>
      </StatusAlertBanner>
    );
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.path ?? `${item.courseId}-${item.label}-${item.date.getTime()}`}>
          <StatusAlertBanner tone={item.overdue ? "negative" : "neutral"} className="mb-2">
            {item.path ? (
              <Link to={item.path} className="block text-sm hover:underline">
                {item.displayLabel}
              </Link>
            ) : (
              <p className="text-sm">{item.displayLabel}</p>
            )}
            <span className="block text-[11px] opacity-70">
              {item.type === "office"
                ? item.dayLabel
                : item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </StatusAlertBanner>
        </li>
      ))}
    </ul>
  );
}
