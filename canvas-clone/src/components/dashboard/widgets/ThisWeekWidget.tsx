import { mockDashboardEvents } from "../../../data/mockData";
import { resolveWeekEvents } from "../../../utils/dashboard";
import { useStudentView } from "../../../utils/studentView";

export default function ThisWeekWidget() {
  const { studentView } = useStudentView();
  const weekEvents = resolveWeekEvents(mockDashboardEvents);

  return (
    <div id="this-week" className="scroll-mt-8">
      {weekEvents.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing scheduled this week.</p>
      ) : (
        <div className="space-y-3">
          {weekEvents.map((event) => (
            <div key={`${event.courseId}-${event.dayOffset}-${event.label}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {event.dayLabel}
                </span>
                <div
                  className="mt-1 h-full w-0.5 flex-1 rounded-full opacity-40"
                  style={{ backgroundColor: event.courseColor }}
                />
              </div>
              <p className="pb-3 text-sm leading-snug text-gray-600 dark:text-gray-300">
                {studentView && event.type === "office"
                  ? "Study group"
                  : event.displayLabel}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
