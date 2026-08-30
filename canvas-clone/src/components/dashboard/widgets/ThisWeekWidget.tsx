import { Link } from "react-router-dom";
import { getUpcomingDeadlines } from "../../../utils/deadlines";
import { useStudentView } from "../../../utils/studentView";

export default function ThisWeekWidget() {
  const { studentView } = useStudentView();
  const weekEvents = getUpcomingDeadlines("week");

  return (
    <div id="this-week" className="scroll-mt-8">
      {weekEvents.length === 0 ? (
        <p className="text-sm text-arc-mute">Nothing scheduled this week.</p>
      ) : (
        <div>
          {weekEvents.map((event) => (
            <div key={`${event.courseId}-${event.path}-${event.label}`} className="flex gap-3">
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span className="font-display text-[11px] italic text-arc-mute">
                  {event.dayLabel}
                </span>
                <div
                  className="mt-1 w-px flex-1 opacity-50"
                  style={{ backgroundColor: event.courseColor }}
                />
              </div>
              <Link
                to={event.path ?? `/courses/${event.courseId}`}
                className="desk-link pb-3 pt-0 leading-snug"
              >
                {studentView ? event.displayLabel : event.displayLabel}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
