import { useRef } from "react";
import Icon from "../icons/Icon";
import CalendarCoursePip from "./CalendarCoursePip";
import {
  calendarEventDragPayload,
  readCalendarDragData,
  writeCalendarDragData,
} from "../utils/calendarDueReschedule";
import {
  appointmentChipLabel,
  calendarEventChipAppearance,
  formatEventTime,
  type CalendarEvent,
} from "../utils/calendarEvents";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

export function startOfWeek(anchor: Date, weekStartsOn: "sunday" | "monday") {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = weekStartsOn === "sunday" ? day : day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function atHour(day: Date, hour: number) {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export default function CalendarWeekDayGrid({
  view,
  anchor,
  weekStartsOn,
  events,
  canDragDue,
  onOpen,
  onCreateAt,
  onDropAt,
  onOpenDay,
}: {
  view: "week" | "day";
  anchor: Date;
  weekStartsOn: "sunday" | "monday";
  events: CalendarEvent[];
  canDragDue?: boolean;
  onOpen: (event: CalendarEvent) => void;
  onCreateAt: (startAt: number) => void;
  onDropAt?: (raw: string, startAt: number) => void;
  onOpenDay?: (day: Date) => void;
}) {
  const weekStart = startOfWeek(anchor, weekStartsOn);
  const days =
    view === "day"
      ? [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())]
      : Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          return d;
        });

  const eventsOn = (day: Date) =>
    events.filter(
      (e) =>
        e.date.getFullYear() === day.getFullYear() &&
        e.date.getMonth() === day.getMonth() &&
        e.date.getDate() === day.getDate(),
    );

  const dropOn = (day: Date, hour: number, raw?: string) => {
    if (!raw) {
      onCreateAt(atHour(day, hour));
      return;
    }
    onDropAt?.(raw, atHour(day, hour));
  };

  return (
    <div
      className={`calendar-print-grid h-full min-h-0 overflow-auto rounded-xl bg-arc-ivory ring-1 ring-arc-line/80 ${
        view === "week" ? "md:block" : ""
      }`}
    >
      <div
        className={`grid min-w-[640px] ${
          view === "day" ? "grid-cols-[3rem_1fr]" : "grid-cols-[3rem_repeat(7,1fr)]"
        } md:min-w-0 ${view === "week" ? "max-md:min-w-0 max-md:grid-cols-1" : ""}`}
      >
        <div className="hidden border-b border-arc-line/70 bg-arc-paper/60 md:block" />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onOpenDay?.(day)}
            className="border-b border-l border-arc-line/70 bg-arc-paper/60 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-arc-mute transition hover:bg-arc-copper/10 hover:text-arc-copper max-md:text-left"
          >
            {day.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </button>
        ))}
        {HOURS.map((hour) => (
          <HourRow
            key={hour}
            hour={hour}
            days={days}
            eventsOn={eventsOn}
            canDragDue={Boolean(canDragDue)}
            onOpen={onOpen}
            onDrop={dropOn}
          />
        ))}
      </div>
      {days.every((d) => eventsOn(d).length === 0) && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-arc-mute">
            {view === "day"
              ? "No events this day. Click an hour to add one."
              : "No events this week. Click an hour to add one."}
          </p>
          <button
            type="button"
            onClick={() => onCreateAt(atHour(days[0], 9))}
            className="mt-2 text-sm font-medium text-arc-copper hover:underline"
          >
            Add an event
          </button>
        </div>
      )}
    </div>
  );
}

function isDraggable(event: CalendarEvent, canDragDue: boolean) {
  if (!canDragDue) return false;
  return Boolean(calendarEventDragPayload(event));
}

function HourRow({
  hour,
  days,
  eventsOn,
  canDragDue,
  onOpen,
  onDrop,
}: {
  hour: number;
  days: Date[];
  eventsOn: (day: Date) => CalendarEvent[];
  canDragDue: boolean;
  onOpen: (event: CalendarEvent) => void;
  onDrop: (day: Date, hour: number, raw?: string) => void;
}) {
  const skipClick = useRef(false);
  const label = new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
    hour: "numeric",
  });
  return (
    <>
      <div className="hidden border-b border-arc-line/40 px-1 py-2 text-right text-[10px] text-arc-mute md:block">
        {label}
      </div>
      {days.map((day) => {
        const cellEvents = eventsOn(day).filter((e) =>
          e.allDay ? hour === 8 : e.date.getHours() === hour,
        );
        return (
          <div
            key={`${day.toDateString()}-${hour}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              onDrop(day, hour);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDrop(day, hour);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const raw = readCalendarDragData(e.dataTransfer);
              if (raw) {
                skipClick.current = true;
                onDrop(day, hour, raw);
              }
            }}
            className="min-h-[44px] cursor-pointer border-b border-l border-arc-line/40 p-1 text-left hover:bg-arc-copper/10"
          >
            <span className="mb-0.5 block text-[10px] text-arc-mute md:hidden">{label}</span>
            {cellEvents.map((ev) => {
              const draggable = isDraggable(ev, canDragDue);
              const chip = calendarEventChipAppearance(ev);
              return (
                <div
                  key={ev.id}
                  draggable={draggable}
                  data-slot-state={
                    ev.type === "appointment" ? (chip.unbooked ? "open" : "booked") : undefined
                  }
                  onDragStart={(e) => {
                    const payload = calendarEventDragPayload(ev);
                    if (!payload) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    writeCalendarDragData(e.dataTransfer, payload);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(ev);
                  }}
                  className={`mb-0.5 flex items-center gap-0.5 truncate px-1 py-0.5 text-[10px] ${chip.className}`}
                  style={{ ...chip.style, cursor: draggable ? "grab" : "pointer" }}
                >
                  <CalendarCoursePip
                    color={chip.courseColor}
                    onTypeFill={!chip.unbooked}
                    title={ev.courseShortName}
                  />
                  {ev.type === "appointment" && (
                    <Icon name="clock" size={10} className="shrink-0 opacity-90" />
                  )}
                  <span className="truncate">
                    {formatEventTime(ev) ? `${formatEventTime(ev)} · ` : ""}
                    {appointmentChipLabel(ev)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
