import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  getUpcomingCalendarEvents,
  isBookedUpcomingAppointment,
} from "../../utils/calendarEvents";

export default function DeskRitualsWidget({ courseId }: { courseId: string }) {
  const items = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return getUpcomingCalendarEvents(12, courseId).filter((e) => {
      if (e.date > weekEnd) return false;
      if (e.type === "appointment") return isBookedUpcomingAppointment(e, now);
      return e.type === "assignment" || e.type === "quiz" || e.type === "todo" || e.type === "event";
    });
  }, [courseId]);

  return (
    <div className="border-b border-arc-ink/10 pb-5" data-tour="desk-rituals">
      <p className="kicker text-arc-copper">Studio hours</p>
      <h3 className="mt-1 font-display text-lg font-medium italic text-arc-ink">This week’s desk</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-arc-mute">Nothing on the desk this week.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((e) => (
            <li key={e.id}>
              <Link to={e.path} className="desk-link py-1">
                <span className="block truncate font-medium text-arc-ink">{e.title}</span>
                <span className="text-xs text-arc-mute">
                  {e.type === "appointment"
                    ? "Office hours · "
                    : e.type === "quiz"
                      ? "Quiz · "
                      : e.type === "todo"
                        ? "To-do · "
                        : ""}
                  {e.date.toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
