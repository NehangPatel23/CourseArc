import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  List,
  Megaphone,
  CheckSquare,
} from "lucide-react";
import AppEmptyState from "../components/AppEmptyState";
import { useUser } from "../hooks/useUser";
import {
  CALENDAR_TYPE_META,
  formatEventTime,
  getCalendarEventsForMonth,
  getUpcomingCalendarEvents,
  isCalendarEventOverdue,
  isSameDay,
  type CalendarEvent,
  type CalendarEventType,
} from "../utils/calendarEvents";
import { loadCourses } from "../utils/coursesStore";

type ViewMode = "month" | "agenda";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function TypeIcon({ type, className = "h-3.5 w-3.5" }: { type: CalendarEventType; className?: string }) {
  if (type === "quiz") return <HelpCircle className={className} />;
  if (type === "announcement") return <Megaphone className={className} />;
  if (type === "todo") return <CheckSquare className={className} />;
  return <ClipboardList className={className} />;
}

function EventChip({
  event,
  compact = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
}) {
  const time = formatEventTime(event);
  return (
    <Link
      to={event.path}
      className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-white transition hover:brightness-110 ${
        compact ? "text-[10px] leading-tight" : "text-xs"
      }`}
      style={{ backgroundColor: event.color }}
      title={`${event.courseShortName} — ${event.title}${time ? ` · ${time}` : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <TypeIcon type={event.type} className={compact ? "h-2.5 w-2.5 shrink-0 opacity-90" : "h-3 w-3 shrink-0 opacity-90"} />
      <span className="truncate">{event.title}</span>
    </Link>
  );
}

function EventRow({ event, now }: { event: CalendarEvent; now: Date }) {
  const time = formatEventTime(event);
  const overdue = isCalendarEventOverdue(event, now);
  const meta = CALENDAR_TYPE_META[event.type];

  return (
    <Link
      to={event.path}
      className="flex items-start gap-3 rounded-xl border border-canvas-border/70 bg-white px-3 py-3 transition hover:border-canvas-blue/40 hover:bg-canvas-blueTint/30"
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: event.color }}
      >
        <TypeIcon type={event.type} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-canvas-grayDark">{event.title}</p>
          {overdue && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
              Overdue
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          <span className="font-medium" style={{ color: event.color }}>
            {event.courseShortName}
          </span>
          {" · "}
          {meta.short}
          {time ? ` · ${time}` : ""}
        </p>
      </div>
    </Link>
  );
}

export default function CalendarPage() {
  const user = useUser();
  const now = useMemo(() => new Date(), [user.id]);
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [view, setView] = useState<ViewMode>("month");
  const [courseFilter, setCourseFilter] = useState<string | "all">("all");
  const [typeFilters, setTypeFilters] = useState<Set<CalendarEventType>>(
    () => new Set(["assignment", "quiz", "announcement", "todo"]),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(() =>
    isSameDay(now, month) ? now.getDate() : null,
  );

  const courses = useMemo(
    () => loadCourses().filter((c) => c.published && !c.archived),
    [user.id],
  );

  const days = daysInMonth(month);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const eventsByDay = useMemo(() => {
    const raw = getCalendarEventsForMonth(month, courseFilter, now);
    const filtered = new Map<number, CalendarEvent[]>();
    for (const [day, list] of raw) {
      const next = list.filter((e) => typeFilters.has(e.type));
      if (next.length) filtered.set(day, next);
    }
    return filtered;
  }, [month, courseFilter, typeFilters, now, user.id]);

  const monthEvents = useMemo(() => {
    const all: CalendarEvent[] = [];
    for (const list of eventsByDay.values()) all.push(...list);
    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDay]);

  const upcoming = useMemo(() => {
    return getUpcomingCalendarEvents(10, courseFilter, now).filter((e) =>
      typeFilters.has(e.type),
    );
  }, [courseFilter, typeFilters, now, user.id]);

  const selectedEvents =
    selectedDay != null ? (eventsByDay.get(selectedDay) ?? []) : [];

  const viewingCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  const goToday = () => {
    const m = startOfMonth(now);
    setMonth(m);
    setSelectedDay(now.getDate());
    setView("month");
  };

  const prevMonth = () => {
    const next = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    setMonth(next);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    setMonth(next);
    setSelectedDay(null);
  };

  const toggleType = (type: CalendarEventType) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="min-h-full bg-canvas-grayLight">
      <div className="w-full px-6 py-8 lg:px-10">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-canvas-grayDark">Calendar</h1>
            <p className="mt-1 text-sm text-gray-600">
              Due dates, quizzes, announcements, and to-dos across your courses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-canvas-border bg-white px-3 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
            >
              Today
            </button>
            <div className="flex items-center rounded-lg border border-canvas-border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === "month"
                    ? "bg-canvas-blue text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("agenda")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === "agenda"
                    ? "bg-canvas-blue text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <List className="h-4 w-4" />
                Agenda
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-canvas-border bg-white px-1 py-0.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="rounded-md p-2 text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[9.5rem] text-center text-sm font-semibold text-canvas-grayDark">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="rounded-md p-2 text-gray-600 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-canvas-border/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Course
            </span>
            <button
              type="button"
              onClick={() => setCourseFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                courseFilter === "all"
                  ? "bg-canvas-grayDark text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All courses
            </button>
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  courseFilter === c.id
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={
                  courseFilter === c.id
                    ? { backgroundColor: c.color }
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: courseFilter === c.id ? "#fff" : c.color }}
                />
                {c.short_name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Show
            </span>
            {(Object.keys(CALENDAR_TYPE_META) as CalendarEventType[]).map((type) => {
              const meta = CALENDAR_TYPE_META[type];
              const on = typeFilters.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "text-white"
                      : "bg-gray-100 text-gray-500 line-through decoration-gray-400"
                  }`}
                  style={on ? { backgroundColor: meta.accent } : undefined}
                >
                  <TypeIcon type={type} className="h-3 w-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {view === "month" ? (
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-canvas-border/80">
                <div className="grid grid-cols-7 border-b border-canvas-border/70 bg-canvas-grayLight/60">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div
                      key={d}
                      className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr">
                  {Array.from({ length: offset }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="min-h-[96px] border-b border-r border-canvas-border/40 bg-gray-50/40"
                    />
                  ))}
                  {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const events = eventsByDay.get(day) ?? [];
                    const cellDate = new Date(month.getFullYear(), month.getMonth(), day);
                    const isToday = isSameDay(cellDate, now);
                    const isSelected = selectedDay === day;
                    const col = (offset + i) % 7;
                    const isWeekend = col >= 5;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`min-h-[96px] border-b border-r border-canvas-border/40 p-1.5 text-left transition ${
                          isSelected
                            ? "bg-canvas-blueTint ring-2 ring-inset ring-canvas-blue/40"
                            : isWeekend
                              ? "bg-gray-50/50 hover:bg-canvas-blueTint/40"
                              : "hover:bg-canvas-blueTint/40"
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-canvas-blue text-white"
                              : isSelected
                                ? "text-canvas-blue"
                                : "text-gray-500"
                          }`}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {events.slice(0, 3).map((e) => (
                            <EventChip key={e.id} event={e} compact />
                          ))}
                          {events.length > 3 && (
                            <span className="block px-1 text-[10px] font-medium text-gray-400">
                              +{events.length - 3} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80">
                <h2 className="mb-4 text-sm font-semibold text-canvas-grayDark">
                  Agenda · {monthLabel}
                </h2>
                {monthEvents.length === 0 ? (
                  <AppEmptyState
                    variant="calendar"
                    title="Nothing scheduled this month"
                    subtitle="Try another month, or turn on more event types above."
                    compact
                  />
                ) : (
                  <div className="space-y-6">
                    {Array.from(eventsByDay.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([day, list]) => {
                        const date = new Date(month.getFullYear(), month.getMonth(), day);
                        const isToday = isSameDay(date, now);
                        return (
                          <div key={day}>
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold ${
                                  isToday ? "text-canvas-blue" : "text-canvas-grayDark"
                                }`}
                              >
                                {date.toLocaleDateString("en-US", {
                                  weekday: "long",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              {isToday && (
                                <span className="rounded-full bg-canvas-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-canvas-blue">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {list.map((e) => (
                                <EventRow key={e.id} event={e} now={now} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side panel */}
          <aside className="space-y-4">
            {view === "month" && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-canvas-border/80">
                <h2 className="text-sm font-semibold text-canvas-grayDark">
                  {selectedDay != null
                    ? new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        selectedDay,
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : "Select a day"}
                </h2>
                {selectedDay == null ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Click a date on the calendar to see everything due that day.
                  </p>
                ) : selectedEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No events on this day.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedEvents.map((e) => (
                      <EventRow key={e.id} event={e} now={now} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-white p-4 ring-1 ring-canvas-border/80">
              <h2 className="text-sm font-semibold text-canvas-grayDark">Coming up</h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No upcoming items match your filters.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <Link
                        to={e.path}
                        className="block rounded-lg border border-transparent px-2 py-2 hover:border-canvas-border hover:bg-canvas-grayLight"
                      >
                        <p className="text-xs font-medium text-gray-400">
                          {e.date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {formatEventTime(e) ? ` · ${formatEventTime(e)}` : ""}
                        </p>
                        <p className="truncate text-sm font-medium text-canvas-grayDark">
                          {e.title}
                        </p>
                        <p className="truncate text-xs" style={{ color: e.color }}>
                          {e.courseShortName}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!viewingCurrentMonth && (
                <button
                  type="button"
                  onClick={goToday}
                  className="mt-3 text-xs font-medium text-canvas-blue hover:underline"
                >
                  Jump to today
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-canvas-border/80">
              <h2 className="mb-2 text-sm font-semibold text-canvas-grayDark">Legend</h2>
              <ul className="space-y-1.5 text-xs text-gray-600">
                {(Object.keys(CALENDAR_TYPE_META) as CalendarEventType[]).map((type) => (
                  <li key={type} className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: CALENDAR_TYPE_META[type].accent }}
                    >
                      <TypeIcon type={type} className="h-3.5 w-3.5" />
                    </span>
                    {CALENDAR_TYPE_META[type].label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-snug text-gray-400">
                Event colors match each course. Click an event to open it.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
