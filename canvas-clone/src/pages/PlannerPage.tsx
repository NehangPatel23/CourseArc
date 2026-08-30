import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DateTimeField from "../components/DateTimeField";
import AppEmptyState from "../components/AppEmptyState";
import PageIdentityHeader from "../components/PageIdentityHeader";
import Icon from "../icons/Icon";
import {
  addCourseTodo,
  canEditCourseTodo,
  COURSE_TODOS_CHANGED_EVENT,
  deleteCourseTodo,
  getAllVisibleTodos,
  toggleCourseTodoComplete,
  updateCourseTodo,
  type CourseTodo,
} from "../utils/courseTodos";
import { APPOINTMENT_GROUPS_CHANGED_EVENT } from "../utils/appointmentGroups";
import {
  formatEventTime,
  getCalendarEventStudentBadge,
  getCalendarEvents,
  isBookedUpcomingAppointment,
  isCalendarEventOverdue,
  type CalendarEvent,
} from "../utils/calendarEvents";
import { loadCourses } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";
import { useUser } from "../hooks/useUser";
import { useStudentView } from "../utils/studentView";
import { downloadPlannerIcs } from "../utils/plannerIcs";
import {
  getPlannerOverlay,
  PLANNER_OVERLAY_CHANGED_EVENT,
  setPlannerOverlayDone,
  setPlannerOverlayNote,
} from "../utils/plannerOverlay";

function formatDue(ts?: number) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDueAtEndOfDay(ms?: number): number | undefined {
  if (ms == null) return undefined;
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isTodoOverdue(todo: CourseTodo) {
  return !!todo.dueAt && !todo.completed && todo.dueAt < Date.now();
}

type ComingUpRow = {
  event: CalendarEvent;
  tone: "overdue" | "neutral";
  badgeLabel?: string;
  badgeKind?: "score" | "submitted";
};

export default function PlannerPage() {
  const user = useUser();
  const { studentView } = useStudentView();
  const courses = useMemo(
    () => loadCourses().filter((c) => !c.archived && (studentView ? c.published : true)),
    [studentView, user.id],
  );
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const [todos, setTodos] = useState<CourseTodo[]>(() => getAllVisibleTodos(user.id));
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDueAt, setDraftDueAt] = useState<number | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState<number | undefined>(undefined);
  const [newCourseId, setNewCourseId] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [overlayTick, setOverlayTick] = useState(0);

  useEffect(() => {
    const bump = () => setOverlayTick((n) => n + 1);
    window.addEventListener(PLANNER_OVERLAY_CHANGED_EVENT, bump);
    return () => window.removeEventListener(PLANNER_OVERLAY_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const refresh = () => setTodos(getAllVisibleTodos(loadUser().id));
    refresh();
    window.addEventListener(COURSE_TODOS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COURSE_TODOS_CHANGED_EVENT, refresh);
  }, [user.id]);

  useEffect(() => {
    if (!newCourseId && courses[0]?.id) setNewCourseId(courses[0].id);
  }, [courses, newCourseId]);

  useEffect(() => {
    setTick((n) => n + 1);
  }, [todos, user.id, studentView]);

  const now = useMemo(() => new Date(), [tick]);

  const comingUpRows = useMemo((): ComingUpRow[] => {
    const events = getCalendarEvents("all", now)
      .filter(
        (e) =>
          e.type === "assignment" ||
          e.type === "quiz" ||
          e.type === "todo" ||
          isBookedUpcomingAppointment(e, now),
      )
      .filter((e) => courseFilter === "all" || e.courseId === courseFilter);

    if (!studentView) {
      // Instructor: forward-looking schedule only — no overdue / score framing.
      return events
        .filter((e) => !isCalendarEventOverdue(e, now))
        .slice(0, 20)
        .map((event) => ({ event, tone: "neutral" as const }));
    }

    const rows: ComingUpRow[] = [];
    for (const event of events) {
      const badge = getCalendarEventStudentBadge(event, user.id, now, {
        hideUnpostedScores: true,
      });
      const pastDue = isCalendarEventOverdue(event, now);

      if (badge?.kind === "overdue") {
        rows.push({ event, tone: "overdue" });
        continue;
      }

      // Future items only — skip past-due work that was already submitted.
      if (!pastDue) {
        rows.push({
          event,
          tone: "neutral",
          badgeLabel: badge?.kind === "score" ? badge.label : undefined,
          badgeKind:
            badge?.kind === "score" || badge?.kind === "submitted" ? badge.kind : undefined,
        });
      }
    }

    return rows
      .sort((a, b) => {
        if (a.tone !== b.tone) return a.tone === "overdue" ? -1 : 1;
        return a.event.date.getTime() - b.event.date.getTime();
      })
      .slice(0, 25);
  }, [now, studentView, user.id, todos, courseFilter, overlayTick]);

  const startEdit = (todo: CourseTodo) => {
    setEditingId(todo.id);
    setDraftTitle(todo.title);
    setDraftDueAt(todo.dueAt);
  };

  const saveEdit = (todo: CourseTodo) => {
    if (!editingId || !draftTitle.trim()) return;
    const dueAt = toDueAtEndOfDay(draftDueAt);
    updateCourseTodo(todo.courseId, editingId, {
      title: draftTitle.trim(),
      ...(dueAt != null ? { dueAt } : { clearDueAt: true }),
    });
    setEditingId(null);
    setDraftTitle("");
    setDraftDueAt(undefined);
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newCourseId) return;
    addCourseTodo(
      newCourseId,
      {
        title: newTitle.trim(),
        dueAt: toDueAtEndOfDay(newDueAt),
      },
      { ownerId: user.id, scope: "personal" },
    );
    setNewTitle("");
    setNewDueAt(undefined);
    setShowAdd(false);
  };

  return (
    <div className="w-full px-8 py-10 lg:px-14">
      {!studentView && (
        <div className="mb-6 flex items-center gap-2 border-b border-arc-ink/10 pb-3 text-arc-mute">
          <Icon name="eye" size={12} />
          <span className="kicker">Instructor desk — upcoming deadlines, no student scores</span>
        </div>
      )}

      <PageIdentityHeader
        className="mb-8"
        icon="checkSquare"
        label="Planner"
        title={studentView ? "Your planner" : "Course planner"}
        description={
          studentView
            ? "Coming-up deadlines, booked appointments, and to-dos across all your courses in one place."
            : "Upcoming assignment, quiz, and booked appointment times across your courses."
        }
        actions={
          <div className="flex items-center gap-3">
            <label className="text-sm text-arc-mute">
              Course{" "}
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="dashboard-control ml-1"
              >
                <option value="all">All</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_name}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/calendar" className="desk-link py-0 text-sm">
              Open calendar →
            </Link>
            <button
              type="button"
              className="desk-link py-0 text-sm"
              onClick={() => downloadPlannerIcs()}
            >
              Export ICS
            </button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="desk-panel p-5">
          <h2 className="font-display text-xl font-medium italic text-arc-ink">Coming up</h2>
          {comingUpRows.length === 0 ? (
            <AppEmptyState
              variant="calendar"
              studio={studentView ? "student" : "instructor"}
              title="Nothing coming up"
              subtitle={
                studentView
                  ? "You're all caught up — no overdue work or booked appointments."
                  : "No upcoming assignment, quiz, or appointment times."
              }
            />
          ) : (
            <ul className="space-y-2">
              {comingUpRows.map(({ event, tone, badgeLabel, badgeKind }) => {
                const overlay = getPlannerOverlay(event.id);
                return (
                <li key={event.id}>
                  <div
                    className={`flex items-start gap-3 border px-3 py-2.5 ${
                      tone === "overdue"
                        ? "border-arc-brick/30 bg-arc-brick/10"
                        : overlay?.done
                          ? "border-arc-sage/30 bg-arc-sage/10"
                          : "border-arc-line bg-arc-ivory"
                    }`}
                  >
                    {studentView && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(overlay?.done)}
                        onChange={(e) => setPlannerOverlayDone(event.id, e.target.checked)}
                        title="Mark as done (does not submit)"
                        aria-label={`Mark ${event.title} done`}
                      />
                    )}
                    <Link to={event.path} className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-medium ${
                            tone === "overdue" ? "text-arc-brick" : "text-arc-ink"
                          }`}
                        >
                          {event.title}
                        </p>
                        {studentView && badgeKind === "score" && badgeLabel && (
                          <span className="rounded-full bg-arc-copper-tint px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-arc-copper">
                            {badgeLabel}
                          </span>
                        )}
                        {studentView && badgeKind === "submitted" && (
                          <span className="rounded-full bg-arc-sage/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-arc-sage">
                            Submitted
                          </span>
                        )}
                        {event.type === "appointment" && (
                          <span className="rounded-full bg-arc-brick/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-arc-brick">
                            {event.appointmentWaitlisted ? "Waitlist" : "Appointment"}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          tone === "overdue" ? "text-arc-brick" : "text-arc-mute"
                        }`}
                      >
                        {event.courseShortName}
                        {tone === "overdue"
                          ? " · Overdue"
                          : event.type === "appointment"
                            ? ` · ${formatDue(event.date.getTime())}${
                                formatEventTime(event) ? ` · ${formatEventTime(event)}` : ""
                              }`
                            : ` · Due ${formatDue(event.date.getTime())}`}
                      </p>
                      {studentView && overlay?.note && (
                        <p className="mt-1 text-xs text-arc-mute">{overlay.note}</p>
                      )}
                    </div>
                    </div>
                    </Link>
                    {studentView && (
                      <button
                        type="button"
                        className="text-[10px] text-arc-copper hover:underline"
                        onClick={() => {
                          const next = window.prompt("Note for this deadline", overlay?.note ?? "");
                          if (next == null) return;
                          setPlannerOverlayNote(event.id, next);
                        }}
                      >
                        Note
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="desk-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-medium italic text-arc-ink">My to-dos</h2>
            {!showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1 text-sm text-arc-copper hover:underline"
              >
                <Icon name="plus" size={14} />
                Add
              </button>
            )}
          </div>

          {showAdd && (
            <div className="mb-4 space-y-3 border border-arc-line bg-arc-paper/60 p-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="To-do title"
                className="form-input w-full text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <label className="block text-xs font-medium text-arc-mute">
                Course
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="form-input mt-1 w-full text-sm"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name} — {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <DateTimeField label="Due date" value={newDueAt} onChange={setNewDueAt} />
              <div className="flex gap-2">
                <button type="button" onClick={handleAdd} className="btn-canvas-primary text-sm">
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setNewTitle("");
                    setNewDueAt(undefined);
                  }}
                  className="btn-canvas-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {todos.length === 0 ? (
            <AppEmptyState
              variant="list"
              studio={studentView ? "student" : "instructor"}
              title="No to-dos yet"
              subtitle="Add a personal to-do for any course to track it here."
            />
          ) : (
            <ul className="space-y-2">
              {todos.map((todo) => {
                const course = courseById.get(todo.courseId);
                const overdueTodo = isTodoOverdue(todo);
                const editable = canEditCourseTodo(todo, user.id, !studentView);
                return (
                  <li
                    key={todo.id}
                    className="flex items-start gap-2 border border-arc-line px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={!!todo.completed}
                      onChange={() => toggleCourseTodoComplete(todo.courseId, todo.id)}
                      className="mt-1 rounded border-gray-300"
                    />
                    {editingId === todo.id ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(todo)}
                          className="form-input text-sm"
                          autoFocus
                        />
                        <DateTimeField
                          label="Due date"
                          value={draftDueAt}
                          onChange={setDraftDueAt}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(todo)}
                            className="btn-canvas-primary text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDraftTitle("");
                              setDraftDueAt(undefined);
                            }}
                            className="btn-canvas-secondary text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-sm ${
                              todo.completed
                                ? "text-arc-mute line-through"
                                : overdueTodo
                                  ? "font-medium text-arc-brick"
                                  : "text-arc-ink"
                            }`}
                          >
                            {todo.title}
                          </span>
                          {todo.scope === "course" && (
                            <span className="inline-flex items-center gap-0.5 bg-arc-copper/10 px-1.5 py-0.5 text-[10px] font-medium text-arc-copper">
                              <Icon name="users" size={12} />
                              Class
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-arc-mute">
                          {course && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: course.color }}
                              />
                              {course.short_name}
                            </span>
                          )}
                          {todo.dueAt && (
                            <span className={overdueTodo ? "text-arc-brick" : undefined}>
                              {overdueTodo ? "Overdue · " : "Due "}
                              {formatDue(todo.dueAt)}
                            </span>
                          )}
                        </span>
                      </span>
                    )}
                    {editable && editingId !== todo.id && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => startEdit(todo)}
                          className="rounded p-1 text-arc-mute hover:bg-arc-paper"
                          aria-label="Edit to-do"
                        >
                          <Icon name="pencil" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCourseTodo(todo.courseId, todo.id)}
                          className="rounded p-1 text-arc-brick hover:bg-arc-brick/10"
                          aria-label="Delete to-do"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
