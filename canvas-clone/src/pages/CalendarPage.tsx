import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mockDashboardEvents } from "../data/mockData";
import { getUpcomingDeadlines } from "../utils/deadlines";
import { loadCourses } from "../utils/coursesStore";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const courses = loadCourses();
  const deadlines = getUpcomingDeadlines("all");

  const days = daysInMonth(month);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const eventsByDay = useMemo(() => {
    const map = new Map<number, typeof deadlines>();
    for (const e of deadlines) {
      if (
        e.date.getMonth() === month.getMonth() &&
        e.date.getFullYear() === month.getFullYear()
      ) {
        const day = e.date.getDate();
        const list = map.get(day) ?? [];
        list.push(e);
        map.set(day, list);
      }
    }
    for (const ev of mockDashboardEvents) {
      const weekStart = new Date();
      const d = new Date(weekStart);
      d.setDate(d.getDate() + ev.dayOffset);
      if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
        const day = d.getDate();
        const list = map.get(day) ?? [];
        const course = courses.find((c) => c.id === ev.courseId);
        list.push({
          courseId: ev.courseId,
          dayOffset: ev.dayOffset,
          label: ev.label,
          type: ev.type,
          date: d,
          dayLabel: "",
          courseColor: course?.color ?? "canvas-blue",
          courseShortName: course?.short_name ?? "",
          displayLabel: course ? `${course.short_name} — ${ev.label}` : ev.label,
          overdue: false,
          course,
        });
        map.set(day, list);
      }
    }
    return map;
  }, [month, deadlines, courses]);

  const prevMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-canvas-grayDark">Calendar</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100">
            ←
          </button>
          <span className="min-w-[160px] text-center font-medium">
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button type="button" onClick={nextMonth} className="rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100">
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white p-4 ring-1 ring-canvas-border/80">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase text-gray-400">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const events = eventsByDay.get(day) ?? [];
          return (
            <div
              key={day}
              className="min-h-[80px] rounded-lg border border-canvas-border/40 p-1.5"
            >
              <span className="text-xs font-medium text-gray-500">{day}</span>
              <div className="mt-1 space-y-0.5">
                {events.slice(0, 2).map((e) => (
                  <Link
                    key={`${e.courseId}-${e.label}`}
                    to={`/courses/${e.courseId}`}
                    className="block truncate rounded px-1 py-0.5 text-[10px] text-white"
                    style={{ backgroundColor: e.courseColor }}
                    title={e.displayLabel}
                  >
                    {e.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
