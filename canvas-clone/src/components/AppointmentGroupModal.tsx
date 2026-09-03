import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import CanvasModal from "./CanvasModal";
import ConfirmActionModal from "./ConfirmActionModal";
import DateTimeField from "./DateTimeField";
import RichContentEditor from "./RichContentEditor";
import AppointmentIcsActions from "./AppointmentIcsActions";
import { useToast } from "./ui/Toast";
import {
  deleteAppointmentGroup,
  duplicateAppointmentGroup,
  findOverlappingAppointmentSlots,
  generateAppointmentSlots,
  newAppointmentGroupId,
  upsertAppointmentGroup,
  type AppointmentGroup,
  type AppointmentSlot,
} from "../utils/appointmentGroups";
import { loadCourses } from "../utils/coursesStore";
import { loadRoster } from "../utils/courseRoster";
import { loadSections } from "../utils/courseSections";
import { htmlPreview } from "../utils/htmlPreview";

const SLOT_LIMIT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

function formatSlot(slot: AppointmentSlot) {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  return `${start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function AppointmentGroupModal({
  initial,
  defaultCourseId,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial?: AppointmentGroup;
  defaultCourseId?: string;
  onClose: () => void;
  onSaved?: (group: AppointmentGroup) => void;
  onDeleted?: () => void;
}) {
  const { showToast } = useToast();
  const courses = loadCourses().filter((c) => !c.archived);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [courseId, setCourseId] = useState(
    initial?.courseId ?? defaultCourseId ?? courses[0]?.id ?? "",
  );
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() => {
    const primary = initial?.courseId ?? defaultCourseId ?? courses[0]?.id ?? "";
    const extras = (initial?.courseIds ?? []).filter((id) => id && id !== primary);
    return primary ? [primary, ...extras] : extras;
  });
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [slots, setSlots] = useState<AppointmentSlot[]>(initial?.slots ?? []);
  const [windowStart, setWindowStart] = useState<number | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(13, 0, 0, 0);
    return d.getTime();
  });
  const [windowEnd, setWindowEnd] = useState<number | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(15, 0, 0, 0);
    return d.getTime();
  });
  const [duration, setDuration] = useState("20");
  const [maxPerSlot, setMaxPerSlot] = useState("1");
  const [repeatWeeks, setRepeatWeeks] = useState("1");
  const [cancelUntil, setCancelUntil] = useState(
    typeof initial?.cancelUntilMinutesBefore === "number"
      ? String(initial.cancelUntilMinutesBefore)
      : "",
  );
  const [maxSlotsPerStudent, setMaxSlotsPerStudent] = useState(
    initial?.maxSlotsPerStudent === 0 ? "unlimited" : String(initial?.maxSlotsPerStudent ?? 1),
  );
  const [bufferMinutes, setBufferMinutes] = useState(
    typeof initial?.bufferMinutes === "number" ? String(initial.bufferMinutes) : "",
  );
  const [sectionIds, setSectionIds] = useState<string[]>(initial?.sectionIds ?? []);
  const [allowedStudentIds, setAllowedStudentIds] = useState<string[]>(
    initial?.allowedStudentIds ?? [],
  );
  const [generateOverlap, setGenerateOverlap] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = Boolean(title.trim() && courseId && slots.length > 0);
  const windowError =
    typeof windowStart === "number" &&
    typeof windowEnd === "number" &&
    windowEnd <= windowStart;
  const allCoursesSelected =
    courses.length > 0 && courses.every((c) => selectedCourseIds.includes(c.id));
  const courseSummary = allCoursesSelected
    ? "All courses"
    : selectedCourseIds
        .map((id) => courses.find((c) => c.id === id)?.short_name)
        .filter(Boolean)
        .join(", ") || "Select courses";

  const linkedSections = useMemo(() => {
    return selectedCourseIds.flatMap((id) => {
      const short = courses.find((c) => c.id === id)?.short_name ?? "Course";
      return loadSections(id).map((section) => ({
        ...section,
        courseId: id,
        label: selectedCourseIds.length > 1 ? `${short} · ${section.name}` : section.name,
      }));
    });
  }, [selectedCourseIds, courses]);

  const rosterStudents = useMemo(() => {
    const seen = new Set<string>();
    const people: { id: string; name: string }[] = [];
    for (const id of selectedCourseIds) {
      for (const member of loadRoster(id).filter((m) => m.role === "student")) {
        if (seen.has(member.id)) continue;
        seen.add(member.id);
        people.push({ id: member.id, name: member.name });
      }
    }
    return people.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCourseIds]);

  useEffect(() => {
    if (!courseMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!courseMenuRef.current?.contains(e.target as Node)) setCourseMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [courseMenuOpen]);

  const toggleCourse = (id: string) => {
    if (initial && id === initial.courseId) return;
    setSelectedCourseIds((prev) => {
      const on = prev.includes(id);
      if (on) {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) return prev;
        if (id === courseId) setCourseId(next[0]);
        return next;
      }
      return [...prev, id];
    });
  };

  const toggleAllCourses = () => {
    if (allCoursesSelected) {
      const keep = initial?.courseId ?? courseId;
      setSelectedCourseIds(keep ? [keep] : []);
      if (keep) setCourseId(keep);
      return;
    }
    setSelectedCourseIds(courses.map((c) => c.id));
  };

  const generate = () => {
    if (typeof windowStart !== "number" || typeof windowEnd !== "number" || windowError) return;
    const next = generateAppointmentSlots({
      windowStart,
      windowEnd,
      durationMinutes: Math.max(5, Number(duration) || 20),
      maxParticipants: Math.max(1, Number(maxPerSlot) || 1),
      repeatWeeks: Math.max(1, Number(repeatWeeks) || 1),
      bufferMinutes: Math.max(0, Number(bufferMinutes) || 0),
    });
    const ignoreSlotIds = [
      ...slots.map((s) => s.id),
      ...(initial?.slots.map((s) => s.id) ?? []),
    ];
    const hits = next.flatMap((slot) =>
      findOverlappingAppointmentSlots(slot.startAt, slot.endAt, {
        ignoreSlotIds,
        courseIds: selectedCourseIds.length ? selectedCourseIds : [courseId],
      }),
    );
    const titles = [...new Set(hits.map((h) => h.groupTitle))];
    setGenerateOverlap(titles);
    setSlots(next);
  };

  const signupCount = useMemo(
    () => slots.reduce((n, s) => n + s.signups.length, 0),
    [slots],
  );

  const save = () => {
    if (!canSave) return;
    const minutes = Number(cancelUntil);
    const group = upsertAppointmentGroup({
      id: initial?.id ?? newAppointmentGroupId(),
      courseId,
      courseIds: selectedCourseIds.filter((id) => id && id !== courseId),
      title,
      location,
      description: htmlPreview(description).text ? description.trim() : undefined,
      published,
      cancelUntilMinutesBefore:
        Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : undefined,
      maxSlotsPerStudent:
        maxSlotsPerStudent === "unlimited"
          ? 0
          : Math.max(1, Math.floor(Number(maxSlotsPerStudent) || 1)),
      sectionIds: sectionIds.length ? sectionIds : undefined,
      allowedStudentIds: allowedStudentIds.length ? allowedStudentIds : undefined,
      bufferMinutes:
        Number.isFinite(Number(bufferMinutes)) && Number(bufferMinutes) > 0
          ? Math.floor(Number(bufferMinutes))
          : undefined,
      slots,
    });
    onSaved?.(group);
    onClose();
  };

  const duplicate = () => {
    if (!initial) return;
    const copy = duplicateAppointmentGroup(initial.courseId, initial.id);
    if (!copy) {
      showToast("Could not duplicate this group.", "negative");
      return;
    }
    showToast("Duplicated as an unpublished copy one week later", "positive", "published");
    onSaved?.(copy);
    onClose();
  };

  const remove = () => {
    if (!initial) return;
    deleteAppointmentGroup(initial.courseId, initial.id);
    onDeleted?.();
    onClose();
  };

  return (
    <>
    <CanvasModal
      title={initial ? "Edit appointment group" : "New appointment group"}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          {initial ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={duplicate}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-canvas-blueTint hover:text-canvas-blue"
                aria-label="Duplicate group"
                title="Duplicate group"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-2 text-canvas-red transition hover:bg-red-50"
                aria-label="Delete group"
                title="Delete group"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="min-w-0 text-xs text-gray-500">
              {canSave ? "Ready to publish." : "Add a title and at least one slot to save."}
            </p>
          )}
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {initial && slots.length > 0 && (
              <AppointmentIcsActions
                group={{
                  ...initial,
                  title: title.trim() || initial.title,
                  location,
                  slots,
                }}
                compact
              />
            )}
            <button type="button" onClick={onClose} className="btn-canvas-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={save}
              className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="form-label">Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Office hours"
            className="form-input"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div ref={courseMenuRef}>
            <div className="form-label">Course</div>
            <button
              type="button"
              onClick={() => setCourseMenuOpen((open) => !open)}
              className="form-input flex w-full items-center justify-between text-left"
              aria-label="Courses"
              aria-haspopup="listbox"
              aria-expanded={courseMenuOpen}
            >
              <span className="truncate">{courseSummary}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
            </button>
            {courseMenuOpen && (
              <div className="mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-arc-paper py-1 shadow-sm">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={allCoursesSelected}
                    onChange={toggleAllCourses}
                  />
                  <span className="font-medium text-canvas-grayDark">All courses</span>
                </label>
                <div className="my-1 border-t border-gray-100" />
                {courses.map((c) => {
                  const locked = Boolean(initial && c.id === initial.courseId);
                  const checked = selectedCourseIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 ${
                        locked ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleCourse(c.id)}
                      />
                      <span className="text-canvas-grayDark">{c.short_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div className="form-label">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Instructor office / Zoom"
              className="form-input"
            />
          </div>
        </div>
        <RichContentEditor
          label="Details"
          value={initial?.description ?? ""}
          onChange={setDescription}
          height={320}
          courseId={courseId || undefined}
          mountKey={initial?.id ?? `new-appointment-group:${courseId}`}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-start">
          <label className="form-checkbox-label rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span>
              <span className="block font-medium text-canvas-grayDark">Published</span>
              <span className="block text-xs text-gray-500">Students can sign up</span>
            </span>
          </label>
          <div>
            <div className="form-label">Cancel cutoff (minutes before start)</div>
            <input
              type="number"
              min={0}
              value={cancelUntil}
              onChange={(e) => setCancelUntil(e.target.value)}
              placeholder="Until the slot starts"
              className="form-input"
            />
          </div>
        </div>

        <div>
          <div className="form-label">Max slots per student</div>
          <select
            value={maxSlotsPerStudent}
            onChange={(e) => setMaxSlotsPerStudent(e.target.value)}
            className="form-input"
            aria-label="Max slots per student"
          >
            <option value="unlimited">Unlimited</option>
            {SLOT_LIMIT_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
            {maxSlotsPerStudent !== "unlimited" &&
              !SLOT_LIMIT_OPTIONS.includes(Number(maxSlotsPerStudent) as (typeof SLOT_LIMIT_OPTIONS)[number]) &&
              Number(maxSlotsPerStudent) > 0 && (
                <option value={maxSlotsPerStudent}>{maxSlotsPerStudent}</option>
              )}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            How many different times a student can reserve in this group. Unlimited lets them take
            every remaining time. It does not change how many people fit in one time — that is
            Seats per time slot below.
          </p>
        </div>

        {linkedSections.length > 0 && (
          <div>
            <div className="form-label">Limit to sections</div>
            <p className="mb-1.5 text-xs text-gray-500">
              Leave unchecked to include every section.
            </p>
            <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-gray-200 bg-arc-paper p-2">
              {linkedSections.map((section) => (
                <label key={`${section.courseId}:${section.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sectionIds.includes(section.id)}
                    onChange={() =>
                      setSectionIds((prev) =>
                        prev.includes(section.id)
                          ? prev.filter((id) => id !== section.id)
                          : [...prev, section.id],
                      )
                    }
                  />
                  <span className="text-canvas-grayDark">{section.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {rosterStudents.length > 0 && (
          <div>
            <div className="form-label">Limit to students</div>
            <p className="mb-1.5 text-xs text-gray-500">
              Leave unchecked to include every student (still subject to sections).
            </p>
            <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-gray-200 bg-arc-paper p-2">
              {rosterStudents.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowedStudentIds.includes(student.id)}
                    onChange={() =>
                      setAllowedStudentIds((prev) =>
                        prev.includes(student.id)
                          ? prev.filter((id) => id !== student.id)
                          : [...prev, student.id],
                      )
                    }
                  />
                  <span className="text-canvas-grayDark">{student.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <section className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="form-section-title">Generate time slots</div>
              <p className="mt-0.5 text-xs text-gray-500">
                Split a window into bookable appointments.
              </p>
            </div>
            {slots.length > 0 && (
              <button
                type="button"
                onClick={() => setSlots([])}
                className="shrink-0 text-xs font-medium text-gray-500 hover:text-canvas-red"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <DateTimeField
              compact
              label="Window starts"
              value={windowStart}
              onChange={setWindowStart}
            />
            <DateTimeField
              compact
              label="Window ends"
              value={windowEnd}
              onChange={setWindowEnd}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
            <label>
              <span className="form-label">Minutes per slot</span>
              <input
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="form-input"
              />
            </label>
            <label>
              <span className="form-label">Buffer (minutes)</span>
              <input
                type="number"
                min={0}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                placeholder="0"
                className="form-input"
              />
            </label>
            <label>
              <span className="form-label">Seats per time slot</span>
              <input
                type="number"
                min={1}
                value={maxPerSlot}
                onChange={(e) => setMaxPerSlot(e.target.value)}
                className="form-input"
              />
            </label>
            <label>
              <span className="form-label">Repeat weeks</span>
              <input
                type="number"
                min={1}
                max={12}
                value={repeatWeeks}
                onChange={(e) => setRepeatWeeks(e.target.value)}
                className="form-input"
              />
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={windowError || windowStart == null || windowEnd == null}
              className="btn-canvas-primary col-span-2 h-[38px] sm:col-span-1 sm:px-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate slots
            </button>
          </div>
          {windowError && (
            <p className="text-sm text-red-600">Window end must be after start.</p>
          )}
          {generateOverlap.length > 0 && (
            <p className="text-sm text-amber-800">
              These times overlap {generateOverlap.join(", ")}. You can still save.
            </p>
          )}

          <div className="border-t border-gray-200/80 pt-2">
            {slots.length === 0 ? (
              <p className="text-xs text-gray-500">
                0 slots — generate a window to publish sign-ups.
              </p>
            ) : (
              <>
              <div className="mb-1.5 text-xs font-medium text-gray-600">
                {slots.length} slot{slots.length === 1 ? "" : "s"}
                {signupCount > 0
                  ? ` · ${signupCount} sign-up${signupCount === 1 ? "" : "s"}`
                  : ""}
              </div>
              <ul className="max-h-28 divide-y divide-gray-100 overflow-auto rounded-md bg-arc-paper text-sm ring-1 ring-gray-200">
                {slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex items-start justify-between gap-2 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-canvas-grayDark">
                        {formatSlot(slot)}
                      </span>
                      {slot.signups.length > 0 && (
                        <span className="block truncate text-xs text-gray-500">
                          {slot.signups.map((s) => s.studentName).join(", ")}
                        </span>
                      )}
                      <input
                        value={slot.location ?? ""}
                        onChange={(e) =>
                          setSlots(
                            slots.map((s) =>
                              s.id === slot.id ? { ...s, location: e.target.value } : s,
                            ),
                          )
                        }
                        placeholder={
                          location.trim() ? `Inherit · ${location.trim()}` : "Slot location or Zoom URL"
                        }
                        className="form-input mt-1 h-7 py-0 text-xs"
                        aria-label={`Location for ${formatSlot(slot)}`}
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => setSlots(slots.filter((s) => s.id !== slot.id))}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-canvas-red"
                      aria-label="Remove slot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>
        </section>
      </div>
    </CanvasModal>
    <ConfirmActionModal
      isOpen={confirmDelete}
      title="Delete appointment group?"
      description="This removes every time slot and sign-up in the group."
      confirmText="Delete group"
      tone="danger"
      onClose={() => setConfirmDelete(false)}
      onConfirm={remove}
    />
    </>
  );
}
