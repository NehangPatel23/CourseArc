import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  HelpCircle,
  MapPin,
  Megaphone,
  Plus,
} from "lucide-react";
import CanvasModal from "./CanvasModal";
import CalendarCoursePip from "./CalendarCoursePip";
import {
  CALENDAR_TYPE_META,
  calendarEventTypeColor,
  formatEventTime,
  getCalendarEventStudentBadge,
  isUnbookedAppointment,
  type CalendarEvent,
  type CalendarEventType,
} from "../utils/calendarEvents";
import { htmlPreview } from "../utils/htmlPreview";

const TYPE_ORDER: CalendarEventType[] = [
  "assignment",
  "quiz",
  "discussion",
  "todo",
  "event",
  "appointment",
  "announcement",
];

function TypeIcon({ type, className = "h-4 w-4" }: { type: CalendarEventType; className?: string }) {
  if (type === "quiz") return <HelpCircle className={className} />;
  if (type === "announcement") return <Megaphone className={className} />;
  if (type === "todo") return <CheckSquare className={className} />;
  if (type === "event") return <CalendarDays className={className} />;
  if (type === "appointment") return <CalendarClock className={className} />;
  return <ClipboardList className={className} />;
}

function timeLane(event: CalendarEvent) {
  const time = formatEventTime(event);
  if (time) return time;
  if (event.allDay) return "All day";
  if (event.type === "assignment" || event.type === "quiz" || event.type === "discussion") {
    return "Due";
  }
  if (event.type === "todo") return "To-do";
  return "Anytime";
}

function groupByLane(events: CalendarEvent[]) {
  const lanes: { label: string; events: CalendarEvent[] }[] = [];
  const index = new Map<string, number>();
  for (const event of events) {
    const label = timeLane(event);
    const i = index.get(label);
    if (i == null) {
      index.set(label, lanes.length);
      lanes.push({ label, events: [event] });
    } else {
      lanes[i].events.push(event);
    }
  }
  return lanes;
}

export default function CalendarDayDetailModal({
  date,
  events,
  now,
  studentId,
  studentView,
  onClose,
  onOpenEvent,
  onAddEvent,
  onViewDay,
}: {
  date: Date;
  events: CalendarEvent[];
  now: Date;
  studentId: string;
  studentView: boolean;
  onClose: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onAddEvent: () => void;
  onViewDay: () => void;
}) {
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const title = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
  const lanes = groupByLane(sorted);
  const typeCounts = TYPE_ORDER.map((type) => ({
    type,
    count: sorted.filter((e) => e.type === type).length,
  })).filter((row) => row.count > 0);
  const dueCount = sorted.filter((e) =>
    e.type === "assignment" || e.type === "quiz" || e.type === "discussion",
  ).length;

  return (
    <CanvasModal
      title={title}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAddEvent}
              className="btn-canvas-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add event
            </button>
            <button type="button" onClick={onViewDay} className="btn-canvas-secondary px-3 py-1.5 text-sm">
              Open day view
            </button>
          </div>
          <button type="button" onClick={onClose} className="btn-canvas-secondary px-3 py-1.5 text-sm">
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-canvas-blueTint via-white to-slate-50 px-4 py-4 ring-1 ring-canvas-blue/15">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {sorted.length === 0
                ? "Nothing on the calendar"
                : `${sorted.length} item${sorted.length === 1 ? "" : "s"}`}
              {dueCount > 0 ? ` · ${dueCount} due` : ""}
            </p>
            {isToday && (
              <span className="rounded-full bg-canvas-blue px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Today
              </span>
            )}
          </div>
          {typeCounts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {typeCounts.map(({ type, count }) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200/80"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CALENDAR_TYPE_META[type].accent }} />
                  {CALENDAR_TYPE_META[type].label} · {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-sm font-medium text-canvas-grayDark">A clear day</p>
            <p className="mt-1 text-sm text-gray-500">
              Add an event, or turn on more calendar types in the filters.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {lanes.map((lane) => (
              <li key={lane.label} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3">
                <p className="pt-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {lane.label}
                </p>
                <ul className="space-y-2 border-l border-gray-100 pl-3">
                  {lane.events.map((event) => (
                    <DayEventCard
                      key={event.id}
                      event={event}
                      now={now}
                      studentId={studentId}
                      studentView={studentView}
                      onOpen={onOpenEvent}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </CanvasModal>
  );
}

function DayEventCard({
  event,
  now,
  studentId,
  studentView,
  onOpen,
}: {
  event: CalendarEvent;
  now: Date;
  studentId: string;
  studentView: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  const meta = CALENDAR_TYPE_META[event.type];
  const badge = studentView
    ? getCalendarEventStudentBadge(event, studentId, now, { hideUnpostedScores: true })
    : null;
  const openSlot = isUnbookedAppointment(event);
  const details = htmlPreview(event.description, 140).text;
  const typeColor = calendarEventTypeColor(event);
  const className = `flex w-full items-start gap-3 rounded-xl border border-l-[3px] bg-white p-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md ${
    openSlot ? "border-dashed border-canvas-border/80" : "border-gray-100 hover:border-canvas-blue/30"
  }`;
  const body = (
    <>
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          openSlot ? "border-2 border-dashed opacity-80" : "text-white"
        }`}
        style={
          openSlot
            ? { borderColor: typeColor, color: typeColor, backgroundColor: `${typeColor}14` }
            : { backgroundColor: typeColor }
        }
      >
        <TypeIcon type={event.type} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-canvas-grayDark">{event.title}</p>
          {badge?.kind === "overdue" && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
              Overdue
            </span>
          )}
          {studentView && badge?.kind === "score" && (
            <span className="rounded-full bg-canvas-blueTint px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-canvas-blue">
              {badge.label}
            </span>
          )}
          {studentView && badge?.kind === "submitted" && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Submitted
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarCoursePip color={event.color} className="h-2 w-2" title={event.courseShortName} />
          <span className="font-medium" style={{ color: event.color }}>
            {event.courseShortName}
          </span>
          {" · "}
          {meta.label}
        </p>
        {event.location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />
            {event.location}
          </p>
        )}
        {details && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{details}</p>}
      </div>
    </>
  );

  if (event.customEventId || event.appointmentGroupId) {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        className={className}
        style={{ borderLeftColor: event.color }}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      to={event.path}
      className={className}
      onClick={() => onOpen(event)}
      style={{ borderLeftColor: event.color }}
    >
      {body}
    </Link>
  );
}
