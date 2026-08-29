import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  MapPin,
  MessageCircle,
  NotebookPen,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import AppointmentIcsActions from "./AppointmentIcsActions";
import CanvasModal from "./CanvasModal";
import ConfirmActionModal from "./ConfirmActionModal";
import DateTimeField from "./DateTimeField";
import RichContentEditor from "./RichContentEditor";
import RichContentViewer from "./RichContentViewer";
import UserAvatar from "./UserAvatar";
import { useToast } from "./ui/Toast";
import {
  APPOINTMENT_GROUPS_CHANGED_EVENT,
  addAppointmentSlotMessage,
  addStudentToWaitlist,
  admitWaitlistedStudent,
  appointmentMessageThread,
  canDeleteAppointmentSlotMessage,
  cancelAppointmentSignup,
  deleteAppointmentSlotMessage,
  dropStudentFromSlot,
  effectiveAppointmentLocation,
  formatAppointmentSlotRange,
  findOverlappingAppointmentSlots,
  getAppointmentSlot,
  moveConfirmedStudentToWaitlist,
  moveWaitlist,
  nextWaitlistedStudent,
  rescheduleAppointmentSlot,
  setAppointmentSlotAttendance,
  setAppointmentSlotDuration,
  setAppointmentSlotLocation,
  setAppointmentSlotNotes,
  setAppointmentSlotPrep,
  signUpForSlot,
  slotOccupancy,
  studentCanCancelSignup,
  studentHeldSlotsInGroup,
  studentSlotLimit,
  visibleAppointmentSlotMessages,
  type AppointmentAttendance,
  type AppointmentGroup,
  type AppointmentSlot,
} from "../utils/appointmentGroups";
import {
  notifyAppointmentActivity,
  notifyAppointmentRescheduled,
} from "../utils/appointmentNotify";
import { loadRoster } from "../utils/courseRoster";
import { findOverlappingCalendarItems } from "../utils/calendarOverlap";
import { htmlPreview } from "../utils/htmlPreview";
import { avatarColorForId, initialsFromName } from "../utils/avatar";
import { loadUser } from "../utils/userStore";
import {
  appointmentChatUnreadCount,
  getAppointmentChatSeenAt,
  markAppointmentChatSeen,
} from "../utils/appointmentChatSeen";

function isMeetingUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

function occupancyLabel(slot: AppointmentSlot) {
  const occ = slotOccupancy(slot);
  const wait = occ.waitlisted ? ` · w${occ.waitlisted}` : "";
  if (occ.full) return `Full · ${occ.taken}/${occ.max}${wait}`;
  if (occ.taken === 0) return `Open · ${occ.taken}/${occ.max} seats${wait}`;
  return `${occ.remaining} seat${occ.remaining === 1 ? "" : "s"} left · ${occ.taken}/${occ.max}${wait}`;
}

export default function AppointmentSlotModal({
  courseId,
  groupId,
  slotId,
  studentView,
  onClose,
  onChanged,
}: {
  courseId: string;
  groupId: string;
  slotId: string;
  studentView: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const user = loadUser();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"overview" | "notes" | "chat">("overview");
  const [prep, setPrep] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatTarget, setChatTarget] = useState<string>("");
  const [assignId, setAssignId] = useState("");
  const [overlapWarn, setOverlapWarn] = useState<string[] | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState<number | undefined>();
  const [locationDraft, setLocationDraft] = useState("");
  const [dropTarget, setDropTarget] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [dropComment, setDropComment] = useState("");
  const [cancelComment, setCancelComment] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [rescheduleOverlap, setRescheduleOverlap] = useState<string[] | null>(null);
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [absentOffer, setAbsentOffer] = useState<{
    studentId: string;
    studentName: string;
    nextName: string;
  } | null>(null);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(APPOINTMENT_GROUPS_CHANGED_EVENT, refresh);
  }, []);

  const loaded = useMemo(
    () => getAppointmentSlot(courseId, groupId, slotId),
    [courseId, groupId, slotId, tick],
  );
  const group = loaded?.group;
  const slot = loaded?.slot;

  useEffect(() => {
    if (!slot) return;
    setPrep(slot.prepByStudent?.[user.id] ?? "");
    setRescheduleAt(slot.startAt);
    setLocationDraft(slot.location ?? "");
    setDurationMinutes(String(Math.max(5, Math.round((slot.endAt - slot.startAt) / 60_000))));
  }, [slot?.id, slot?.prepByStudent, slot?.startAt, slot?.endAt, slot?.location, user.id]);

  useEffect(() => {
    if (tab !== "chat" || !slot) return;
    markAppointmentChatSeen(user.id, slot.id);
  }, [tab, slot, user.id, tick]);

  const roster = useMemo(
    () => (group ? loadRoster(group.courseId).filter((m) => m.role === "student") : []),
    [group, tick],
  );
  const assignedIds = new Set(
    [...(slot?.signups ?? []), ...(slot?.waitlist ?? [])].map((s) => s.studentId),
  );
  const assignable = roster.filter((m) => !assignedIds.has(m.id));

  const refresh = () => {
    setTick((n) => n + 1);
    onChanged?.();
  };

  const hrefFor = (g: AppointmentGroup) =>
    `/calendar?appointment=${encodeURIComponent(g.id)}&course=${encodeURIComponent(g.courseId)}&slot=${encodeURIComponent(slotId)}`;

  const book = (ignoreOverlap = false, student?: { id: string; name: string }) => {
    if (!group || !slot) return;
    const who = student ?? { id: user.id, name: user.name };
    if (!ignoreOverlap && who.id === user.id) {
      const hits = findOverlappingCalendarItems(slot.startAt, slot.endAt, {
        ignoreAppointmentSlotId: slot.id,
      });
      if (hits.length) {
        setOverlapWarn(hits.map((h) => h.title));
        return;
      }
    }
    const result = signUpForSlot(group.courseId, group.id, slot.id, who, {
      bypassEligibility: !studentView,
    });
    if (!result.ok) {
      showToast(result.reason, "negative");
      return;
    }
    showToast(
      result.waitlisted
        ? who.id === user.id
          ? "Added to waitlist"
          : `${who.name} added to waitlist`
        : who.id === user.id
          ? "Signed up"
          : `Reserved for ${who.name}`,
      result.waitlisted ? "neutral" : "positive",
    );
    if (!result.waitlisted) {
      notifyAppointmentActivity({
        audience: who.id === user.id ? "instructor" : "student",
        title: `Appointment booked: ${group.title}`,
        body: `${who.name} booked ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
        courseId: group.courseId,
        href: hrefFor(group),
      });
    }
    setOverlapWarn(null);
    setAssignId("");
    refresh();
  };

  const cancelMine = () => {
    if (!group) return;
    const gate = studentCanCancelSignup(group, user.id, Date.now(), slotId);
    if (!gate.ok) {
      showToast(gate.reason, "negative");
      return;
    }
    setConfirmCancel(true);
  };

  const confirmCancelMine = () => {
    if (!group || !cancelComment.trim()) return;
    const result = cancelAppointmentSignup(group.courseId, group.id, user.id, { slotId });
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
    setConfirmCancel(false);
    setCancelComment("");
    refresh();
  };

  const admit = (studentId: string) => {
    if (!group || !slot) return;
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

  const waitlistConfirmed = (studentId: string) => {
    if (!group || !slot) return;
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

  const addToWaitlist = (student: { id: string; name: string }) => {
    if (!group || !slot) return;
    const result = addStudentToWaitlist(group.courseId, group.id, slot.id, student);
    if (!result.ok) {
      showToast(result.reason, "negative");
      return;
    }
    showToast(`${result.studentName} was added to the waitlist`, "positive");
    notifyAppointmentActivity({
      audience: "student",
      title: `Waitlisted: ${group.title}`,
      body: `Your instructor added you to the waitlist for ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    setAssignId("");
    refresh();
  };

  const saveReschedule = (ignoreOverlap = false) => {
    if (!group || !slot || rescheduleAt == null || rescheduleAt === slot.startAt) return;
    const durationMs = Math.max(5 * 60 * 1000, slot.endAt - slot.startAt);
    if (!ignoreOverlap) {
      const hits = findOverlappingAppointmentSlots(rescheduleAt, rescheduleAt + durationMs, {
        ignoreSlotId: slot.id,
        courseIds: [group.courseId, ...(group.courseIds ?? [])],
      });
      if (hits.length) {
        setRescheduleOverlap([...new Set(hits.map((h) => h.groupTitle))]);
        return;
      }
    }
    const previousStartAt = slot.startAt;
    const previousEndAt = slot.endAt;
    const next = rescheduleAppointmentSlot(group.courseId, group.id, slot.id, rescheduleAt);
    if (!next) {
      showToast("Could not reschedule this meeting.", "negative");
      return;
    }
    const updated = next.slots.find((s) => s.id === slot.id);
    if (updated) notifyAppointmentRescheduled(next, updated, previousStartAt, previousEndAt);
    showToast("Meeting rescheduled", "positive");
    setRescheduleOverlap(null);
    refresh();
  };

  const saveDuration = () => {
    if (!group || !slot) return;
    const minutes = Math.max(5, Number(durationMinutes) || 5);
    const next = setAppointmentSlotDuration(group.courseId, group.id, slot.id, minutes);
    if (!next) {
      showToast("Could not update duration.", "negative");
      return;
    }
    showToast("Duration updated", "positive");
    refresh();
  };

  const saveLocation = () => {
    if (!group || !slot) return;
    setAppointmentSlotLocation(group.courseId, group.id, slot.id, locationDraft);
    refresh();
  };

  const confirmDrop = () => {
    if (!group || !slot || !dropTarget || !dropComment.trim()) return;
    const dropped = dropStudentFromSlot(
      group.courseId,
      group.id,
      slot.id,
      dropTarget.studentId,
    );
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

  const offerSeatFromAbsent = () => {
    if (!group || !slot || !absentOffer) return;
    const dropped = dropStudentFromSlot(
      group.courseId,
      group.id,
      slot.id,
      absentOffer.studentId,
    );
    notifyAppointmentActivity({
      audience: "student",
      title: `Appointment canceled: ${group.title}`,
      body: `Your instructor marked you absent and released your seat for ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
      courseId: group.courseId,
      href: hrefFor(group),
    });
    if (dropped?.promoted) {
      notifyAppointmentActivity({
        audience: "student",
        title: `You're in: ${group.title}`,
        body: `A seat opened in ${group.title} (${formatAppointmentSlotRange(slot.startAt, slot.endAt)}).`,
        courseId: group.courseId,
        href: hrefFor(group),
      });
    }
    showToast(
      dropped?.promoted ? `Seat offered to ${absentOffer.nextName}` : "Student dropped",
      "positive",
    );
    setAbsentOffer(null);
    refresh();
  };

  const copyDetails = async () => {
    if (!group || !slot) return;
    const lines = [
      group.title,
      formatAppointmentSlotRange(slot.startAt, slot.endAt),
      effectiveAppointmentLocation(group, slot)
        ? `Location: ${effectiveAppointmentLocation(group, slot)}`
        : "",
      occupancyLabel(slot),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Copied meeting details", "positive");
    } catch {
      showToast("Could not copy", "negative");
    }
  };

  if (!group || !slot) {
    return (
      <CanvasModal title="Meeting" onClose={onClose} size="md" layer="raised">
        <p className="text-sm text-gray-600">This meeting is no longer available.</p>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-canvas-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </CanvasModal>
    );
  }

  const occ = slotOccupancy(slot);
  const held = studentHeldSlotsInGroup(group, user.id);
  const selected = slot.signups.some((s) => s.studentId === user.id);
  const waitlisted = (slot.waitlist ?? []).some((s) => s.studentId === user.id);
  const waitlistPosition = (slot.waitlist ?? []).findIndex((s) => s.studentId === user.id) + 1;
  const meetingLocation = effectiveAppointmentLocation(group, slot);
  const onSlot = selected || waitlisted;
  const chatLocked = studentView && !onSlot;
  const chatPeople = [...slot.signups, ...(slot.waitlist ?? [])];
  const visibleChat = visibleAppointmentSlotMessages(slot, {
    studentView,
    studentId: user.id,
  });
  const defaultChatTarget =
    slot.signups[0]?.studentId ?? ((slot.waitlist?.length ?? 0) > 0 ? "waitlist" : "");
  const activeChatTarget = chatTarget || defaultChatTarget;
  const instructorThread =
    activeChatTarget === "waitlist"
      ? visibleChat.filter((m) => appointmentMessageThread(m, slot).kind === "waitlist")
      : activeChatTarget === "confirmed"
        ? visibleChat.filter((m) => appointmentMessageThread(m, slot).kind === "confirmed")
        : visibleChat.filter((m) => {
            const thread = appointmentMessageThread(m, slot);
            return thread.kind === "personal" && thread.studentId === activeChatTarget;
          });
  const shownChat = studentView ? visibleChat : instructorThread;
  const limit = studentSlotLimit(group);
  const atStudentLimit = held.length >= limit && !selected && !waitlisted;
  const notesEmpty = !htmlPreview(group.description).text && !htmlPreview(slot.notesHtml).text;
  const chatCount = studentView ? visibleChat.length : (slot.messages?.length ?? 0);
  const chatUnread = appointmentChatUnreadCount(
    visibleChat,
    getAppointmentChatSeenAt(user.id, slot.id),
  );

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Users },
    { id: "notes" as const, label: "Notes", icon: NotebookPen },
    { id: "chat" as const, label: "Chat", icon: MessageCircle },
  ];

  return (
    <>
    <CanvasModal title={group.title} onClose={onClose} size="lg" layer="raised">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-canvas-grayDark">
              <CalendarClock className="h-4 w-4 text-gray-400" />
              {formatAppointmentSlotRange(slot.startAt, slot.endAt)}
            </p>
            {meetingLocation && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400" />
                {isMeetingUrl(meetingLocation) ? (
                  <a
                    href={meetingLocation}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-canvas-blue hover:underline"
                  >
                    {meetingLocation}
                  </a>
                ) : (
                  meetingLocation
                )}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                Appointment
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  occ.full
                    ? "bg-gray-100 text-gray-600"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {occupancyLabel(slot)}
              </span>
              {waitlisted && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  You’re #{waitlistPosition} on the waitlist
                  {(slot.waitlist?.length ?? 0) > 1 ? ` of ${slot.waitlist.length}` : ""}
                </span>
              )}
              {selected && (
                <span className="rounded-full bg-canvas-blueTint px-2 py-0.5 text-[11px] font-semibold text-canvas-blue">
                  You’re signed up
                </span>
              )}
              {!Number.isFinite(limit)
                ? null
                : studentView && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      Up to {limit} slot{limit === 1 ? "" : "s"} / student
                    </span>
                  )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={copyDetails}
              className="btn-canvas-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
            <AppointmentIcsActions group={group} slot={slot} compact />
            {isMeetingUrl(meetingLocation) && (
              <a
                href={meetingLocation}
                target="_blank"
                rel="noreferrer"
                className="btn-canvas-primary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
              >
                <Video className="h-3.5 w-3.5" />
                Join
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                tab === item.id
                  ? "bg-white text-canvas-grayDark shadow-sm"
                  : "text-gray-500 hover:text-canvas-grayDark"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
              {item.id === "chat" && chatUnread > 0 ? (
                <span className="rounded-full bg-canvas-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {chatUnread}
                </span>
              ) : item.id === "chat" && chatCount > 0 ? (
                ` (${chatCount})`
              ) : (
                ""
              )}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            {overlapWarn && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This overlaps {overlapWarn.join(", ")}. Book anyway?
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-canvas-primary px-2 py-1 text-xs"
                    onClick={() => book(true)}
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

            {!studentView && (
              <div className="space-y-3 rounded-xl bg-gray-50 p-3">
                <DateTimeField
                  label="Reschedule"
                  value={rescheduleAt}
                  onChange={(ms) => setRescheduleAt(ms)}
                />
                {rescheduleAt != null && rescheduleAt !== slot.startAt && (
                  <button
                    type="button"
                    onClick={() => saveReschedule()}
                    className="btn-canvas-primary px-3 py-1.5 text-sm"
                  >
                    Save new time
                  </button>
                )}
                {rescheduleOverlap && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    This overlaps {rescheduleOverlap.join(", ")}. Save anyway?
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-canvas-primary px-2 py-1 text-xs"
                        onClick={() => saveReschedule(true)}
                      >
                        Save anyway
                      </button>
                      <button
                        type="button"
                        className="btn-canvas-secondary px-2 py-1 text-xs"
                        onClick={() => setRescheduleOverlap(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="form-label">Duration (minutes)</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={5}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      className="form-input"
                    />
                    {Math.max(5, Number(durationMinutes) || 5) !==
                      Math.max(5, Math.round((slot.endAt - slot.startAt) / 60_000)) && (
                      <button
                        type="button"
                        onClick={saveDuration}
                        className="btn-canvas-primary shrink-0 px-3 py-1.5 text-sm"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </label>
                <label className="block">
                  <span className="form-label">Location / meeting URL</span>
                  <input
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    onBlur={saveLocation}
                    placeholder={group.location?.trim() ? `Inherit · ${group.location}` : "Room or Zoom URL"}
                    className="form-input"
                  />
                </label>
              </div>
            )}

            {studentView && (
              <div className="flex flex-wrap gap-2">
                {selected || waitlisted ? (
                  <button
                    type="button"
                    onClick={cancelMine}
                    className="btn-canvas-secondary px-3 py-1.5 text-sm"
                  >
                    {waitlisted ? "Leave waitlist" : "Cancel my sign-up"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={atStudentLimit}
                    title={
                      atStudentLimit
                        ? "You already hold the maximum number of slots in this group."
                        : undefined
                    }
                    onClick={() => book()}
                    className="btn-canvas-primary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {occ.full ? "Join waitlist" : "Sign up"}
                  </button>
                )}
              </div>
            )}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Participants
              </h3>
              {slot.signups.length === 0 && (slot.waitlist?.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No one has reserved this time yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {slot.signups.map((s) => (
                    <li
                      key={s.studentId}
                      className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          name={s.studentName}
                          initials={initialsFromName(s.studentName)}
                          color={avatarColorForId(s.studentId)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-canvas-grayDark">
                            {s.studentName}
                          </p>
                          <p className="text-[11px] text-gray-500">Confirmed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!studentView && (
                          <select
                            aria-label={`Attendance for ${s.studentName}`}
                            className="form-input h-8 py-0 text-xs"
                            value={slot.attendanceByStudent?.[s.studentId] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value as AppointmentAttendance | "";
                              setAppointmentSlotAttendance(
                                group.courseId,
                                group.id,
                                slot.id,
                                s.studentId,
                                value || null,
                              );
                              if (value === "absent") {
                                const next = nextWaitlistedStudent(slot);
                                if (next) {
                                  setAbsentOffer({
                                    studentId: s.studentId,
                                    studentName: s.studentName,
                                    nextName: next.studentName,
                                  });
                                }
                              }
                              refresh();
                            }}
                          >
                            <option value="">Attendance</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                          </select>
                        )}
                        {!studentView && (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-amber-800"
                              title="Move this student back to the waitlist"
                              onClick={() => waitlistConfirmed(s.studentId)}
                            >
                              Waitlist
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-canvas-red"
                              onClick={() => {
                                setDropComment("");
                                setDropTarget({
                                  studentId: s.studentId,
                                  studentName: s.studentName,
                                });
                              }}
                            >
                              Drop
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {(slot.waitlist ?? []).map((s, index) => (
                    <li
                      key={`w-${s.studentId}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-amber-50/70 px-2.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          name={s.studentName}
                          initials={initialsFromName(s.studentName)}
                          color={avatarColorForId(s.studentId)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-canvas-grayDark">
                            {s.studentName}
                          </p>
                          <p className="text-[11px] text-amber-800">
                            {index === 0 ? "Next in line" : `Waitlist #${index + 1}`}
                          </p>
                        </div>
                      </div>
                      {!studentView && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="rounded p-0.5 text-gray-500 hover:bg-white disabled:opacity-30"
                            aria-label={`Move ${s.studentName} up`}
                            disabled={index === 0}
                            onClick={() => {
                              moveWaitlist(group.courseId, group.id, slot.id, s.studentId, "up");
                              refresh();
                            }}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-gray-500 hover:bg-white disabled:opacity-30"
                            aria-label={`Move ${s.studentName} down`}
                            disabled={index >= (slot.waitlist?.length ?? 0) - 1}
                            onClick={() => {
                              moveWaitlist(group.courseId, group.id, slot.id, s.studentId, "down");
                              refresh();
                            }}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-canvas-blue"
                            title={
                              occ.full
                                ? "This time is full. Adds an extra seat so they can attend."
                                : "Move them off the waitlist into a confirmed seat."
                            }
                            onClick={() => admit(s.studentId)}
                          >
                            Allow to attend
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-canvas-red"
                            onClick={() => {
                              dropStudentFromSlot(
                                group.courseId,
                                group.id,
                                slot.id,
                                s.studentId,
                              );
                              showToast("Removed from waitlist", "neutral");
                              refresh();
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!studentView && assignable.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    aria-label="Add student"
                    className="form-input h-9 min-w-0 flex-1 py-1 text-sm"
                    value={assignId}
                    onChange={(e) => setAssignId(e.target.value)}
                  >
                    <option value="">Add a student…</option>
                    {assignable.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!assignId}
                    className="btn-canvas-primary shrink-0 px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => {
                      const member = assignable.find((m) => m.id === assignId);
                      if (!member) return;
                      book(true, { id: member.id, name: member.name });
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    disabled={!assignId}
                    className="btn-canvas-secondary shrink-0 px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => {
                      const member = assignable.find((m) => m.id === assignId);
                      if (!member) return;
                      addToWaitlist({ id: member.id, name: member.name });
                    }}
                  >
                    Waitlist
                  </button>
                </div>
              )}
            </section>

            {studentView && (selected || waitlisted) && (
              <label className="block">
                <span className="form-label">What I want to discuss</span>
                <textarea
                  value={prep}
                  onChange={(e) => setPrep(e.target.value)}
                  onBlur={() => {
                    setAppointmentSlotPrep(group.courseId, group.id, slot.id, user.id, prep);
                    refresh();
                  }}
                  rows={3}
                  placeholder="Questions, files to review, or topics for this meeting"
                  className="form-input"
                />
              </label>
            )}
            {!studentView &&
              slot.signups.some((s) => slot.prepByStudent?.[s.studentId]) && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Student agendas
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {slot.signups.map((s) => {
                      const text = slot.prepByStudent?.[s.studentId];
                      if (!text) return null;
                      return (
                        <li key={`prep-${s.studentId}`} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold text-gray-500">{s.studentName}</p>
                          <p className="mt-0.5 text-sm text-canvas-grayDark">{text}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4">
            {htmlPreview(group.description).text ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Group details
                </h3>
                <RichContentViewer
                  html={group.description ?? ""}
                  courseId={group.courseId}
                  className="mt-1 !text-sm !leading-6 [&_p]:my-1.5"
                />
              </div>
            ) : null}
            {studentView ? (
              htmlPreview(slot.notesHtml).text ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Meeting notes
                  </h3>
                  <RichContentViewer
                    html={slot.notesHtml ?? ""}
                    courseId={group.courseId}
                    className="mt-1 !text-sm !leading-6 [&_p]:my-1.5"
                  />
                </div>
              ) : notesEmpty ? (
                <p className="text-sm text-gray-500">No notes for this meeting yet.</p>
              ) : null
            ) : (
              <RichContentEditor
                label="Meeting notes"
                value={slot.notesHtml ?? ""}
                onChange={(html) => {
                  setAppointmentSlotNotes(group.courseId, group.id, slot.id, html);
                }}
                height={220}
                courseId={group.courseId}
                mountKey={`appointment-slot-notes:${slot.id}`}
              />
            )}
            <p className="text-xs text-gray-500">
              Use notes for Zoom links, what to bring, or a short agenda. This is for this time
              only — group details stay on the appointment group.
            </p>
          </div>
        )}

        {tab === "chat" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {chatLocked
                ? "Chat opens when you have a confirmed seat or a waitlist spot."
                  : studentView
                    ? waitlisted
                      ? "Private with your instructor. Waitlist announcements from them appear here too — other students cannot see your messages."
                      : "Private with your instructor. Confirmed-seat announcements appear here too — other students cannot see your messages."
                    : "Personal messages stay between you and one student. Confirmed and waitlist broadcasts reach everyone currently in that group."}
            </p>
            {!studentView && (
              <label className="block">
                <span className="form-label">Send to</span>
                <select
                  aria-label="Chat recipient"
                  className="form-input h-9 py-1 text-sm"
                  value={activeChatTarget}
                  onChange={(e) => setChatTarget(e.target.value)}
                >
                  {(slot.signups.length > 0) && (
                    <option value="confirmed">Confirmed (broadcast)</option>
                  )}
                  {(slot.waitlist?.length ?? 0) > 0 && (
                    <option value="waitlist">Waitlist (broadcast)</option>
                  )}
                  {slot.signups.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentName} (confirmed)
                    </option>
                  ))}
                  {(slot.waitlist ?? []).map((s) => (
                    <option key={`w-${s.studentId}`} value={s.studentId}>
                      {s.studentName} (waitlist)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <ul className="max-h-56 space-y-2 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
              {shownChat.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-gray-500">
                  {studentView
                    ? "No messages yet."
                    : activeChatTarget === "waitlist"
                      ? "No waitlist announcements yet."
                      : activeChatTarget === "confirmed"
                        ? "No confirmed-seat announcements yet."
                        : "No messages in this personal chat yet."}
                </li>
              ) : (
                shownChat.map((m) => {
                  const thread = appointmentMessageThread(m, slot);
                  const peer =
                    thread.kind === "waitlist"
                      ? "Waitlist"
                      : thread.kind === "confirmed"
                        ? "Confirmed"
                        : chatPeople.find((s) => s.studentId === thread.studentId)?.studentName;
                  const canDelete = canDeleteAppointmentSlotMessage(m, {
                    studentView,
                    userId: user.id,
                  });
                  return (
                    <li key={m.id} className="rounded-lg bg-white px-2.5 py-2 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <p className="text-xs font-semibold text-canvas-grayDark">
                              {m.authorName}
                              {thread.kind === "waitlist" ? (
                                <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Waitlist
                                </span>
                              ) : thread.kind === "confirmed" ? (
                                <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                  Confirmed
                                </span>
                              ) : !studentView && peer && peer !== m.authorName ? (
                                <span className="ml-1.5 text-[10px] font-medium text-gray-400">
                                  · {peer}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(m.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{m.body}</p>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-canvas-red hover:bg-red-50"
                            aria-label="Delete message"
                            onClick={() => setDeleteMessageId(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (chatLocked) return;
                const audience =
                  studentView
                    ? ({ kind: "personal" as const, studentId: user.id })
                    : activeChatTarget === "waitlist"
                      ? ({ kind: "waitlist" as const })
                      : activeChatTarget === "confirmed"
                        ? ({ kind: "confirmed" as const })
                        : ({ kind: "personal" as const, studentId: activeChatTarget });
                if (!studentView && audience.kind === "personal" && !audience.studentId) return;
                if (!studentView && audience.kind === "waitlist" && (slot.waitlist?.length ?? 0) === 0) {
                  return;
                }
                if (!studentView && audience.kind === "confirmed" && slot.signups.length === 0) {
                  return;
                }
                const body = chatDraft;
                const result = addAppointmentSlotMessage(
                  group.courseId,
                  group.id,
                  slot.id,
                  { id: user.id, name: user.name },
                  body,
                  audience,
                );
                if (!result) return;
                if (studentView) {
                  notifyAppointmentActivity({
                    audience: "instructor",
                    title: `Appointment chat: ${group.title}`,
                    body: `${user.name}: ${body.trim()}`,
                    courseId: group.courseId,
                    href: hrefFor(group),
                  });
                } else {
                  notifyAppointmentActivity({
                    audience: "student",
                    title:
                      audience.kind === "waitlist"
                        ? `Waitlist message: ${group.title}`
                        : audience.kind === "confirmed"
                          ? `Appointment message: ${group.title}`
                          : `Appointment chat: ${group.title}`,
                    body: `${user.name}: ${body.trim()}`,
                    courseId: group.courseId,
                    href: hrefFor(group),
                  });
                }
                markAppointmentChatSeen(user.id, slot.id);
                setChatDraft("");
                refresh();
              }}
            >
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={
                  chatLocked
                    ? "Chat opens when you have a seat or waitlist spot."
                    : studentView
                      ? "Message your instructor"
                      : activeChatTarget === "waitlist"
                        ? "Broadcast to waitlisted students"
                        : activeChatTarget === "confirmed"
                          ? "Broadcast to confirmed students"
                          : "Personal message"
                }
                aria-label="Meeting chat"
                disabled={chatLocked || (!studentView && !activeChatTarget)}
                className="form-input h-9 py-1 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={
                  chatLocked ||
                  !chatDraft.trim() ||
                  (!studentView && !activeChatTarget)
                }
                className="btn-canvas-primary shrink-0 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                { !studentView && (activeChatTarget === "waitlist" || activeChatTarget === "confirmed") ? "Broadcast" : "Send" }
              </button>
            </form>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-canvas-secondary" onClick={onClose}>
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
      isOpen={Boolean(absentOffer)}
      title="Offer this seat?"
      description={
        absentOffer
          ? `Give this seat to ${absentOffer.nextName}? They are next on the waitlist.`
          : undefined
      }
      confirmText="Give seat"
      cancelText="Keep them confirmed"
      tone="primary"
      onClose={() => setAbsentOffer(null)}
      onConfirm={offerSeatFromAbsent}
    />
    <ConfirmActionModal
      isOpen={confirmCancel}
      title="Cancel this sign-up?"
      description="A comment is required and will be sent to your instructor."
      confirmText="Cancel sign-up"
      tone="danger"
      confirmDisabled={!cancelComment.trim()}
      onClose={() => {
        setConfirmCancel(false);
        setCancelComment("");
      }}
      onConfirm={confirmCancelMine}
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
    <ConfirmActionModal
      isOpen={Boolean(deleteMessageId)}
      title="Delete this message?"
      description="This removes the message from the meeting chat."
      confirmText="Delete"
      tone="danger"
      onClose={() => setDeleteMessageId(null)}
      onConfirm={() => {
        if (!deleteMessageId) return;
        deleteAppointmentSlotMessage(
          group.courseId,
          group.id,
          slot.id,
          deleteMessageId,
          { studentView, userId: user.id },
        );
        setDeleteMessageId(null);
        refresh();
      }}
    />
    </>
  );
}
