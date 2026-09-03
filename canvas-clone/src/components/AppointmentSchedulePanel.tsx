import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import {
  APPOINTMENT_GROUPS_CHANGED_EVENT,
  buildAppointmentAttendanceCsv,
  effectiveAppointmentLocation,
  formatAppointmentSlotRange,
  listAppointmentSchedule,
  slotOccupancy,
  type AppointmentScheduleRow,
} from "../utils/appointmentGroups";
import { loadCourses } from "../utils/coursesStore";
import { downloadTextFile } from "../utils/icsFormat";
import { notify } from "./ui/Toast";

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ms: number, days: number) {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function occupancyLine(row: AppointmentScheduleRow) {
  const occ = slotOccupancy(row.slot);
  const wait = occ.waitlisted ? ` · w${occ.waitlisted}` : "";
  const unmarked = row.unmarked > 0 ? ` · ${row.unmarked} unmarked` : "";
  return `${occ.taken}/${occ.max}${wait}${unmarked}`;
}

export default function AppointmentSchedulePanel({
  courseIds,
  onOpenSlot,
}: {
  courseIds: string[];
  onOpenSlot: (row: { courseId: string; groupId: string; slotId: string }) => void;
}) {
  const [range, setRange] = useState<"today" | "week">("today");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, refresh);
  }, []);

  const now = Date.now();
  const rangeStart = startOfDay(now);
  const rangeEnd = range === "today" ? addDays(rangeStart, 1) : addDays(rangeStart, 7);
  const rows = useMemo(
    () => listAppointmentSchedule(courseIds, rangeStart, rangeEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseIds.join(","), range, tick, rangeStart, rangeEnd],
  );
  const courses = loadCourses();
  const rangeLabel =
    range === "today"
      ? new Date(rangeStart).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : `${new Date(rangeStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(rangeEnd - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const printSheet = () => {
    const previous = document.title;
    document.title = `Sign-up sheet — ${rangeLabel}`;
    document.body.classList.add("appointment-signup-printing");
    const cleanup = () => {
      document.title = previous;
      document.body.classList.remove("appointment-signup-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const downloadCsv = () => {
    const stamp = new Date(rangeStart).toISOString().slice(0, 10);
    downloadTextFile(
      `appointments-${range === "today" ? stamp : `${stamp}-7d`}.csv`,
      buildAppointmentAttendanceCsv(rows),
      "text/csv",
    );
    notify("Sign-up sheet downloaded", "files");
  };

  return (
    <div className="rounded-xl bg-arc-paper p-3 ring-1 ring-canvas-border/80">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-canvas-grayDark">Schedule</h2>
        <div className="flex rounded-md bg-gray-100 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setRange("today")}
            className={`rounded px-1.5 py-0.5 ${range === "today" ? "bg-arc-paper text-canvas-grayDark shadow-sm" : "text-gray-500"}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setRange("week")}
            className={`rounded px-1.5 py-0.5 ${range === "week" ? "bg-arc-paper text-canvas-grayDark shadow-sm" : "text-gray-500"}`}
          >
            Next 7 days
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-xs text-gray-500">No appointment slots in this range.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {rows.map((row) => {
            const occ = occupancyLine(row);
            return (
              <li key={`${row.group.id}:${row.slot.id}`}>
                <button
                  type="button"
                  onClick={() =>
                    onOpenSlot({
                      courseId: row.group.courseId,
                      groupId: row.group.id,
                      slotId: row.slot.id,
                    })
                  }
                  className="block w-full rounded-lg px-1.5 py-1.5 text-left hover:bg-canvas-grayLight"
                >
                  <p className="text-[11px] font-medium text-gray-400">
                    {new Date(row.slot.startAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="truncate text-sm font-medium text-canvas-grayDark">
                    {row.group.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{occ}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={printSheet}
          className="inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
        >
          <Printer className="h-3.5 w-3.5" />
          Print sign-up sheet
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download attendance CSV
          </button>
        )}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <section className="appointment-signup-print-sheet" aria-hidden="true">
            <header className="calendar-print-masthead">
              <p className="calendar-print-kicker">CourseArc appointments</p>
              <h1>Sign-up sheet</h1>
              <p>{rangeLabel}</p>
            </header>
            {rows.length === 0 ? (
              <p className="calendar-print-empty">No appointment slots in this range.</p>
            ) : (
              rows.map((row) => {
                const location = effectiveAppointmentLocation(row.group, row.slot);
                const course = courses.find((c) => c.id === row.group.courseId);
                return (
                  <div key={`print-${row.group.id}-${row.slot.id}`} className="appointment-signup-slot">
                    <h3>
                      {row.group.title}
                      {course ? ` · ${course.short_name}` : ""}
                    </h3>
                    <p>
                      {formatAppointmentSlotRange(row.slot.startAt, row.slot.endAt)}
                      {location ? ` · ${location}` : ""}
                      {` · ${occupancyLine(row)}`}
                    </p>
                    <p>
                      <strong>Confirmed: </strong>
                      {row.slot.signups.length
                        ? row.slot.signups
                            .map((s) => {
                              const mark = row.slot.attendanceByStudent?.[s.studentId];
                              return mark ? `${s.studentName} (${mark})` : s.studentName;
                            })
                            .join(", ")
                        : "—"}
                    </p>
                    <p>
                      <strong>Waitlist: </strong>
                      {row.slot.waitlist?.length
                        ? row.slot.waitlist.map((s) => s.studentName).join(", ")
                        : "—"}
                    </p>
                  </div>
                );
              })
            )}
          </section>,
          document.body,
        )}
    </div>
  );
}
