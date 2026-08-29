import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import AppointmentIcsActions from "./AppointmentIcsActions";
import CanvasModal from "./CanvasModal";
import ConfirmActionModal from "./ConfirmActionModal";
import DateTimeField from "./DateTimeField";
import RichContentViewer from "./RichContentViewer";
import { useToast } from "./ui/Toast";
import {
  admitWaitlistedStudent,
  appointmentGroupCourseIds,
  cancelAppointmentSignup,
  closeAppointmentGroup,
  dropStudentFromSlot,
  formatAppointmentSlotRange,
  loadAppointmentGroupsForCourses,
  moveConfirmedStudentToWaitlist,
  signUpForSlot,
  slotHasCapacity,
  studentCanCancelSignup,
  studentCanSeeAppointmentGroup,
  studentHeldSlotsInGroup,
  studentSlotLimit,
  type AppointmentGroup,
  type AppointmentSlot,
} from "../utils/appointmentGroups";
import {
  addCalendarDays,
  filterFindAppointmentGroups,
  startOfDay,
  type AvailabilityFilter,
  type TimeOfDayFilter,
} from "../utils/findAppointmentFilters";
import { notifyAppointmentActivity } from "../utils/appointmentNotify";
import { findOverlappingCalendarItems } from "../utils/calendarOverlap";
import { htmlPreview } from "../utils/htmlPreview";
import { loadCourses } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";

const DURATION_OPTIONS = [0, 15, 20, 30, 45, 60] as const;

export default function FindAppointmentModal({
  courseId,
  focusGroupId,
  studentView,
  onClose,
  onChanged,
  onEditGroup,
  onCreateGroup,
  onOpenSlot,
}: {
  courseId: string | "all";
  focusGroupId?: string;
  studentView: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onEditGroup?: (group: AppointmentGroup) => void;
  onCreateGroup?: () => void;
  onOpenSlot?: (group: AppointmentGroup, slot: AppointmentSlot) => void;
}) {
  const { showToast } = useToast();
  const user = loadUser();
  const courses = loadCourses().filter((c) => c.published && !c.archived);
  const scoped = courseId === "all" ? courses : courses.filter((c) => c.id === courseId);
  const [tick, setTick] = useState(0);
  const [confirm, setConfirm] = useState<{
    title: string;
    when: string;
    location?: string;
    waitlisted?: boolean;
  } | null>(null);
  const [overlapWarn, setOverlapWarn] = useState<{
    group: AppointmentGroup;
    slotId: string;
    titles: string[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [courseFilterId, setCourseFilterId] = useState(courseId === "all" ? "all" : courseId);
  const [availability, setAvailability] = useState<AvailabilityFilter>(studentView ? "open" : "all");
  const [timeFilter, setTimeFilter] = useState<TimeOfDayFilter>("any");
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [fromMs, setFromMs] = useState<number | undefined>(() => startOfDay(Date.now()));
  const [toMs, setToMs] = useState<number | undefined>();
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [dropTarget, setDropTarget] = useState<{
    group: AppointmentGroup;
    slot: AppointmentSlot;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [dropComment, setDropComment] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{
    group: AppointmentGroup;
    slotId?: string;
  } | null>(null);
  const [cancelComment, setCancelComment] = useState("");

  const groups = useMemo(() => {
    const ids = scoped.map((c) => c.id);
    return loadAppointmentGroupsForCourses(ids)
      .filter((g) => (studentView ? g.published : true))
      .filter((g) => (studentView ? studentCanSeeAppointmentGroup(g, user.id) : true))
      .sort((a, b) => a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentView, tick, user.id, scoped.map((c) => c.id).join(",")]);

  const focused = focusGroupId ? groups.find((g) => g.id === focusGroupId) : undefined;
  const courseName = (id: string) => courses.find((c) => c.id === id)?.short_name ?? "Course";
  const hrefFor = (group: AppointmentGroup) =>
    `/calendar?appointment=${encodeURIComponent(group.id)}&course=${encodeURIComponent(group.courseId)}`;
  const todayStart = useMemo(() => startOfDay(Date.now()), []);

  const filtersActive =
    query.trim() !== "" ||
    (scoped.length > 1 && courseFilterId !== "all") ||
    availability !== (studentView ? "open" : "all") ||
    timeFilter !== "any" ||
    durationMinutes !== 0 ||
    fromMs !== todayStart ||
    toMs != null ||
    includePast;

  const clearFilters = () => {
    setQuery("");
    setCourseFilterId(courseId === "all" ? "all" : courseId);
    setAvailability(studentView ? "open" : "all");
    setTimeFilter("any");
    setDurationMinutes(0);
    setFromMs(todayStart);
    setToMs(undefined);
    setIncludePast(false);
  };

  const applyDatePreset = (days: number) => {
    setFromMs(todayStart);
    setToMs(addCalendarDays(todayStart, days));
  };

  const matches = useMemo(
    () =>
      filterFindAppointmentGroups(
        groups,
        {
          query,
          courseFilterId,
          availability,
          timeOfDay: timeFilter,
          fromMs,
          toMs,
          durationMinutes,
          includePast,
          studentId: user.id,
        },
        courseName,
        focused?.id,
      ),
    [
      groups,
      query,
      courseFilterId,
      availability,
      timeFilter,
      fromMs,
      toMs,
      durationMinutes,
      includePast,
      user.id,
      focused?.id,
      courses,
    ],
  );

  const matchCount = matches.reduce((n, row) => n + row.slots.length, 0);

  const groupIsOpen = (groupId: string) => {
    if (studentView) return true;
    if (groupId in expandedById) return expandedById[groupId];
    if (focused?.id) return groupId === focused.id;
    return matches.length <= 1;
  };

  const toggleGroup = (groupId: string) => {
    setExpandedById((prev) => ({ ...prev, [groupId]: !groupIsOpen(groupId) }));
  };

  const refresh = () => {
    setTick((n) => n + 1);
    onChanged?.();
  };

  const book = (group: AppointmentGroup, slotId: string, ignoreOverlap = false) => {
    const slot = group.slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (!ignoreOverlap) {
      const hits = findOverlappingCalendarItems(slot.startAt, slot.endAt, {
        ignoreAppointmentSlotId: slotId,
      });
      if (hits.length) {
        setOverlapWarn({ group, slotId, titles: hits.map((h) => h.title) });
        return;
      }
    }
    const result = signUpForSlot(group.courseId, group.id, slotId, {
      id: user.id,
      name: user.name,
    });
    if (!result.ok) {
      showToast(result.reason, "negative");
      return;
    }
    if (result.waitlisted) {
      showToast("Added to waitlist", "neutral");
    } else {
      showToast("Signed up", "positive");
      notifyAppointmentActivity({
        audience: "instructor",
        title: `Appointment booked: ${group.title}`,
        body: `${user.name} booked ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
        courseId: group.courseId,
        href: hrefFor(group),
      });
    }
    setConfirm({
      title: group.title,
      when: formatAppointmentSlotRange(slot.startAt, slot.endAt),
      location: group.location,
      waitlisted: result.waitlisted,
    });
    setOverlapWarn(null);
    refresh();
  };

  const cancel = (group: AppointmentGroup, slotId?: string) => {
    const gate = studentCanCancelSignup(group, user.id, Date.now(), slotId);
    if (!gate.ok) {
      showToast(gate.reason, "negative");
      return;
    }
    setCancelComment("");
    setCancelTarget({ group, slotId });
  };

  const confirmCancel = () => {
    if (!cancelTarget || !cancelComment.trim()) return;
    const { group, slotId } = cancelTarget;
    const result = cancelAppointmentSignup(group.courseId, group.id, user.id, {
      slotId,
    });
    if (!result) {
      showToast("Could not cancel this sign-up.", "negative");
      return;
    }
    showToast("Sign-up canceled", "neutral");
    notifyAppointmentActivity({
      audience: "instructor",
      title: `Appointment canceled: ${group.title}`,
      body: `${user.name} canceled ${group.title}.\n\n${cancelComment.trim()}`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    if (result?.promoted) {
      notifyAppointmentActivity({
        audience: "student",
        title: `Waitlist promoted: ${group.title}`,
        body: `${result.promoted.studentName} was moved off the waitlist for ${group.title}.`,
        courseId: group.courseId,
        href: hrefFor(group),
      });
    }
    setCancelTarget(null);
    setCancelComment("");
    refresh();
  };

  const confirmDrop = () => {
    if (!dropTarget || !dropComment.trim()) return;
    const { group, slot, studentId } = dropTarget;
    const dropped = dropStudentFromSlot(group.courseId, group.id, slot.id, studentId);
    notifyAppointmentActivity({
      audience: "student",
      title: `Appointment canceled: ${group.title}`,
      body: `Your instructor canceled ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).\n\n${dropComment.trim()}`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    if (dropped?.promoted) {
      notifyAppointmentActivity({
        audience: "student",
        title: `Waitlist promoted: ${group.title}`,
        body: `You now have a slot in ${group.title}.`,
        courseId: group.courseId,
        href: hrefFor(group),
      });
    }
    showToast("Student dropped", "neutral");
    setDropTarget(null);
    setDropComment("");
    refresh();
  };

  const admit = (group: AppointmentGroup, slot: AppointmentSlot, studentId: string) => {
    const result = admitWaitlistedStudent(group.courseId, group.id, slot.id, studentId);
    if (!result.ok) {
      showToast(result.reason, "negative");
      return;
    }
    showToast(
      result.extraSeat
        ? `${result.studentName} can attend. An extra seat was added.`
        : `${result.studentName} can attend this time.`,
      "positive",
    );
    notifyAppointmentActivity({
      audience: "student",
      title: `You're in: ${group.title}`,
      body: `Your instructor admitted you to ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    refresh();
  };

  const waitlistConfirmed = (group: AppointmentGroup, slot: AppointmentSlot, studentId: string) => {
    const result = moveConfirmedStudentToWaitlist(group.courseId, group.id, slot.id, studentId);
    if (!result.ok) {
      showToast(result.reason, "negative");
      return;
    }
    showToast(`${result.studentName} was moved to the waitlist`, "neutral");
    notifyAppointmentActivity({
      audience: "student",
      title: `Waitlisted: ${group.title}`,
      body: `Your instructor moved you to the waitlist for ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    refresh();
  };

  return (
    <>
    <CanvasModal
      title="Find appointment"
      onClose={onClose}
      size="lg"
      headerActions={
        !studentView && onCreateGroup ? (
          <button
            type="button"
            onClick={onCreateGroup}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-canvas-blueTint hover:text-canvas-blue"
            aria-label="New appointment group"
            title="New appointment group"
          >
            <Plus className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {confirm ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
            data-testid="appointment-confirmation"
          >
            <p className="font-semibold text-canvas-grayDark">
              {confirm.waitlisted ? "You’re on the waitlist" : "You’re signed up"}
            </p>
            <p className="mt-1 text-sm text-gray-700">{confirm.title}</p>
            <p className="text-sm text-gray-600">{confirm.when}</p>
            {confirm.location && <p className="text-sm text-gray-600">{confirm.location}</p>}
            <button type="button" className="btn-canvas-secondary mt-3 text-sm" onClick={() => setConfirm(null)}>
              Back to slots
            </button>
          </div>
        ) : null}

        {overlapWarn && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This overlaps {overlapWarn.titles.join(", ")}. Book anyway?
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-canvas-primary px-2 py-1 text-xs"
                onClick={() => book(overlapWarn.group, overlapWarn.slotId, true)}
              >
                Book anyway
              </button>
              <button
                type="button"
                className="btn-canvas-secondary px-2 py-1 text-xs"
                onClick={() => setOverlapWarn(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600">
            {studentView
            ? "Pick an open time. Full slots can be waitlisted. Unlimited per student means more than one time, not extra seats in a single time."
            : "Published groups are visible to students. Open a time for meeting details, chat, and notes."}
        </p>

        {groups.length > 0 && (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex min-w-0 items-center gap-1.5 text-left"
                aria-expanded={filtersOpen}
                aria-controls="find-appointment-filters"
                aria-label="Filters"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition ${filtersOpen ? "" : "-rotate-90"}`}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Filters
                </span>
                {!filtersOpen && filtersActive && (
                  <span className="rounded-full bg-canvas-blueTint px-1.5 py-0.5 text-[10px] font-semibold text-canvas-blue">
                    On
                  </span>
                )}
              </button>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-canvas-blue hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
            {filtersOpen && (
              <div id="find-appointment-filters" className="space-y-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, location, or course"
              aria-label="Search appointments"
              className="form-input h-9 py-1"
            />
            <div
              className={`grid gap-2 ${scoped.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {scoped.length > 1 && (
                <label className="block min-w-0">
                  <span className="form-label">Course</span>
                  <select
                    aria-label="Course"
                    className="form-input h-9 py-1"
                    value={courseFilterId}
                    onChange={(e) => setCourseFilterId(e.target.value)}
                  >
                    <option value="all">All courses</option>
                    {scoped.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.short_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block min-w-0">
                <span className="form-label">Availability</span>
                <select
                  aria-label="Availability"
                  className="form-input h-9 py-1"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}
                >
                  <option value="open">Open spots</option>
                  <option value="all">All times</option>
                  <option value="mine">My bookings</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className="form-label">Time of day</span>
                <select
                  aria-label="Time of day"
                  className="form-input h-9 py-1"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as TimeOfDayFilter)}
                >
                  <option value="any">Any time</option>
                  <option value="morning">Morning (before noon)</option>
                  <option value="afternoon">Afternoon (12–5)</option>
                  <option value="evening">Evening (after 5)</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className="form-label">Length</span>
                <select
                  aria-label="Length"
                  className="form-input h-9 py-1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 0 ? "Any length" : `${mins} min`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DateTimeField label="From" dateOnly compact value={fromMs} onChange={setFromMs} />
              <DateTimeField label="To" dateOnly compact value={toMs} onChange={setToMs} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:border-canvas-blue hover:text-canvas-blue"
                onClick={() => {
                  setFromMs(todayStart);
                  setToMs(todayStart);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:border-canvas-blue hover:text-canvas-blue"
                onClick={() => applyDatePreset(6)}
              >
                Next 7 days
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:border-canvas-blue hover:text-canvas-blue"
                onClick={() => applyDatePreset(29)}
              >
                Next 30 days
              </button>
            </div>
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
              />
              <span>Include ended times</span>
            </label>
              </div>
            )}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-sm text-gray-500">
              No appointment groups are available{courseId !== "all" ? " for this course" : ""}.
            </p>
            {!studentView && onCreateGroup && (
              <button
                type="button"
                onClick={onCreateGroup}
                className="btn-canvas-primary mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              >
                <Plus className="h-4 w-4" />
                New appointment group
              </button>
            )}
          </div>
        ) : matches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No slots match these filters.
            {filtersActive ? " Try clearing a filter or widening the date range." : ""}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
            <p className="text-xs text-gray-500">
              {matchCount} time{matchCount === 1 ? "" : "s"} in {matches.length} group
              {matches.length === 1 ? "" : "s"}
            </p>
            {matches.map(({ group, slots }) => {
              const held = studentHeldSlotsInGroup(group, user.id);
              const limit = studentSlotLimit(group);
              const cancelGate = held.length ? studentCanCancelSignup(group, user.id) : null;
              const open = groupIsOpen(group.id);
              const openCount = slots.filter((s) => slotHasCapacity(s)).length;
              const bookedCount = slots.filter((s) => s.signups.length > 0).length;
              const meta = (
                <>
                  {appointmentGroupCourseIds(group).map(courseName).join(" · ")}
                  {group.location ? ` · ${group.location}` : ""}
                  {!group.published ? " · Closed" : ""}
                  {typeof group.cancelUntilMinutesBefore === "number" &&
                  group.cancelUntilMinutesBefore > 0
                    ? ` · Cancel until ${group.cancelUntilMinutesBefore} min before`
                    : ""}
                  {studentView
                    ? Number.isFinite(limit)
                      ? ` · Up to ${limit} slot${limit === 1 ? "" : "s"} per student`
                      : " · Unlimited slots per student"
                    : Number.isFinite(limit)
                      ? ` · Max ${limit} slot${limit === 1 ? "" : "s"} / student`
                      : " · Unlimited slots / student"}
                </>
              );
              return (
                <div key={group.id} className="rounded-xl border border-gray-200">
                  <div className="flex items-start gap-1 p-3 sm:p-4">
                    {!studentView && (
                      <button
                        type="button"
                        className="mt-0.5 rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-expanded={open}
                        aria-controls={`appointment-group-slots-${group.id}`}
                        aria-label={open ? `Collapse ${group.title}` : `Expand ${group.title}`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {studentView ? (
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-canvas-grayDark">{group.title}</p>
                        <p className="text-xs text-gray-500">{meta}</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md px-0.5 text-left hover:bg-gray-50"
                        aria-expanded={open}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <p className="font-semibold text-canvas-grayDark">{group.title}</p>
                        <p className="text-xs text-gray-500">{meta}</p>
                        {!open && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {slots.length} time{slots.length === 1 ? "" : "s"}
                            {` · ${openCount} open`}
                            {bookedCount > 0 ? ` · ${bookedCount} booked` : ""}
                            {htmlPreview(group.description).text
                              ? ` · ${htmlPreview(group.description, 80).text}`
                              : ""}
                          </p>
                        )}
                      </button>
                    )}
                    <div className="flex shrink-0 gap-2">
                      {held.length > 0 && studentView && (
                        <button
                          type="button"
                          onClick={() => cancel(group)}
                          disabled={Boolean(cancelGate && !cancelGate.ok)}
                          title={cancelGate && !cancelGate.ok ? cancelGate.reason : undefined}
                          className="btn-canvas-secondary px-2.5 py-1 text-xs disabled:opacity-40"
                        >
                          {held.length > 1 ? "Cancel all my sign-ups" : "Cancel my sign-up"}
                        </button>
                      )}
                      {!studentView && (
                        <AppointmentIcsActions group={group} compact />
                      )}
                      {!studentView && onEditGroup && (
                        <button
                          type="button"
                          onClick={() => onEditGroup(group)}
                          className="btn-canvas-secondary px-2.5 py-1 text-xs"
                        >
                          Edit
                        </button>
                      )}
                      {!studentView && group.published && (
                        <button
                          type="button"
                          onClick={() => {
                            closeAppointmentGroup(group.courseId, group.id);
                            notifyAppointmentActivity({
                              audience: "student",
                              title: `Sign-ups closed: ${group.title}`,
                              body: `${group.title} is no longer accepting new sign-ups.`,
                              courseId: group.courseId,
                              href: hrefFor(group),
                            });
                            showToast("Sign-ups closed", "neutral");
                            refresh();
                          }}
                          className="btn-canvas-secondary px-2.5 py-1 text-xs"
                        >
                          Close sign-ups
                        </button>
                      )}
                    </div>
                  </div>
                  {open && htmlPreview(group.description).text ? (
                    <div className="border-t border-gray-100 px-3 py-2 sm:px-4">
                      <RichContentViewer
                        html={group.description ?? ""}
                        courseId={group.courseId}
                        className="!text-sm !leading-6 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5"
                      />
                    </div>
                  ) : null}
                  {open && (
                  <ul
                    id={`appointment-group-slots-${group.id}`}
                    className="mt-0 space-y-1.5 border-t border-gray-100 px-3 pb-3 pt-2 sm:px-4"
                  >
                    {slots.map((slot) => {
                      const full = !slotHasCapacity(slot);
                      const selected = held.some((s) => s.id === slot.id && s.signups.some((x) => x.studentId === user.id));
                      const waitlisted = (slot.waitlist ?? []).some((s) => s.studentId === user.id);
                      return (
                        <li
                          key={slot.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                            selected ? "bg-canvas-blueTint" : "bg-gray-50"
                          }`}
                        >
                          <button
                            type="button"
                            data-testid="appointment-slot-row"
                            aria-label={`Open ${formatAppointmentSlotRange(slot.startAt, slot.endAt)}`}
                            onClick={() => onOpenSlot?.(group, slot)}
                            className="min-w-0 flex-1 rounded-md px-0.5 text-left hover:text-canvas-blue"
                          >
                            {formatAppointmentSlotRange(slot.startAt, slot.endAt)}
                            <span className="ml-2 text-xs text-gray-500">
                              {slot.signups.length}/{slot.maxParticipants}
                              {(slot.waitlist?.length ?? 0) > 0 ? ` · waitlist ${slot.waitlist.length}` : ""}
                              {!studentView && slot.signups.length > 0
                                ? ` · ${slot.signups.map((s) => s.studentName).join(", ")}`
                                : ""}
                              {!studentView && (slot.waitlist?.length ?? 0) > 0
                                ? ` · waiting: ${slot.waitlist.map((s) => s.studentName).join(", ")}`
                                : ""}
                            </span>
                          </button>
                          {studentView && (
                            <button
                              type="button"
                              disabled={waitlisted}
                              onClick={() => (selected ? cancel(group, slot.id) : book(group, slot.id))}
                              className={
                                selected
                                  ? "text-xs font-medium text-canvas-blue"
                                  : "btn-canvas-primary px-2 py-1 text-xs disabled:opacity-40"
                              }
                            >
                              {selected ? "Selected" : waitlisted ? "Waitlisted" : full ? "Join waitlist" : "Sign up"}
                            </button>
                          )}
                          {!studentView &&
                            slot.signups.map((s) => (
                              <span key={s.studentId} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-xs font-medium text-amber-800"
                                  onClick={() => waitlistConfirmed(group, slot, s.studentId)}
                                >
                                  Waitlist {s.studentName}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-canvas-red"
                                  onClick={() => {
                                    setDropComment("");
                                    setDropTarget({
                                      group,
                                      slot,
                                      studentId: s.studentId,
                                      studentName: s.studentName,
                                    });
                                  }}
                                >
                                  Drop {s.studentName}
                                </button>
                              </span>
                            ))}
                          {!studentView &&
                            (slot.waitlist ?? []).map((s) => (
                              <button
                                key={`admit-${s.studentId}`}
                                type="button"
                                className="text-xs font-medium text-canvas-blue"
                                onClick={() => admit(group, slot, s.studentId)}
                              >
                                Allow {s.studentName} to attend
                              </button>
                            ))}
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-canvas-secondary">
            Close
          </button>
        </div>
      </div>
    </CanvasModal>
    <ConfirmActionModal
      isOpen={Boolean(dropTarget)}
      title="Drop student?"
      description={
        dropTarget
          ? `Remove ${dropTarget.studentName} from this meeting. A comment is required and will be sent to the student.`
          : undefined
      }
      confirmText="Drop"
      tone="danger"
      confirmDisabled={!dropComment.trim()}
      onClose={() => {
        setDropTarget(null);
        setDropComment("");
      }}
      onConfirm={confirmDrop}
    >
      <label className="block">
        <span className="form-label">Comment</span>
        <textarea
          value={dropComment}
          onChange={(e) => setDropComment(e.target.value)}
          rows={3}
          className="form-input"
          placeholder="Reason for dropping this sign-up"
        />
      </label>
    </ConfirmActionModal>
    <ConfirmActionModal
      isOpen={Boolean(cancelTarget)}
      title="Cancel this sign-up?"
      description="A comment is required and will be sent to your instructor."
      confirmText="Cancel sign-up"
      tone="danger"
      confirmDisabled={!cancelComment.trim()}
      onClose={() => {
        setCancelTarget(null);
        setCancelComment("");
      }}
      onConfirm={confirmCancel}
    >
      <label className="block">
        <span className="form-label">Comment</span>
        <textarea
          value={cancelComment}
          onChange={(e) => setCancelComment(e.target.value)}
          rows={3}
          className="form-input"
          placeholder="Reason for canceling"
        />
      </label>
    </ConfirmActionModal>
    </>
  );
}
