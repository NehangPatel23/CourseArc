import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarCheck, Trash2 } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import { COURSE_ROSTER_CHANGED_EVENT, loadRoster } from "../utils/courseRoster";
import {
  ATTENDANCE_CHANGED_EVENT,
  deleteAttendanceSession,
  loadAttendanceSessions,
  markAllPresent,
  ROLL_CALL_LABELS,
  studentAttendanceSummary,
  todayIsoDate,
  upsertAttendanceSession,
  type AttendanceSession,
  type RollCallStatus,
} from "../utils/attendance";
import { loadUser } from "../utils/userStore";

const STATUSES: RollCallStatus[] = ["present", "absent", "late", "excused"];

function isoDateToLocalMs(iso: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function localMsToIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export default function AttendancePage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { canEditCourseContent: isStaff } = usePermissions();
  const { showToast } = useToast();
  const me = loadUser();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSessions(loadAttendanceSessions(effectiveCourseId));
    refresh();
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, refresh);
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, refresh);
      window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId]);

  const students = useMemo(
    () => loadRoster(effectiveCourseId).filter((m) => m.role === "student"),
    [effectiveCourseId, sessions],
  );

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!isStaff) {
    const summary = studentAttendanceSummary(effectiveCourseId, me.id);
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
          <PageIdentityHeader
            size="md"
            icon={CalendarCheck}
            label="Attendance"
            title="Your attendance"
            description="Roll taken by your instructor for this course."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {(Object.keys(ROLL_CALL_LABELS) as RollCallStatus[]).map((status) => (
              <div key={status} className="rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {ROLL_CALL_LABELS[status]}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-canvas-grayDark">
                  {summary.counts[status]}
                </p>
              </div>
            ))}
          </div>
          {summary.sessions.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
              No attendance sessions yet.
            </p>
          ) : (
            <table className="mt-6 w-full max-w-xl text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 font-semibold">Date</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2.5 text-canvas-grayDark">
                      {s.title ? `${s.date} · ${s.title}` : s.date}
                    </td>
                    <td className="py-2.5 text-gray-600">
                      {s.records[me.id] ? ROLL_CALL_LABELS[s.records[me.id]!] : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0];

  const takeToday = () => {
    const existing = sessions.find((s) => s.date === todayIsoDate());
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const created = upsertAttendanceSession(effectiveCourseId, {
      date: todayIsoDate(),
      records: {},
    });
    setSelectedId(created.id);
    showToast("Started today’s roll call", "positive");
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon={CalendarCheck}
          label="Attendance"
          title="Roll call"
          description="Mark students present, absent, late, or excused. Students see their own record."
          actions={
            <button type="button" onClick={takeToday} className="btn-canvas-primary text-sm">
              Take today
            </button>
          }
        />

        {sessions.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-500">
            No sessions yet. Take today’s roll to start.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    selected?.id === s.id
                      ? "bg-canvas-blueTint font-medium text-canvas-blue"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>
                    {s.date}
                    {s.title ? ` · ${s.title}` : ""}
                  </span>
                </button>
              ))}
            </aside>
            {selected && (
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="w-[10.75rem] shrink-0">
                    <DateTimeField
                      label="Session date"
                      hideLabel
                      dateOnly
                      compact
                      value={isoDateToLocalMs(selected.date)}
                      onChange={(ms) => {
                        if (!ms) return;
                        upsertAttendanceSession(effectiveCourseId, {
                          ...selected,
                          date: localMsToIsoDate(ms),
                        });
                      }}
                    />
                  </div>
                  <input
                    value={selected.title ?? ""}
                    onChange={(e) =>
                      upsertAttendanceSession(effectiveCourseId, {
                        ...selected,
                        title: e.target.value,
                      })
                    }
                    placeholder="Optional title (Lecture, Lab…)"
                    className="form-input h-9 max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      markAllPresent(effectiveCourseId, selected);
                      showToast("Marked everyone present", "positive");
                    }}
                    className="btn-canvas-secondary text-sm"
                  >
                    Mark all present
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(selected.id)}
                    className="rounded p-2 text-canvas-red hover:bg-red-50"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2.5 font-semibold">Student</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-canvas-grayDark">{s.name}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={selected.records[s.id] ?? ""}
                              onChange={(e) => {
                                const records = { ...selected.records };
                                const value = e.target.value as RollCallStatus | "";
                                if (!value) delete records[s.id];
                                else records[s.id] = value;
                                upsertAttendanceSession(effectiveCourseId, { ...selected, records });
                              }}
                              className="form-input h-9 w-40 py-1.5 leading-5"
                              aria-label={`Attendance for ${s.name}`}
                            >
                              <option value="">Unmarked</option>
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {ROLL_CALL_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmActionModal
        isOpen={Boolean(pendingDelete)}
        title="Delete this session?"
        description="Attendance marks for this date will be removed."
        confirmText="Delete"
        tone="danger"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteAttendanceSession(effectiveCourseId, pendingDelete);
          setPendingDelete(null);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
