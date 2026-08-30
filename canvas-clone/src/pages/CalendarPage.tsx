import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import AppEmptyState from "../components/AppEmptyState";
import AppointmentGroupModal from "../components/AppointmentGroupModal";
import AppointmentSchedulePanel from "../components/AppointmentSchedulePanel";
import AppointmentSlotModal from "../components/AppointmentSlotModal";
import CalendarDayDetailModal from "../components/CalendarDayDetailModal";
import CalendarEventModal from "../components/CalendarEventModal";
import CalendarCoursePip from "../components/CalendarCoursePip";
import CalendarPrintSheet from "../components/CalendarPrintSheet";
import CalendarWeekDayGrid, { startOfWeek } from "../components/CalendarWeekDayGrid";
import DateTimeField from "../components/DateTimeField";
import FindAppointmentModal from "../components/FindAppointmentModal";
import { useUser } from "../hooks/useUser";
import { useSettings } from "../hooks/useSettings";
import { APPOINTMENT_GROUPS_CHANGED_EVENT, loadAppointmentGroups } from "../utils/appointmentGroups";
import {
  CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT,
  getCustomCalendarEvent,
  PERSONAL_CALENDAR_ID,
} from "../utils/calendarCustomEvents";
import {
  CALENDAR_TYPE_META,
  formatEventTime,
  getCalendarEventStudentBadge,
  getCalendarEvents,
  getCalendarEventsForMonth,
  getUpcomingCalendarEvents,
  isSameDay,
  isUnbookedAppointment,
  appointmentChipLabel,
  calendarEventChipAppearance,
  calendarEventTypeColor,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarFilterId,
} from "../utils/calendarEvents";
import {
  applyCalendarDrop,
  calendarEventDragPayload,
  readCalendarDragData,
  writeCalendarDragData,
} from "../utils/calendarDueReschedule";
import { DUE_DATE_OVERRIDES_CHANGED_EVENT } from "../utils/dueDateOverrides";
import { loadCourses } from "../utils/coursesStore";
import { downloadPlannerIcs } from "../utils/plannerIcs";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";

type ViewMode = "month" | "agenda" | "week" | "day";

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

const toolBtn =
  "inline-flex h-9 items-center gap-1.5 border border-arc-line bg-arc-ivory px-3 text-sm font-medium text-arc-ink hover:bg-arc-paper";
const toolBtnIcon =
  "inline-flex h-9 w-9 items-center justify-center border border-arc-line bg-arc-ivory text-arc-mute hover:bg-arc-paper";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function typeIconName(type: CalendarEventType): IconName {
  if (type === "quiz") return "help";
  if (type === "announcement") return "megaphone";
  if (type === "todo") return "checkSquare";
  if (type === "event") return "calendar";
  if (type === "appointment") return "clock";
  return "clipboard";
}

function TypeIcon({ type, className = "h-3.5 w-3.5" }: { type: CalendarEventType; className?: string }) {
  return <Icon name={typeIconName(type)} className={className} size={14} />;
}

function EventChip({
  event,
  compact = false,
  onOpen,
  canDrag = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onOpen: (event: CalendarEvent) => void;
  canDrag?: boolean;
}) {
  const time = formatEventTime(event);
  const payload = canDrag ? calendarEventDragPayload(event) : null;
  const chip = calendarEventChipAppearance(event);
  const className = `flex items-center gap-1 truncate px-1.5 py-0.5 transition ${
    compact ? "text-[10px] leading-tight" : "text-xs"
  } ${chip.className}`;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(payload)}
      data-slot-state={
        event.type === "appointment" ? (chip.unbooked ? "open" : "booked") : undefined
      }
      className={`${className} w-full cursor-pointer text-left`}
      style={{ ...chip.style, cursor: payload ? "grab" : "pointer" }}
      title={`${event.courseShortName} — ${appointmentChipLabel(event)}${time ? ` · ${time}` : ""}`}
      onDragStart={(e) => {
        if (!payload) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        writeCalendarDragData(e.dataTransfer, payload);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen(event);
        }
      }}
    >
      <CalendarCoursePip
        color={chip.courseColor}
        onTypeFill={!chip.unbooked}
        title={event.courseShortName}
      />
      <TypeIcon type={event.type} className={compact ? "h-2.5 w-2.5 shrink-0 opacity-90" : "h-3 w-3 shrink-0 opacity-90"} />
      <span className="truncate">{appointmentChipLabel(event)}</span>
    </div>
  );
}

function EventRow({
  event,
  now,
  studentId,
  studentView,
  onOpen,
  compact = false,
}: {
  event: CalendarEvent;
  now: Date;
  studentId: string;
  studentView: boolean;
  onOpen: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const time = formatEventTime(event);
  const meta = CALENDAR_TYPE_META[event.type];
  // Student view only: overdue if not submitted, else score / submitted.
  // Instructor view: no personal status badges.
  const badge = studentView
    ? getCalendarEventStudentBadge(event, studentId, now, {
        hideUnpostedScores: true,
      })
    : null;

  const interactive = Boolean(event.customEventId || event.appointmentGroupId);
  const openSlot = isUnbookedAppointment(event);
  const typeColor = calendarEventTypeColor(event);
  const body = (
    <>
      <span
        className={`mt-0.5 flex shrink-0 items-center justify-center ${
          compact ? "h-7 w-7" : "h-9 w-9"
        } ${
          openSlot
            ? "rounded-lg border-2 border-dashed opacity-80"
            : "rounded-lg text-white"
        }`}
        style={
          openSlot
            ? {
                borderColor: typeColor,
                color: typeColor,
                backgroundColor: `${typeColor}1a`,
              }
            : { backgroundColor: typeColor }
        }
      >
        <TypeIcon type={event.type} className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-arc-ink">{event.title}</p>
          {badge?.kind === "overdue" && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
              Overdue
            </span>
          )}
          {studentView && badge?.kind === "score" && (
            <span className="rounded-full bg-arc-copper/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-arc-copper">
              {badge.label}
            </span>
          )}
          {studentView && badge?.kind === "submitted" && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Submitted
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-arc-mute">
          <CalendarCoursePip color={event.color} className="h-2 w-2" title={event.courseShortName} />
          <span className="font-medium" style={{ color: event.color }}>
            {event.courseShortName}
          </span>
          {" · "}
          {meta.short}
          {time ? ` · ${time}` : ""}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-arc-mute">
            <Icon name="mapPin" size={12} />
            {event.location}
          </p>
        )}
      </div>
    </>
  );

  const className = compact
    ? `flex w-full items-start gap-2 rounded-lg border border-l-[3px] bg-arc-ivory px-2 py-1.5 text-left transition hover:border-arc-copper/40 hover:bg-arc-copper/10 ${
        openSlot ? "border-dashed opacity-80" : "border-arc-line/70"
      }`
    : `flex w-full items-start gap-3 rounded-xl border border-l-[3px] bg-arc-ivory px-3 py-3 text-left transition hover:border-arc-copper/40 hover:bg-arc-copper/10 ${
        openSlot ? "border-dashed opacity-80" : "border-arc-line/70"
      }`;

  if (interactive) {
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
    <Link to={event.path} className={className} style={{ borderLeftColor: event.color }}>
      {body}
    </Link>
  );
}

export default function CalendarPage() {
  const user = useUser();
  const navigate = useNavigate();
  const { studentView } = useStudentView();
  const { canManageCalendarSchedule } = usePermissions();
  const canDragDue = canManageCalendarSchedule;
  const skipMonthClick = useRef(false);
  const settings = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekStartsOn = settings.weekStartsOn ?? "monday";
  const weekdayLabels =
    weekStartsOn === "sunday"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = useMemo(() => new Date(), [user.id]);
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [view, setView] = useState<ViewMode>("month");
  const [courseFilter, setCourseFilter] = useState<CalendarFilterId>("all");
  const [typeFilters, setTypeFilters] = useState<Set<CalendarEventType>>(
    () => new Set(Object.keys(CALENDAR_TYPE_META) as CalendarEventType[]),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(() =>
    isSameDay(now, month) ? now.getDate() : null,
  );
  const [tick, setTick] = useState(0);
  const [eventModal, setEventModal] = useState<{
    eventId?: string;
    startAt?: number;
    courseId?: string | null;
  } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [focusAppointment, setFocusAppointment] = useState<{
    groupId: string;
    courseId: string;
  } | null>(null);
  const [groupEditor, setGroupEditor] = useState<{
    groupId?: string;
    courseId?: string;
  } | null>(null);
  const [dayDetail, setDayDetail] = useState<Date | null>(null);
  const [slotFocus, setSlotFocus] = useState<{
    courseId: string;
    groupId: string;
    slotId: string;
  } | null>(null);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    const events = [
      CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT,
      APPOINTMENT_GROUPS_CHANGED_EVENT,
      DUE_DATE_OVERRIDES_CHANGED_EVENT,
      "canvasClone:assignmentsChanged",
      "canvasClone:quizzesChanged",
      "canvasClone:discussionsChanged",
    ];
    for (const name of events) window.addEventListener(name, refresh);
    return () => {
      for (const name of events) window.removeEventListener(name, refresh);
    };
  }, []);

  useEffect(() => {
    const eventId = searchParams.get("event");
    const appointmentId = searchParams.get("appointment");
    const courseParam = searchParams.get("course");
    const slotParam = searchParams.get("slot");
    if (eventId) {
      setEventModal({ eventId });
      setSearchParams({}, { replace: true });
    } else if (appointmentId) {
      const courseId = courseParam || "all";
      if (slotParam && courseId !== "all") {
        setSlotFocus({ courseId, groupId: appointmentId, slotId: slotParam });
      } else {
        setFocusAppointment({
          groupId: appointmentId,
          courseId,
        });
        setFindOpen(true);
      }
      setSearchParams({}, { replace: true });
    } else if (courseParam) {
      setCourseFilter(courseParam);
    }
  }, [searchParams, setSearchParams]);

  const openCalendarItem = (event: CalendarEvent) => {
    if (event.customEventId) {
      setEventModal({ eventId: event.customEventId });
      return;
    }
    if (event.appointmentGroupId) {
      if (event.appointmentSlotId) {
        setSlotFocus({
          courseId: event.courseId,
          groupId: event.appointmentGroupId,
          slotId: event.appointmentSlotId,
        });
        return;
      }
      setFocusAppointment({
        groupId: event.appointmentGroupId,
        courseId: event.courseId,
      });
      setFindOpen(true);
      return;
    }
    navigate(event.path);
  };

  const handleCalendarDrop = (raw: string, targetAt: number, keepTimeOfDay = false) => {
    return applyCalendarDrop(raw, targetAt, { keepTimeOfDay });
  };

  const openNewEvent = (day?: number) => {
    const base =
      day != null
        ? new Date(month.getFullYear(), month.getMonth(), day, 9, 0, 0, 0)
        : new Date();
    if (day == null) base.setMinutes(0, 0, 0);
    openNewEventAt(base);
  };

  const openNewEventAt = (when: Date) => {
    const courseId =
      courseFilter !== "all" && courseFilter !== PERSONAL_CALENDAR_ID ? courseFilter : null;
    setEventModal({
      startAt: when.getTime(),
      courseId: studentView ? null : courseId,
    });
  };

  const openDayDetail = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(startOfMonth(next));
    }
    setSelectedDay(next.getDate());
    setDayDetail(next);
  };

  const courses = useMemo(
    () => loadCourses().filter((c) => c.published && !c.archived),
    [user.id],
  );

  const days = daysInMonth(month);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const offset =
    weekStartsOn === "sunday" ? firstDay : firstDay === 0 ? 6 : firstDay - 1;

  const eventsByDay = useMemo(() => {
    const raw = getCalendarEventsForMonth(month, courseFilter, now);
    const filtered = new Map<number, CalendarEvent[]>();
    for (const [day, list] of raw) {
      const next = list.filter((e) => typeFilters.has(e.type));
      if (next.length) filtered.set(day, next);
    }
    return filtered;
  }, [month, courseFilter, typeFilters, now, user.id, tick]);

  const monthEvents = useMemo(() => {
    const all: CalendarEvent[] = [];
    for (const list of eventsByDay.values()) all.push(...list);
    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDay]);

  const timedEvents = useMemo(() => {
    return getCalendarEvents(courseFilter, now).filter((e) => typeFilters.has(e.type));
  }, [courseFilter, typeFilters, now, user.id, tick]);

  const upcoming = useMemo(() => {
    return getUpcomingCalendarEvents(10, courseFilter, now).filter((e) =>
      typeFilters.has(e.type),
    );
  }, [courseFilter, typeFilters, now, user.id, tick]);

  const selectedEvents =
    selectedDay != null ? (eventsByDay.get(selectedDay) ?? []) : [];

  const viewingCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  const goToday = () => {
    const m = startOfMonth(now);
    setMonth(m);
    setSelectedDay(now.getDate());
  };

  const shiftAnchor = (dir: -1 | 1) => {
    const day = selectedDay ?? now.getDate();
    const base = new Date(month.getFullYear(), month.getMonth(), day);
    if (view === "week") base.setDate(base.getDate() + dir * 7);
    else if (view === "day") base.setDate(base.getDate() + dir);
    else base.setMonth(base.getMonth() + dir);
    setMonth(startOfMonth(base));
    setSelectedDay(base.getDate());
  };

  const prevMonth = () => shiftAnchor(-1);
  const nextMonth = () => shiftAnchor(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToday();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftAnchor(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftAnchor(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
  const navUnit = view === "week" ? "week" : view === "day" ? "day" : "month";
  const jumpDateMs = new Date(
    month.getFullYear(),
    month.getMonth(),
    Math.min(selectedDay ?? now.getDate(), days),
  ).getTime();

  const printRange = useMemo(() => {
    const anchor = new Date(
      month.getFullYear(),
      month.getMonth(),
      selectedDay ?? now.getDate(),
    );
    if (view === "week") {
      const start = startOfWeek(anchor, weekStartsOn);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === "day") {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [view, month, selectedDay, weekStartsOn, now]);

  const printEvents = useMemo(() => {
    return timedEvents
      .filter(
        (e) =>
          e.date.getTime() >= printRange.start.getTime() &&
          e.date.getTime() <= printRange.end.getTime(),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [timedEvents, printRange]);

  const printRangeLabel = useMemo(() => {
    if (view === "day") {
      return printRange.start.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "week") {
      const a = printRange.start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const b = printRange.end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${a} – ${b}`;
    }
    return monthLabel;
  }, [view, printRange, monthLabel]);

  const printCalendarName =
    courseFilter === "all"
      ? "All calendars"
      : courseFilter === PERSONAL_CALENDAR_ID
        ? "Personal calendar"
        : (courses.find((c) => c.id === courseFilter)?.short_name ?? "Calendar");

  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `Calendar — ${printRangeLabel}`;
    document.body.classList.add("calendar-printing");
    const cleanup = () => {
      document.title = previousTitle;
      document.body.classList.remove("calendar-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const calendarCells = useMemo(() => {
    const cells: { date: Date; inMonth: boolean; day: number }[] = [];
    const prevLast = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    for (let i = 0; i < offset; i++) {
      const day = prevLast - offset + i + 1;
      cells.push({
        date: new Date(month.getFullYear(), month.getMonth() - 1, day),
        inMonth: false,
        day,
      });
    }
    for (let d = 1; d <= days; d++) {
      cells.push({
        date: new Date(month.getFullYear(), month.getMonth(), d),
        inMonth: true,
        day: d,
      });
    }
    const trailing = 42 - cells.length;
    for (let d = 1; d <= trailing; d++) {
      cells.push({
        date: new Date(month.getFullYear(), month.getMonth() + 1, d),
        inMonth: false,
        day: d,
      });
    }
    return cells;
  }, [month, offset, days]);

  const printViewLabel = VIEW_OPTIONS.find((opt) => opt.id === view)?.label ?? "Month";

  return (
    <div className="calendar-page flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-arc-paper">
      <header className="print-hide shrink-0 border-b border-arc-line/80 bg-arc-ivory">
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="text-arc-copper" aria-hidden>
              <Icon name="calendar" size={18} />
            </span>
            <div>
              <p className="kicker text-arc-copper">Wall</p>
              <h1 className="font-display text-xl font-medium text-arc-ink">Calendar</h1>
            </div>
            <span className="hidden h-6 w-px shrink-0 bg-arc-line sm:block" aria-hidden />
            <div className="flex shrink-0 items-center rounded-lg border border-arc-line bg-arc-ivory">
              <button
                type="button"
                onClick={prevMonth}
                aria-label={`Previous ${navUnit}`}
                className="rounded-lg p-2 text-arc-mute hover:bg-arc-paper"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className="min-w-[10.5rem] px-1 text-center text-base font-semibold text-arc-ink">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label={`Next ${navUnit}`}
                className="rounded-lg p-2 text-arc-mute hover:bg-arc-paper"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            <button type="button" onClick={goToday} className={toolBtn}>
              Today
            </button>
            <div className="w-[10.75rem] shrink-0">
              <DateTimeField
                label="Jump to date"
                hideLabel
                dateOnly
                compact
                value={jumpDateMs}
                onChange={(ms) => {
                  if (!ms) return;
                  const d = new Date(ms);
                  setMonth(startOfMonth(d));
                  setSelectedDay(d.getDate());
                }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center rounded-lg border border-arc-line bg-arc-ivory p-0.5">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === opt.id ? "bg-arc-copper text-white" : "text-arc-mute hover:bg-arc-paper"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => openNewEvent(selectedDay ?? undefined)}
              className="btn-canvas-primary inline-flex h-9 items-center gap-1.5 px-3 text-sm"
            >
              <Icon name="plus" size={16} />
              Event
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusAppointment(null);
                setFindOpen(true);
              }}
              className={toolBtn}
            >
              Find appointment
            </button>
            {canManageCalendarSchedule && (
              <button
                type="button"
                onClick={() =>
                  setGroupEditor({
                    courseId:
                      courseFilter !== "all" && courseFilter !== PERSONAL_CALENDAR_ID
                        ? courseFilter
                        : undefined,
                  })
                }
                className={toolBtn}
              >
                <Icon name="plus" size={16} />
                Appointment group
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadPlannerIcs(courseFilter === "all" ? "all" : courseFilter)}
              className={toolBtnIcon}
              title="Export ICS"
              aria-label="Export ICS"
            >
              <Icon name="download" size={16} />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className={toolBtnIcon}
              title="Print"
              aria-label="Print"
            >
              <Icon name="printer" size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto border-t border-arc-line/60 bg-arc-paper/80 px-4 py-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-arc-mute">
              Course
            </span>
            <button
              type="button"
              onClick={() => setCourseFilter("all")}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                courseFilter === "all"
                  ? "bg-canvas-grayDark text-white"
                  : "bg-arc-paper text-arc-mute hover:bg-arc-line"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setCourseFilter(PERSONAL_CALENDAR_ID)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                courseFilter === PERSONAL_CALENDAR_ID
                  ? "bg-gray-600 text-white"
                  : "bg-arc-paper text-arc-mute hover:bg-arc-line"
              }`}
            >
              Personal
            </button>
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  courseFilter === c.id ? "text-white" : "bg-arc-paper text-arc-mute hover:bg-arc-line"
                }`}
                style={courseFilter === c.id ? { backgroundColor: c.color } : undefined}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: courseFilter === c.id ? "#fff" : c.color }}
                />
                {c.short_name}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-arc-mute">
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    on ? "text-white" : "bg-arc-paper text-arc-mute line-through decoration-gray-400"
                  }`}
                  style={on ? { backgroundColor: meta.accent } : undefined}
                >
                  <TypeIcon type={type} className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="print-hide flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="calendar-print-root flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 lg:p-4">
          {view === "week" || view === "day" ? (
            <CalendarWeekDayGrid
              view={view}
              anchor={
                new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  selectedDay ?? now.getDate(),
                )
              }
              weekStartsOn={weekStartsOn}
              events={timedEvents}
              canDragDue={canDragDue}
              onOpen={openCalendarItem}
              onOpenDay={openDayDetail}
              onCreateAt={(startAt) => openNewEventAt(new Date(startAt))}
              onDropAt={(raw, startAt) => handleCalendarDrop(raw, startAt)}
            />
          ) : view === "month" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-arc-ivory ring-1 ring-arc-line/80">
              <div className="grid shrink-0 grid-cols-7 border-b border-arc-line/70 bg-arc-paper/60">
                {weekdayLabels.map((d) => (
                  <div
                    key={d}
                    className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-arc-mute"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                {calendarCells.map((cell, i) => {
                  const events = cell.inMonth ? (eventsByDay.get(cell.day) ?? []) : [];
                  const isToday = isSameDay(cell.date, now);
                  const isSelected = cell.inMonth && selectedDay === cell.day;
                  const col = i % 7;
                  const isWeekend =
                    weekStartsOn === "sunday" ? col === 0 || col === 6 : col >= 5;

                  return (
                    <div
                      key={`${cell.date.toISOString()}-${i}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (skipMonthClick.current) {
                          skipMonthClick.current = false;
                          return;
                        }
                        openDayDetail(cell.date);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDayDetail(cell.date);
                        }
                      }}
                      onDragOver={(e) => {
                        if (!canDragDue) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        if (!canDragDue) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const raw = readCalendarDragData(e.dataTransfer);
                        if (!raw) return;
                        skipMonthClick.current = true;
                        handleCalendarDrop(raw, cell.date.getTime(), true);
                      }}
                      data-calendar-day={cell.inMonth ? String(cell.day) : undefined}
                      className={`min-h-0 cursor-pointer overflow-hidden border-b border-r border-arc-line/40 p-1 text-left transition ${
                        isSelected
                          ? "bg-arc-copper/15 ring-2 ring-inset ring-canvas-blue/40"
                          : cell.inMonth
                            ? isWeekend
                              ? "bg-gray-50/50 hover:bg-arc-copper/10/40"
                              : "hover:bg-arc-copper/10/40"
                            : "bg-gray-50/70 hover:bg-arc-copper/10/20"
                      }`}
                    >
                      <span
                        data-calendar-day-number={cell.inMonth ? String(cell.day) : undefined}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-arc-copper text-white"
                            : isSelected
                              ? "text-arc-copper"
                              : cell.inMonth
                                ? "text-arc-mute"
                                : "text-gray-300"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {cell.inMonth && (
                        <div className="mt-0.5 space-y-0.5">
                          {events.slice(0, 3).map((e) => (
                            <EventChip
                              key={e.id}
                              event={e}
                              compact
                              canDrag={canDragDue}
                              onOpen={openCalendarItem}
                            />
                          ))}
                          {events.length > 3 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDayDetail(cell.date);
                              }}
                              className="block w-full px-1 text-left text-[10px] font-medium text-arc-mute hover:text-arc-copper"
                            >
                              +{events.length - 3} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-auto rounded-xl bg-arc-ivory p-4 pb-24 ring-1 ring-arc-line/80">
              <h2 className="mb-3 text-sm font-semibold text-arc-ink">
                Agenda · {monthLabel}
              </h2>
              {monthEvents.length === 0 ? (
                <AppEmptyState
                  variant="calendar"
                  studio={studentView ? "student" : "instructor"}
                  title="Nothing scheduled this month"
                  subtitle="Try another month, or turn on more event types above."
                  compact
                />
              ) : (
                <div className="space-y-5">
                  {Array.from(eventsByDay.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([day, list]) => {
                      const date = new Date(month.getFullYear(), month.getMonth(), day);
                      const isToday = isSameDay(date, now);
                      return (
                        <div key={day}>
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                isToday ? "text-arc-copper" : "text-arc-ink"
                              }`}
                            >
                              {date.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {isToday && (
                              <span className="rounded-full bg-arc-copper/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-arc-copper">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {list.map((e) => (
                              <EventRow
                                key={e.id}
                                event={e}
                                now={now}
                                studentId={user.id}
                                studentView={studentView}
                                onOpen={openCalendarItem}
                                compact
                              />
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

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-arc-line/70 bg-arc-ivory p-3 pb-24 lg:h-full lg:w-80 lg:border-l lg:border-t-0 lg:bg-arc-paper xl:w-[22rem] xl:p-4 xl:pb-24">
          {view === "month" && (
            <div className="rounded-xl bg-arc-ivory p-3 ring-1 ring-arc-line/80">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  if (selectedDay == null) return;
                  openDayDetail(new Date(month.getFullYear(), month.getMonth(), selectedDay));
                }}
              >
                <h2 className="text-sm font-semibold text-arc-ink">
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
              </button>
              {selectedDay == null ? (
                <p className="mt-1.5 text-xs text-arc-mute">
                  Click a date to see everything due that day.
                </p>
              ) : selectedEvents.length === 0 ? (
                <div className="mt-1.5">
                  <p className="text-xs text-arc-mute">No events on this day.</p>
                  <button
                    type="button"
                    onClick={() => openNewEvent(selectedDay)}
                    className="mt-1.5 text-xs font-medium text-arc-copper hover:underline"
                  >
                    Add an event
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {selectedEvents.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      now={now}
                      studentId={user.id}
                      studentView={studentView}
                      onOpen={openCalendarItem}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!studentView && (
            <AppointmentSchedulePanel
              courseIds={
                courseFilter !== "all" && courseFilter !== PERSONAL_CALENDAR_ID
                  ? [courseFilter]
                  : courses.map((c) => c.id)
              }
              onOpenSlot={(row) => setSlotFocus(row)}
            />
          )}

          <div className="rounded-xl bg-arc-ivory p-3 ring-1 ring-arc-line/80">
            <h2 className="text-sm font-semibold text-arc-ink">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="mt-1.5 text-xs text-arc-mute">No upcoming items match your filters.</p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {upcoming.map((e) => {
                  const typeColor = calendarEventTypeColor(e);
                  const inner = (
                    <>
                      <p className="text-[11px] font-medium text-arc-mute">
                        {e.date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {formatEventTime(e) ? ` · ${formatEventTime(e)}` : ""}
                      </p>
                      <p className="truncate text-sm font-medium text-arc-ink">{e.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs">
                        <CalendarCoursePip color={e.color} title={e.courseShortName} />
                        <span style={{ color: e.color }}>{e.courseShortName}</span>
                        <span className="text-arc-mute">· {CALENDAR_TYPE_META[e.type].short}</span>
                      </p>
                    </>
                  );
                  const rowClass =
                    "block w-full rounded-lg border-l-[3px] px-1.5 py-1.5 text-left hover:bg-arc-paper";
                  const rowStyle = { borderLeftColor: typeColor };
                  return (
                  <li key={e.id}>
                    {e.customEventId || e.appointmentGroupId ? (
                      <button
                        type="button"
                        onClick={() => openCalendarItem(e)}
                        className={rowClass}
                        style={rowStyle}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link to={e.path} className={rowClass} style={rowStyle}>
                        {inner}
                      </Link>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
            {!viewingCurrentMonth && (
              <button
                type="button"
                onClick={goToday}
                className="mt-2 text-xs font-medium text-arc-copper hover:underline"
              >
                Jump to today
              </button>
            )}
          </div>
        </aside>
      </div>

      <CalendarPrintSheet
        calendarName={printCalendarName}
        viewLabel={printViewLabel}
        rangeLabel={printRangeLabel}
        events={printEvents}
        weekdayLabels={view === "month" ? weekdayLabels : undefined}
        monthCells={view === "month" ? calendarCells : undefined}
      />

      {eventModal && (
        <CalendarEventModal
          initial={eventModal.eventId ? getCustomCalendarEvent(eventModal.eventId) : undefined}
          defaultCourseId={eventModal.courseId}
          defaultStartAt={eventModal.startAt}
          isInstructor={canManageCalendarSchedule}
          onClose={() => setEventModal(null)}
          onSaved={() => setTick((n) => n + 1)}
        />
      )}
      {findOpen && (
        <FindAppointmentModal
          courseId={
            focusAppointment?.courseId && focusAppointment.courseId !== PERSONAL_CALENDAR_ID
              ? focusAppointment.courseId
              : courseFilter === PERSONAL_CALENDAR_ID
                ? "all"
                : courseFilter
          }
          focusGroupId={focusAppointment?.groupId}
          studentView={studentView}
          onClose={() => {
            setFindOpen(false);
            setFocusAppointment(null);
          }}
          onChanged={() => setTick((n) => n + 1)}
          onEditGroup={
            canManageCalendarSchedule
              ? (group) => {
                  setFindOpen(false);
                  setGroupEditor({ groupId: group.id, courseId: group.courseId });
                }
              : undefined
          }
          onCreateGroup={
            canManageCalendarSchedule
              ? () => {
                  setFindOpen(false);
                  setGroupEditor({
                    courseId:
                      courseFilter !== "all" && courseFilter !== PERSONAL_CALENDAR_ID
                        ? courseFilter
                        : undefined,
                  });
                }
              : undefined
          }
          onOpenSlot={(group, slot) => {
            setSlotFocus({
              courseId: group.courseId,
              groupId: group.id,
              slotId: slot.id,
            });
          }}
        />
      )}
      {slotFocus && (
        <AppointmentSlotModal
          courseId={slotFocus.courseId}
          groupId={slotFocus.groupId}
          slotId={slotFocus.slotId}
          studentView={studentView}
          onClose={() => setSlotFocus(null)}
          onChanged={() => setTick((n) => n + 1)}
        />
      )}
      {dayDetail && (
        <CalendarDayDetailModal
          date={dayDetail}
          events={timedEvents.filter((e) => isSameDay(e.date, dayDetail))}
          now={now}
          studentId={user.id}
          studentView={studentView}
          onClose={() => setDayDetail(null)}
          onOpenEvent={(event) => {
            setDayDetail(null);
            if (event.customEventId || event.appointmentGroupId) {
              openCalendarItem(event);
            }
          }}
          onAddEvent={() => {
            const start = new Date(dayDetail);
            start.setHours(9, 0, 0, 0);
            setDayDetail(null);
            openNewEventAt(start);
          }}
          onViewDay={() => {
            setMonth(startOfMonth(dayDetail));
            setSelectedDay(dayDetail.getDate());
            setView("day");
            setDayDetail(null);
          }}
        />
      )}
      {groupEditor && canManageCalendarSchedule && (
        <AppointmentGroupModal
          initial={
            groupEditor.groupId && groupEditor.courseId
              ? loadAppointmentGroups(groupEditor.courseId).find((g) => g.id === groupEditor.groupId)
              : undefined
          }
          defaultCourseId={groupEditor.courseId}
          onClose={() => setGroupEditor(null)}
          onSaved={() => setTick((n) => n + 1)}
          onDeleted={() => setTick((n) => n + 1)}
        />
      )}
    </div>
  );
}
