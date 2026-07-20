import { Link } from "react-router-dom";
import { getUpcomingDeadlines } from "../../../utils/deadlines";
import { useStudentView } from "../../../utils/studentView";

export default function ThisWeekWidget() {
  const { studentView } = useStudentView();
  const weekEvents = getUpcomingDeadlines("week");

  return (
    <div id="this-week" className="scroll-mt-8">
      {weekEvents.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing scheduled this week.</p>
      ) : (
        <div className="space-y-3">
          {weekEvents.map((event) => (
            <div key={`${event.courseId}-${event.path}-${event.label}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {event.dayLabel}
                </span>
                <div
                  className="mt-1 h-full w-0.5 flex-1 rounded-full opacity-40"
                  style={{ backgroundColor: event.courseColor }}
                />
              </div>
              <Link
                to={event.path ?? `/courses/${event.courseId}`}
                className="pb-3 text-sm leading-snug text-gray-600 hover:text-canvas-blue"
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
