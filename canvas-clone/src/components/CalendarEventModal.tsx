import { useState } from "react";
import CanvasModal from "./CanvasModal";
import { notify } from "./ui/Toast";
import DateTimeField from "./DateTimeField";
import {
  applyCustomEventDelete,
  applyCustomEventSave,
  canEditCustomCalendarEvent,
  upsertCustomCalendarEvent,
  type CustomCalendarEvent,
  type RecurrenceEditScope,
} from "../utils/calendarCustomEvents";
import { findOverlappingCalendarItems } from "../utils/calendarOverlap";
import { loadCourses } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";
import RichPromptField from "./RichPromptField";

const SCOPE_OPTIONS: { id: RecurrenceEditScope; label: string }[] = [
  { id: "this", label: "This event" },
  { id: "following", label: "This and following events" },
  { id: "all", label: "All events" },
];

export default function CalendarEventModal({
  initial,
  occurrenceStartAt,
  defaultCourseId,
  defaultStartAt,
  isInstructor,
  onClose,
  onSaved,
}: {
  initial?: CustomCalendarEvent;
  occurrenceStartAt?: number;
  defaultCourseId?: string | null;
  defaultStartAt?: number;
  isInstructor: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const user = loadUser();
  const courses = loadCourses().filter((c) => !c.archived);
  const editable = initial
    ? canEditCustomCalendarEvent(initial, user.id, isInstructor)
    : true;
  const duration =
    initial && typeof initial.endAt === "number" ? initial.endAt - initial.startAt : 0;
  const occStart = occurrenceStartAt ?? initial?.startAt ?? defaultStartAt ?? Date.now();
  const isSeries = Boolean(initial?.recurrence);
  const occEnd =
    duration > 0
      ? occStart + duration
      : initial?.endAt ?? (initial ? undefined : occStart + 60 * 60 * 1000);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [allDay, setAllDay] = useState(Boolean(initial?.allDay));
  const [startAt, setStartAt] = useState<number | undefined>(occStart);
  const [endAt, setEndAt] = useState<number | undefined>(occEnd);
  const [courseId, setCourseId] = useState<string>(
    initial?.courseId ?? (isInstructor ? (defaultCourseId ?? "") : ""),
  );
  const [repeat, setRepeat] = useState(Boolean(initial?.recurrence));
  const [repeatFreq, setRepeatFreq] = useState<"daily" | "weekly" | "monthly">(
    initial?.recurrence?.freq ?? "weekly",
  );
  const [repeatUntil, setRepeatUntil] = useState<number | undefined>(
    initial?.recurrence?.until,
  );
  const [scope, setScope] = useState<RecurrenceEditScope>(
    isSeries && occurrenceStartAt && occurrenceStartAt !== initial?.startAt ? "this" : "all",
  );
  const [overlapWarn, setOverlapWarn] = useState<string[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const canSave = Boolean(title.trim() && startAt && editable);

  const patch = () => ({
    title,
    description,
    location,
    allDay,
    startAt: startAt!,
    endAt: allDay ? undefined : endAt,
    courseId: courseId || null,
    recurrence:
      repeat && repeatUntil
        ? { freq: repeatFreq, until: repeatUntil }
        : undefined,
  });

  const persistEvent = () => {
    if (!canSave || !startAt) return;
    if (initial) {
      applyCustomEventSave(initial, occStart, isSeries ? scope : "all", patch());
    } else {
      upsertCustomCalendarEvent(patch());
    }
    onSaved?.();
    onClose();
    notify(initial ? "Event updated" : "Event saved", "saved");
  };

  const save = () => {
    if (!canSave || !startAt) return;
    const hits = findOverlappingCalendarItems(startAt, endAt ?? startAt + 30 * 60 * 1000, {
      ignoreEventId: initial?.id,
    });
    if (hits.length && !overlapWarn) {
      setOverlapWarn(hits.map((h) => h.title));
      return;
    }
    persistEvent();
  };

  const remove = () => {
    if (!initial) return;
    if (isSeries && !pendingDelete) {
      setPendingDelete(true);
      return;
    }
    applyCustomEventDelete(initial, occStart, isSeries ? scope : "all");
    onSaved?.();
    onClose();
    notify("Event deleted", "deleted");
  };

  return (
    <CanvasModal
      title={initial ? "Calendar event" : "New event"}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          {initial && editable ? (
            <button type="button" onClick={remove} className="text-sm font-medium text-canvas-red">
              {pendingDelete && isSeries ? "Confirm delete" : "Delete"}
            </button>
          ) : (
            <p className="min-w-0 text-xs text-gray-500">
              {canSave ? "" : "Add a title to save."}
            </p>
          )}
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className="btn-canvas-secondary">
              Close
            </button>
            {editable && (
              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            )}
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
            disabled={!editable}
            placeholder="Event title"
            className="form-input"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="form-label">Calendar</div>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!editable || !isInstructor}
              className="form-input"
            >
              <option value="">Personal calendar</option>
              {isInstructor &&
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_name} — {c.title}
                  </option>
                ))}
            </select>
          </div>
          <label className="form-checkbox-label h-[38px] rounded-lg border border-gray-200 bg-gray-50/80 px-3">
            <input
              type="checkbox"
              checked={allDay}
              disabled={!editable}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            All day
          </label>
        </div>
        {!isInstructor && (
          <p className="-mt-1 text-xs text-gray-500">
            Students can add personal events. Course events are created by instructors.
          </p>
        )}

        <div className={`grid grid-cols-1 gap-3 ${allDay ? "" : "sm:grid-cols-2"}`}>
          <DateTimeField
            compact
            dateOnly={allDay}
            label={allDay ? "Date" : "Starts"}
            value={startAt}
            onChange={setStartAt}
            disabled={!editable}
          />
          {!allDay && (
            <DateTimeField
              compact
              label="Ends"
              value={endAt}
              onChange={setEndAt}
              disabled={!editable}
            />
          )}
        </div>

        <div>
          <div className="form-label">Location</div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={!editable}
            placeholder="Optional"
            className="form-input"
          />
        </div>
        <div>
          <div className="form-label">Details</div>
          <RichPromptField
            value={description}
            onChange={setDescription}
            courseId={courseId || defaultCourseId || undefined}
            mountKey={`cal-${initial?.id ?? "new"}`}
            placeholder="Optional notes"
            height={140}
            disabled={!editable}
            alwaysEdit={editable}
          />
        </div>

        {editable && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              Repeat this event
            </label>
            {repeat && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                <div>
                  <div className="form-label">Repeats</div>
                  <select
                    value={repeatFreq}
                    onChange={(e) =>
                      setRepeatFreq(e.target.value as "daily" | "weekly" | "monthly")
                    }
                    className="form-input"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <DateTimeField
                  compact
                  dateOnly
                  label="Until"
                  value={repeatUntil}
                  onChange={setRepeatUntil}
                />
              </div>
            )}
          </div>
        )}

        {editable && isSeries && (
          <fieldset>
            <legend className="form-label">
              {pendingDelete ? "Delete" : "Save"} for
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map(({ id, label }) => (
                <label
                  key={id}
                  className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    scope === id
                      ? "border-blue-200 bg-blue-50 text-canvas-blue"
                      : "border-gray-200 bg-arc-paper text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="recurrence-scope"
                    className="sr-only"
                    checked={scope === id}
                    onChange={() => setScope(id)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {overlapWarn && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Overlaps {overlapWarn.join(", ")}. Save anyway to confirm.
          </p>
        )}
      </div>
    </CanvasModal>
  );
}
