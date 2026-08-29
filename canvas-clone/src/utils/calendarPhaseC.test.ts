// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  admitWaitlistedStudent,
  addAppointmentSlotMessage,
  addStudentToWaitlist,
  appointmentSlotCalendarState,
  cancelAppointmentSignup,
  dropStudentFromSlot,
  deleteAppointmentSlotMessage,
  duplicateAppointmentGroup,
  effectiveAppointmentLocation,
  findOverlappingAppointmentSlots,
  generateAppointmentSlots,
  loadAppointmentGroups,
  loadAppointmentGroupsForCourses,
  moveConfirmedStudentToWaitlist,
  moveWaitlist,
  nextWaitlistedStudent,
  reorderWaitlist,
  rescheduleAppointmentSlot,
  setAppointmentSlotLocation,
  setAppointmentSlotNotes,
  setAppointmentSlotDuration,
  signUpForSlot,
  slotHasCapacity,
  studentCanCancelSignup,
  studentEligibleForAppointmentGroup,
  studentCanSeeAppointmentGroup,
  studentSignupInGroup,
  upsertAppointmentGroup,
  visibleAppointmentSlotMessages,
  buildAppointmentAttendanceCsv,
} from "./appointmentGroups";
import {
  applyCustomEventDelete,
  applyCustomEventSave,
  deleteCustomCalendarEvent,
  expandCustomEventOccurrences,
  listCustomCalendarEvents,
  PERSONAL_CALENDAR_ID,
  upsertCustomCalendarEvent,
} from "./calendarCustomEvents";
import { applyCalendarDrop, rescheduleDueDate } from "./calendarDueReschedule";
import { findOverlappingCalendarItems } from "./calendarOverlap";
import { loadDueDateOverrides, saveDueDateOverrides } from "./dueDateOverrides";
import { isItemTimeLocked, saveSections } from "./courseSections";
import { buildPlannerIcs } from "./plannerIcs";
import { buildAppointmentSlotIcs } from "./appointmentIcs";
import { runAppointmentReminders } from "./appointmentReminders";
import { loadNotifications } from "./notifications";
import { saveSettings } from "./settingsStore";
import { loadUser } from "./userStore";
import {
  appointmentChipLabel,
  appointmentOccupancyChipText,
  calendarEventChipAppearance,
  isBookedUpcomingAppointment,
  isUnbookedAppointment,
} from "./calendarEvents";
import { getUpcomingDeadlines } from "./deadlines";
import { writeGlobalStudentView } from "./studentView";
import { writeGlobalStudentView } from "./studentView";

beforeEach(() => {
  window.localStorage.clear();
});

describe("appointment groups", () => {
  it("generates consecutive slots that fill a window", () => {
    const start = Date.parse("2026-09-01T13:00:00");
    const end = Date.parse("2026-09-01T14:00:00");
    const slots = generateAppointmentSlots({
      windowStart: start,
      windowEnd: end,
      durationMinutes: 20,
      maxParticipants: 1,
    });
    expect(slots).toHaveLength(3);
    expect(slots[0].endAt - slots[0].startAt).toBe(20 * 60 * 1000);
    expect(slots.every((s) => slotHasCapacity(s))).toBe(true);
  });

  it("lets a student sign up once and then cancel", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg1",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 40 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    expect(group.slots).toHaveLength(2);

    const first = signUpForSlot("1", "apg1", group.slots[0].id, {
      id: "demo_alex",
      name: "Alex Chen",
    });
    expect(first.ok).toBe(true);

    const again = signUpForSlot("1", "apg1", group.slots[1].id, {
      id: "demo_alex",
      name: "Alex Chen",
    });
    expect(again.ok).toBe(false);

    const loaded = loadAppointmentGroups("1")[0];
    expect(studentSignupInGroup(loaded, "demo_alex")?.slot.id).toBe(group.slots[0].id);

    cancelAppointmentSignup("1", "apg1", "demo_alex");
    expect(studentSignupInGroup(loadAppointmentGroups("1")[0], "demo_alex")).toBeUndefined();
  });

  it("lets a student book multiple slots when the group allows it", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-multi",
      courseId: "1",
      title: "Office hours",
      published: true,
      maxSlotsPerStudent: 2,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 60 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    expect(group.slots.length).toBeGreaterThanOrEqual(3);
    const student = { id: "demo_alex", name: "Alex Chen" };
    expect(signUpForSlot("1", "apg-multi", group.slots[0].id, student).ok).toBe(true);
    expect(signUpForSlot("1", "apg-multi", group.slots[1].id, student).ok).toBe(true);
    const third = signUpForSlot("1", "apg-multi", group.slots[2].id, student);
    expect(third.ok).toBe(false);
    const loaded = loadAppointmentGroups("1").find((g) => g.id === "apg-multi");
    expect(loaded?.slots.filter((s) => s.signups.some((x) => x.studentId === "demo_alex"))).toHaveLength(2);

    cancelAppointmentSignup("1", "apg-multi", "demo_alex", { slotId: group.slots[0].id });
    const after = loadAppointmentGroups("1").find((g) => g.id === "apg-multi");
    expect(after?.slots[0].signups.some((x) => x.studentId === "demo_alex")).toBe(false);
    expect(after?.slots[1].signups.some((x) => x.studentId === "demo_alex")).toBe(true);
  });

  it("lets a student book every remaining slot when the limit is unlimited", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-unlim",
      courseId: "1",
      title: "Drop-in hours",
      published: true,
      maxSlotsPerStudent: 0,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 60 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const student = { id: "demo_alex", name: "Alex Chen" };
    for (const slot of group.slots) {
      expect(signUpForSlot("1", "apg-unlim", slot.id, student).ok).toBe(true);
    }
    const loaded = loadAppointmentGroups("1").find((g) => g.id === "apg-unlim");
    expect(loaded?.slots.every((s) => s.signups.some((x) => x.studentId === "demo_alex"))).toBe(true);
  });

  it("never lets a slot exceed seats per time even when the student limit is unlimited", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-seats",
      courseId: "1",
      title: "1:1 hours",
      published: true,
      maxSlotsPerStudent: 0,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    expect(signUpForSlot("1", "apg-seats", slotId, { id: "a", name: "A" }).ok).toBe(true);
    const second = signUpForSlot("1", "apg-seats", slotId, { id: "b", name: "B" });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.waitlisted).toBe(true);
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.signups).toHaveLength(1);
    expect(slot.signups[0].studentId).toBe("a");
    expect(slot.waitlist).toHaveLength(1);
    expect(slotHasCapacity(slot)).toBe(false);
  });

  it("repairs overflow signups onto the waitlist so a slot cannot exceed its seat cap", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-overflow",
      courseId: "1",
      title: "Overflow",
      published: true,
      slots: [
        {
          id: "slot-overflow",
          startAt: start,
          endAt: start + 20 * 60 * 1000,
          maxParticipants: 1,
          signups: [
            { studentId: "a", studentName: "A", signedUpAt: start },
            { studentId: "b", studentName: "B", signedUpAt: start + 1 },
          ],
          waitlist: [],
        },
      ],
    });
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.signups).toHaveLength(1);
    expect(slot.signups[0].studentId).toBe("a");
    expect(slot.waitlist.map((s) => s.studentId)).toEqual(["b"]);
  });

  it("marks calendar chips booked when anyone is confirmed or waitlisted", () => {
    const start = Date.now() + 86_400_000;
    const emptySlot = {
      id: "s0",
      startAt: start,
      endAt: start + 20 * 60 * 1000,
      maxParticipants: 2,
      signups: [] as { studentId: string; studentName: string; signedUpAt: number }[],
      waitlist: [] as { studentId: string; studentName: string; signedUpAt: number }[],
    };
    const empty = appointmentSlotCalendarState(emptySlot, {
      studentView: false,
      studentId: "instructor",
    });
    expect(empty.appointmentBooked).toBe(false);
    expect(empty.titleSuffix).toBe(" (open)");

    const confirmed = {
      ...emptySlot,
      signups: [{ studentId: "a", studentName: "A", signedUpAt: start }],
      waitlist: [{ studentId: "b", studentName: "B", signedUpAt: start }],
    };
    const instructor = appointmentSlotCalendarState(confirmed, {
      studentView: false,
      studentId: "instructor",
    });
    expect(instructor.appointmentBooked).toBe(true);
    expect(instructor.titleSuffix).toBe("");

    const holder = appointmentSlotCalendarState(confirmed, {
      studentView: true,
      studentId: "a",
    });
    expect(holder.appointmentBooked).toBe(true);

    const waitlistOnly = {
      ...emptySlot,
      waitlist: [{ studentId: "b", studentName: "B", signedUpAt: start }],
    };
    const waiting = appointmentSlotCalendarState(waitlistOnly, {
      studentView: false,
      studentId: "instructor",
    });
    expect(waiting.appointmentBooked).toBe(true);
    expect(waiting.titleSuffix).toBe("");
  });

  it("stores meeting notes and chat on a slot", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-meta",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    setAppointmentSlotNotes("1", "apg-meta", slotId, "<p>Bring lab 3</p>");
    addAppointmentSlotMessage("1", "apg-meta", slotId, { id: "1", name: "Nehang" }, "See you then");
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.notesHtml).toContain("Bring lab 3");
    expect(slot.messages).toHaveLength(1);
    expect(slot.messages?.[0].body).toBe("See you then");
  });

  it("keeps student appointment chat private and supports waitlist broadcast", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-chat",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    const slotId = group.slots[0].id;
    signUpForSlot("1", "apg-chat", slotId, { id: "a", name: "A" });
    signUpForSlot("1", "apg-chat", slotId, { id: "b", name: "B" });
    addAppointmentSlotMessage(
      "1",
      "apg-chat",
      slotId,
      { id: "a", name: "A" },
      "Can we review lab 2?",
      { kind: "personal", studentId: "a" },
    );
    addAppointmentSlotMessage(
      "1",
      "apg-chat",
      slotId,
      { id: "instr", name: "Instructor" },
      "A seat may open soon.",
      { kind: "waitlist" },
    );
    const slot = loadAppointmentGroups("1")[0].slots[0];
    const forA = visibleAppointmentSlotMessages(slot, { studentView: true, studentId: "a" });
    const forB = visibleAppointmentSlotMessages(slot, { studentView: true, studentId: "b" });
    expect(forA.map((m) => m.body)).toEqual(["Can we review lab 2?"]);
    expect(forB.map((m) => m.body)).toEqual(["A seat may open soon."]);
    expect(
      visibleAppointmentSlotMessages(slot, { studentView: false, studentId: "instr" }),
    ).toHaveLength(2);
  });

  it("lets a student delete their own appointment chat message", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-chat-del",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    addAppointmentSlotMessage(
      "1",
      "apg-chat-del",
      slotId,
      { id: "a", name: "A" },
      "Mine",
      { kind: "personal", studentId: "a" },
    );
    addAppointmentSlotMessage(
      "1",
      "apg-chat-del",
      slotId,
      { id: "instr", name: "Instructor" },
      "Stay on the waitlist",
      { kind: "waitlist" },
    );
    const slot = loadAppointmentGroups("1")[0].slots[0];
    const mine = slot.messages?.find((m) => m.body === "Mine");
    const broadcast = slot.messages?.find((m) => m.body === "Stay on the waitlist");
    expect(mine && broadcast).toBeTruthy();
    deleteAppointmentSlotMessage("1", "apg-chat-del", slotId, broadcast!.id, {
      studentView: true,
      userId: "a",
    });
    expect(loadAppointmentGroups("1")[0].slots[0].messages?.map((m) => m.body)).toEqual([
      "Mine",
      "Stay on the waitlist",
    ]);
    deleteAppointmentSlotMessage("1", "apg-chat-del", slotId, mine!.id, {
      studentView: true,
      userId: "a",
    });
    expect(loadAppointmentGroups("1")[0].slots[0].messages?.map((m) => m.body)).toEqual([
      "Stay on the waitlist",
    ]);
    deleteAppointmentSlotMessage("1", "apg-chat-del", slotId, broadcast!.id, {
      studentView: false,
      userId: "instr",
    });
    expect(loadAppointmentGroups("1")[0].slots[0].messages).toBeUndefined();
  });

  it("rejects signup on a full slot", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg2",
      courseId: "1",
      title: "1:1",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    expect(
      signUpForSlot("1", "apg2", group.slots[0].id, { id: "a", name: "A" }).ok,
    ).toBe(true);
    const second = signUpForSlot("1", "apg2", group.slots[0].id, { id: "b", name: "B" });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.waitlisted).toBe(true);
  });

  it("promotes the waitlist when a signup is canceled", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg3",
      courseId: "1",
      title: "Waitlist",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    signUpForSlot("1", "apg3", group.slots[0].id, { id: "a", name: "A" });
    signUpForSlot("1", "apg3", group.slots[0].id, { id: "b", name: "B" });
    const result = cancelAppointmentSignup("1", "apg3", "a");
    expect(result?.promoted?.studentId).toBe("b");
    expect(studentSignupInGroup(loadAppointmentGroups("1")[0], "b")?.slot.id).toBe(
      group.slots[0].id,
    );
  });

  it("lets an instructor admit a waitlisted student onto a full slot", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-admit",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    signUpForSlot("1", "apg-admit", group.slots[0].id, { id: "a", name: "A" });
    signUpForSlot("1", "apg-admit", group.slots[0].id, { id: "b", name: "B" });
    const result = admitWaitlistedStudent("1", "apg-admit", group.slots[0].id, "b");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extraSeat).toBe(true);
      expect(result.studentName).toBe("B");
    }
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.signups.map((s) => s.studentId)).toEqual(["a", "b"]);
    expect(slot.waitlist).toHaveLength(0);
    expect(slot.maxParticipants).toBe(2);
    expect(slotHasCapacity(slot)).toBe(false);
  });

  it("lets an instructor move a confirmed student back to the waitlist", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-rewait",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    signUpForSlot("1", "apg-rewait", group.slots[0].id, { id: "a", name: "A" });
    signUpForSlot("1", "apg-rewait", group.slots[0].id, { id: "b", name: "B" });
    const result = moveConfirmedStudentToWaitlist("1", "apg-rewait", group.slots[0].id, "a");
    expect(result.ok).toBe(true);
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.signups).toHaveLength(0);
    expect(slot.waitlist.map((s) => s.studentId)).toEqual(["b", "a"]);
  });

  it("lets an instructor add another student directly to the waitlist", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-addwait",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 40 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 2,
      }),
    });
    const slotId = group.slots[0].id;
    expect(slotHasCapacity(group.slots[0])).toBe(true);
    const result = addStudentToWaitlist("1", "apg-addwait", slotId, { id: "c", name: "C" });
    expect(result.ok).toBe(true);
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.signups).toHaveLength(0);
    expect(slot.waitlist.map((s) => s.studentId)).toEqual(["c"]);
    const second = addStudentToWaitlist("1", "apg-addwait", slotId, { id: "d", name: "D" });
    expect(second.ok).toBe(true);
    const both = loadAppointmentGroups("1")[0].slots[0];
    expect(both.signups).toHaveLength(0);
    expect(both.waitlist.map((s) => s.studentId)).toEqual(["c", "d"]);
  });
});

describe("custom calendar events", () => {
  it("scopes personal events to the creator", () => {
    upsertCustomCalendarEvent({
      title: "Dentist",
      startAt: Date.now(),
      courseId: null,
      createdBy: "demo_alex",
    });
    upsertCustomCalendarEvent({
      title: "Lecture",
      startAt: Date.now(),
      courseId: "1",
      createdBy: "1",
    });
    const personal = listCustomCalendarEvents({
      userId: "demo_alex",
      courseId: PERSONAL_CALENDAR_ID,
    });
    expect(personal.map((e) => e.title)).toEqual(["Dentist"]);
    const course = listCustomCalendarEvents({ userId: "demo_alex", courseId: "1" });
    expect(course.map((e) => e.title)).toEqual(["Lecture"]);
  });

  it("updates and deletes an event", () => {
    const created = upsertCustomCalendarEvent({
      title: "Draft",
      startAt: 1,
      courseId: null,
      createdBy: "1",
    });
    upsertCustomCalendarEvent({
      id: created.id,
      title: "Final",
      startAt: 2,
      courseId: null,
      createdBy: "1",
    });
    expect(listCustomCalendarEvents({ userId: "1", courseId: "all" })[0].title).toBe("Final");
    deleteCustomCalendarEvent(created.id);
    expect(listCustomCalendarEvents({ userId: "1", courseId: "all" })).toHaveLength(0);
  });

  it("expands daily recurrence up to the cap", () => {
    const created = upsertCustomCalendarEvent({
      title: "Standup",
      startAt: Date.parse("2026-09-01T13:00:00"),
      endAt: Date.parse("2026-09-01T13:15:00"),
      courseId: "1",
      createdBy: "1",
      recurrence: { freq: "daily", until: Date.parse("2026-09-10T13:00:00") },
    });
    const occ = expandCustomEventOccurrences(created);
    expect(occ.length).toBeGreaterThan(1);
    expect(occ.length).toBeLessThanOrEqual(52);
  });

  it("expands monthly recurrence and skips exception dates", () => {
    const created = upsertCustomCalendarEvent({
      title: "Payday",
      startAt: Date.parse("2026-09-01T13:00:00"),
      courseId: "1",
      createdBy: "1",
      recurrence: { freq: "monthly", until: Date.parse("2026-12-01T13:00:00") },
    });
    expect(expandCustomEventOccurrences(created)).toHaveLength(4);
    const oct = Date.parse("2026-10-01T13:00:00");
    applyCustomEventDelete(created, oct, "this");
    const remaining = expandCustomEventOccurrences(
      listCustomCalendarEvents({ userId: "1", courseId: "1" })[0],
    );
    expect(remaining.map((o) => o.startAt)).not.toContain(oct);
    expect(remaining.length).toBe(3);
  });

  it("splits a series when saving this occurrence", () => {
    const created = upsertCustomCalendarEvent({
      title: "Standup",
      startAt: Date.parse("2026-09-01T13:00:00"),
      endAt: Date.parse("2026-09-01T13:15:00"),
      courseId: "1",
      createdBy: "1",
      recurrence: { freq: "weekly", until: Date.parse("2026-09-22T13:00:00") },
    });
    const second = Date.parse("2026-09-08T13:00:00");
    applyCustomEventSave(created, second, "this", {
      title: "Moved standup",
      startAt: Date.parse("2026-09-08T15:00:00"),
      endAt: Date.parse("2026-09-08T15:15:00"),
      courseId: "1",
    });
    const all = listCustomCalendarEvents({ userId: "1", courseId: "1" });
    expect(all).toHaveLength(2);
    const series = all.find((e) => e.id === created.id)!;
    expect(expandCustomEventOccurrences(series).map((o) => o.startAt)).not.toContain(second);
    expect(all.some((e) => e.title === "Moved standup" && !e.recurrence)).toBe(true);
  });
});

describe("calendar extras", () => {
  it("builds ICS with DTEND and LOCATION", () => {
    upsertCustomCalendarEvent({
      title: "Lab",
      startAt: Date.parse("2026-09-01T13:00:00"),
      endAt: Date.parse("2026-09-01T14:00:00"),
      location: "Room 12",
      courseId: "1",
      createdBy: "1",
    });
    const ics = buildPlannerIcs("1");
    expect(ics).toContain("DTEND:");
    expect(ics).toContain("LOCATION:Room 12");
  });

  it("detects overlapping timed items", () => {
    upsertCustomCalendarEvent({
      title: "A",
      startAt: Date.parse("2026-09-01T13:00:00"),
      endAt: Date.parse("2026-09-01T14:00:00"),
      courseId: "1",
      createdBy: "1",
    });
    const hits = findOverlappingCalendarItems(
      Date.parse("2026-09-01T13:30:00"),
      Date.parse("2026-09-01T14:30:00"),
    );
    expect(hits.some((h) => h.title === "A")).toBe(true);
  });

  it("repeats appointment windows across weeks", () => {
    const start = Date.parse("2026-09-01T13:00:00");
    const end = Date.parse("2026-09-01T13:20:00");
    const slots = generateAppointmentSlots({
      windowStart: start,
      windowEnd: end,
      durationMinutes: 20,
      maxParticipants: 1,
      repeatWeeks: 3,
    });
    expect(slots).toHaveLength(3);
    expect(slots[1].startAt - slots[0].startAt).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("blocks student cancel after the cutoff", () => {
    const start = Date.now() + 30 * 60 * 1000;
    const group = upsertAppointmentGroup({
      id: "apg-cut",
      courseId: "1",
      title: "Cutoff",
      published: true,
      cancelUntilMinutesBefore: 60,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    signUpForSlot("1", "apg-cut", group.slots[0].id, { id: "stu", name: "Stu" });
    const gate = studentCanCancelSignup(loadAppointmentGroups("1")[0], "stu");
    expect(gate.ok).toBe(false);
    expect(cancelAppointmentSignup("1", "apg-cut", "stu")).toBeUndefined();
  });

  it("lists a multi-course group from the extra course", () => {
    upsertAppointmentGroup({
      id: "apg-mc",
      courseId: "1",
      courseIds: ["2"],
      title: "Shared hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: Date.now() + 86_400_000,
        windowEnd: Date.now() + 86_400_000 + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const found = loadAppointmentGroupsForCourses(["2"]);
    expect(found.some((g) => g.id === "apg-mc")).toBe(true);
  });

  it("moves an override due date without touching everyone else", () => {
    const original = Date.parse("2026-09-01T17:00:00");
    const moved = Date.parse("2026-09-08T17:00:00");
    saveDueDateOverrides("1", [
      {
        id: "ddo1",
        itemKind: "assignment",
        itemId: "asg1",
        targetKind: "section",
        targetId: "sec-a",
        dueAt: original,
      },
    ]);
    expect(rescheduleDueDate("1", "assignment", "asg1", "ddo1", moved)).toBe(true);
    expect(loadDueDateOverrides("1")[0].dueAt).toBe(moved);
  });

  it("treats a future item unlock as time-locked", () => {
    expect(
      isItemTimeLocked({
        type: "page",
        label: "Later",
        unlockAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe(true);
    expect(isItemTimeLocked({ type: "page", label: "Open" })).toBe(false);
  });
});

describe("course package round-trip", () => {
  it("keeps recurrence, waitlist, and item section ids", async () => {
    const { remapPackageForNewCourse } = await import("./coursePackage");
    const until = Date.parse("2026-10-01T13:00:00");
    const pkg = {
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      course: {
        id: "1",
        short_name: "CS",
        title: "CS 101",
        code: "CS101",
        term: "Fall",
        color: "#000",
        published: true,
        updated_at: new Date().toISOString(),
      },
      modules: [
        {
          title: "Week 1",
          items: [
            {
              type: "page",
              label: "Intro",
              assignedSectionIds: ["sec-home"],
            },
          ],
        },
      ],
      pagesIndex: [],
      pages: {},
      assignments: [],
      quizzes: [],
      announcements: [],
      discussions: { topics: [], replies: [] },
      filesMeta: [],
      roster: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      quizProgress: {},
      discussionParticipations: [],
      progress: { modules: {} },
      gradePublish: { allPublished: false, columns: {}, students: {}, cells: {} },
      sections: [{ id: "sec-home", name: "Home", studentIds: ["stu-a"] }],
      appointmentGroups: [
        {
          id: "apg-old",
          courseId: "1",
          courseIds: ["2"],
          cancelUntilMinutesBefore: 30,
          title: "Hours",
          published: true,
          createdBy: "1",
          createdAt: 1,
          updatedAt: 1,
          slots: [
            {
              id: "slot-old",
              startAt: Date.parse("2026-09-01T13:00:00"),
              endAt: Date.parse("2026-09-01T13:20:00"),
              maxParticipants: 1,
              signups: [
                { studentId: "stu-a", studentName: "A", signedUpAt: 1 },
              ],
              waitlist: [
                { studentId: "stu-b", studentName: "B", signedUpAt: 2 },
              ],
              extraFlag: true,
            },
          ],
        },
      ],
      customCalendarEvents: [
        {
          id: "cal-old",
          title: "Standup",
          startAt: Date.parse("2026-09-01T13:00:00"),
          courseId: "1",
          createdBy: "1",
          createdAt: 1,
          updatedAt: 1,
          recurrence: { freq: "daily" as const, until },
          exceptionDates: [Date.parse("2026-09-02T13:00:00")],
        },
      ],
    };
    const remapped = remapPackageForNewCourse(pkg as never, "imported");
    expect(remapped.customCalendarEvents?.[0].exceptionDates).toEqual([
      Date.parse("2026-09-02T13:00:00"),
    ]);
    expect(remapped.appointmentGroups?.[0].courseIds).toEqual(["2"]);
    expect(remapped.appointmentGroups?.[0].cancelUntilMinutesBefore).toBe(30);
    expect(remapped.customCalendarEvents?.[0].id).not.toBe("cal-old");
    expect(remapped.appointmentGroups?.[0].slots[0].id).not.toBe("slot-old");
    expect(remapped.appointmentGroups?.[0].slots[0].waitlist[0].studentId).toBe("stu-b");
    expect(
      (remapped.appointmentGroups?.[0].slots[0] as { extraFlag?: boolean }).extraFlag,
    ).toBe(true);
    const nextSectionId = remapped.sections?.[0].id;
    expect(nextSectionId).toBeTruthy();
    expect(nextSectionId).not.toBe("sec-home");
    expect(remapped.modules[0].items[0].assignedSectionIds).toEqual([nextSectionId]);
  });
});

describe("appointment chip appearance", () => {
  const base = {
    id: "1",
    courseId: "1",
    title: "Office hours",
    date: new Date(),
    path: "/",
    color: "#008EE2",
    courseShortName: "CS",
  };

  it("marks unsigned appointment slots as unbooked dashed chips", () => {
    const open = {
      ...base,
      type: "appointment" as const,
      appointmentBooked: false,
    };
    expect(isUnbookedAppointment(open)).toBe(true);
    const chip = calendarEventChipAppearance(open);
    expect(chip.unbooked).toBe(true);
    expect(chip.className).toContain("border-dashed");
    expect(chip.style.backgroundColor).not.toBe("#008EE2");
  });

  it("keeps booked appointments as solid filled pills", () => {
    const booked = {
      ...base,
      type: "appointment" as const,
      appointmentBooked: true,
    };
    expect(isUnbookedAppointment(booked)).toBe(false);
    const chip = calendarEventChipAppearance(booked);
    expect(chip.unbooked).toBe(false);
    expect(chip.className).toContain("rounded-full");
    expect(chip.style.backgroundColor).toBe("#C0392B");
    expect(chip.courseColor).toBe("#008EE2");
  });

  it("fills chips from Show-filter type colors and keeps course color separate", () => {
    const quiz = {
      ...base,
      type: "quiz" as const,
      color: "#008EE2",
    };
    const chip = calendarEventChipAppearance(quiz);
    expect(chip.typeColor).toBe("#9B59B6");
    expect(chip.style.backgroundColor).toBe("#9B59B6");
    expect(chip.courseColor).toBe("#008EE2");
  });

  it("shows booked and waitlist occupancy in chip text", () => {
    expect(appointmentOccupancyChipText({ taken: 1, max: 1 })).toBe("1/1");
    expect(appointmentOccupancyChipText({ taken: 1, max: 2, waitlisted: 2 })).toBe("1/2 · w2");
    const labeled = appointmentChipLabel({
      ...base,
      type: "appointment",
      appointmentSeats: { taken: 1, max: 2, waitlisted: 2 },
    });
    expect(labeled).toBe("Office hours 1/2 · w2");
  });
});

describe("appointment reschedule, waitlist order, and reminders", () => {
  it("reschedules a slot while keeping duration and roster", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-resched",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = group.slots[0].id;
    signUpForSlot("1", "apg-resched", slotId, { id: "a", name: "A" });
    signUpForSlot("1", "apg-resched", slotId, { id: "b", name: "B" });
    const before = loadAppointmentGroups("1")[0].slots[0];
    const duration = before.endAt - before.startAt;
    const nextStart = start + 60 * 60 * 1000;
    const updated = rescheduleAppointmentSlot("1", "apg-resched", slotId, nextStart);
    const slot = updated?.slots.find((s) => s.id === slotId);
    expect(slot?.startAt).toBe(nextStart);
    expect(slot && slot.endAt - slot.startAt).toBe(duration);
    expect(slot?.signups.map((s) => s.studentId)).toEqual(["a"]);
    expect(slot?.waitlist.map((s) => s.studentId)).toEqual(["b"]);
  });

  it("applies an appointment calendar drop and preserves duration", () => {
    const start = Date.parse("2026-09-01T13:00:00");
    const group = upsertAppointmentGroup({
      id: "apg-drag",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slot = group.slots[0];
    const payload = JSON.stringify({
      kind: "appointment",
      courseId: "1",
      groupId: group.id,
      slotId: slot.id,
      originalStartAt: slot.startAt,
    });
    const target = Date.parse("2026-09-02T13:00:00");
    expect(applyCalendarDrop(payload, target)).toBe(true);
    const moved = loadAppointmentGroups("1")[0].slots[0];
    expect(moved.startAt).toBe(target);
    expect(moved.endAt - moved.startAt).toBe(20 * 60 * 1000);
  });

  it("reorders the waitlist", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-order",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    const slotId = group.slots[0].id;
    signUpForSlot("1", "apg-order", slotId, { id: "a", name: "A" });
    signUpForSlot("1", "apg-order", slotId, { id: "b", name: "B" });
    signUpForSlot("1", "apg-order", slotId, { id: "c", name: "C" });
    expect(nextWaitlistedStudent(loadAppointmentGroups("1")[0].slots[0])?.studentId).toBe("b");
    reorderWaitlist("1", "apg-order", slotId, 1, 0);
    expect(loadAppointmentGroups("1")[0].slots[0].waitlist.map((s) => s.studentId)).toEqual([
      "c",
      "b",
    ]);
    moveWaitlist("1", "apg-order", slotId, "c", "down");
    expect(loadAppointmentGroups("1")[0].slots[0].waitlist.map((s) => s.studentId)).toEqual([
      "b",
      "c",
    ]);
  });

  it("uses slot location when present", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-loc",
      courseId: "1",
      title: "Office hours",
      location: "Room 12",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    const group = setAppointmentSlotLocation("1", "apg-loc", slotId, "https://zoom.example/j/1");
    const slot = group?.slots[0];
    expect(slot && effectiveAppointmentLocation(group, slot)).toBe("https://zoom.example/j/1");
    const ics = buildAppointmentSlotIcs(group!, slot!);
    expect(ics).toContain("LOCATION:https://zoom.example/j/1");
  });

  it("promotes on drop but not when moving a confirmed student to the waitlist", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-drop",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    signUpForSlot("1", "apg-drop", slotId, { id: "a", name: "A" });
    signUpForSlot("1", "apg-drop", slotId, { id: "b", name: "B" });
    const waitlisted = moveConfirmedStudentToWaitlist("1", "apg-drop", slotId, "a");
    expect(waitlisted.ok).toBe(true);
    const afterWait = loadAppointmentGroups("1")[0].slots[0];
    expect(afterWait.signups).toHaveLength(0);
    expect(afterWait.waitlist.map((s) => s.studentId)).toEqual(["b", "a"]);

    signUpForSlot("1", "apg-drop", slotId, { id: "c", name: "C" });
    const dropped = dropStudentFromSlot("1", "apg-drop", slotId, "c");
    expect(dropped?.promoted?.studentId).toBe("b");
    const afterDrop = loadAppointmentGroups("1")[0].slots[0];
    expect(afterDrop.signups.map((s) => s.studentId)).toEqual(["b"]);
  });

  it("sends appointment reminders once per key", () => {
    const start = Date.now() + 2 * 60 * 60 * 1000;
    upsertAppointmentGroup({
      id: "apg-remind",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    const user = loadUser();
    signUpForSlot("1", "apg-remind", slotId, { id: user.id, name: user.name });
    const first = runAppointmentReminders(Date.now());
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const titles = loadNotifications()
      .filter((n) => n.kind === "appointment")
      .map((n) => n.title);
    expect(titles.some((t) => t.includes("Office hours"))).toBe(true);
    const second = runAppointmentReminders(Date.now());
    expect(second.sent).toBe(0);
  });

  it("skips reminders when appointment notifications are off", () => {
    saveSettings({ notifyAppointments: false });
    const start = Date.now() + 2 * 60 * 60 * 1000;
    upsertAppointmentGroup({
      id: "apg-quiet",
      courseId: "1",
      title: "Quiet hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    const user = loadUser();
    signUpForSlot("1", "apg-quiet", slotId, { id: user.id, name: user.name });
    expect(runAppointmentReminders().sent).toBe(0);
  });

  it("enforces section and student eligibility on self-signup", () => {
    saveSections("1", [
      { id: "sec-a", name: "Section A", studentIds: ["eligible"] },
      { id: "sec-b", name: "Section B", studentIds: ["other"] },
    ]);
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-elig",
      courseId: "1",
      title: "Section office hours",
      published: true,
      sectionIds: ["sec-a"],
      allowedStudentIds: ["eligible"],
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 40 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 2,
      }),
    });
    expect(studentEligibleForAppointmentGroup(group, "eligible")).toBe(true);
    expect(studentEligibleForAppointmentGroup(group, "other")).toBe(false);
    expect(studentCanSeeAppointmentGroup(group, "other")).toBe(false);
    expect(signUpForSlot("1", "apg-elig", group.slots[0].id, { id: "other", name: "Other" }).ok).toBe(
      false,
    );
    expect(
      signUpForSlot("1", "apg-elig", group.slots[0].id, { id: "eligible", name: "Eligible" }).ok,
    ).toBe(true);
    expect(
      signUpForSlot("1", "apg-elig", group.slots[1].id, { id: "other", name: "Other" }, {
        bypassEligibility: true,
      }).ok,
    ).toBe(true);
    const after = loadAppointmentGroups("1")[0];
    expect(studentCanSeeAppointmentGroup(after, "other")).toBe(true);
  });

  it("inserts a buffer between generated slots", () => {
    const start = Date.parse("2026-09-01T13:00:00");
    const slots = generateAppointmentSlots({
      windowStart: start,
      windowEnd: start + 60 * 60 * 1000,
      durationMinutes: 20,
      bufferMinutes: 10,
    });
    expect(slots).toHaveLength(2);
    expect(slots[1].startAt - slots[0].endAt).toBe(10 * 60 * 1000);
  });

  it("duplicates a group a week later without sign-ups", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-dup",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    signUpForSlot("1", "apg-dup", slotId, { id: "a", name: "A" });
    const copy = duplicateAppointmentGroup("1", "apg-dup");
    expect(copy?.published).toBe(false);
    expect(copy?.title).toBe("Office hours (copy)");
    expect(copy?.slots[0].signups).toEqual([]);
    expect(copy?.slots[0].startAt).toBe(start + 7 * 24 * 60 * 60 * 1000);
    expect(copy?.id).not.toBe("apg-dup");
  });

  it("shows confirmed broadcasts only to confirmed students", () => {
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-confirmed-chat",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
        maxParticipants: 1,
      }),
    });
    const slotId = group.slots[0].id;
    signUpForSlot("1", "apg-confirmed-chat", slotId, { id: "a", name: "A" });
    signUpForSlot("1", "apg-confirmed-chat", slotId, { id: "b", name: "B" });
    addAppointmentSlotMessage(
      "1",
      "apg-confirmed-chat",
      slotId,
      { id: "instr", name: "Instructor" },
      "Bring your laptop.",
      { kind: "confirmed" },
    );
    addAppointmentSlotMessage(
      "1",
      "apg-confirmed-chat",
      slotId,
      { id: "instr", name: "Instructor" },
      "A seat may open.",
      { kind: "waitlist" },
    );
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(
      visibleAppointmentSlotMessages(slot, { studentView: true, studentId: "a" }).map((m) => m.body),
    ).toEqual(["Bring your laptop."]);
    expect(
      visibleAppointmentSlotMessages(slot, { studentView: true, studentId: "b" }).map((m) => m.body),
    ).toEqual(["A seat may open."]);
  });

  it("changes slot duration without moving the start time", () => {
    const start = Date.now() + 86_400_000;
    upsertAppointmentGroup({
      id: "apg-dur",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const slotId = loadAppointmentGroups("1")[0].slots[0].id;
    setAppointmentSlotDuration("1", "apg-dur", slotId, 45);
    const slot = loadAppointmentGroups("1")[0].slots[0];
    expect(slot.startAt).toBe(start);
    expect(slot.endAt - slot.startAt).toBe(45 * 60 * 1000);
  });

  it("finds overlapping appointment slots across groups", () => {
    const start = Date.parse("2026-09-08T13:00:00");
    upsertAppointmentGroup({
      id: "apg-ov-a",
      courseId: "1",
      title: "Office hours",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    upsertAppointmentGroup({
      id: "apg-ov-b",
      courseId: "1",
      title: "Advising",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start + 10 * 60 * 1000,
        windowEnd: start + 30 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const hits = findOverlappingAppointmentSlots(start, start + 20 * 60 * 1000, {
      ignoreSlotId: loadAppointmentGroups("1").find((g) => g.id === "apg-ov-a")?.slots[0].id,
      courseIds: ["1"],
    });
    expect(hits.map((h) => h.groupTitle)).toContain("Advising");
    expect(hits.every((h) => h.groupTitle !== "Office hours")).toBe(true);
  });

  it("builds an attendance CSV for scheduled slots", () => {
    const start = Date.parse("2026-09-08T13:00:00");
    const group = upsertAppointmentGroup({
      id: "apg-csv",
      courseId: "1",
      title: "Office hours",
      published: true,
      location: "Room 12",
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 20 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    signUpForSlot("1", "apg-csv", group.slots[0].id, { id: "a", name: "Alex Chen" });
    const csv = buildAppointmentAttendanceCsv([
      { group: loadAppointmentGroups("1")[0], slot: loadAppointmentGroups("1")[0].slots[0], unmarked: 1 },
    ]);
    expect(csv).toContain("Office hours");
    expect(csv).toContain("Alex Chen");
    expect(csv).toContain("confirmed");
    expect(csv).toContain("Room 12");
  });
});

describe("planner booked appointments", () => {
  it("includes the student's booked slot and skips open times", () => {
    writeGlobalStudentView(true);
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-planner",
      courseId: "1",
      title: "Advisor meeting",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 40 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    const user = loadUser();
    signUpForSlot("1", "apg-planner", group.slots[0].id, { id: user.id, name: user.name });
    const office = getUpcomingDeadlines("all").filter((item) =>
      item.label.includes("Advisor meeting"),
    );
    expect(office).toHaveLength(1);
    expect(office[0].type).toBe("office");
    expect(office[0].path).toContain("appointment=");
  });

  it("shows instructors booked meetings, not empty open slots", () => {
    writeGlobalStudentView(false);
    const start = Date.now() + 86_400_000;
    const group = upsertAppointmentGroup({
      id: "apg-planner-inst",
      courseId: "1",
      title: "Lab help",
      published: true,
      slots: generateAppointmentSlots({
        windowStart: start,
        windowEnd: start + 40 * 60 * 1000,
        durationMinutes: 20,
      }),
    });
    signUpForSlot("1", "apg-planner-inst", group.slots[0].id, { id: "a", name: "A" });
    const office = getUpcomingDeadlines("all").filter((item) => item.label.includes("Lab help"));
    expect(office).toHaveLength(1);
  });

  it("drops appointments that have already ended", () => {
    writeGlobalStudentView(true);
    const start = Date.now() - 2 * 60 * 60 * 1000;
    const past = {
      id: "appointment:past",
      courseId: "1",
      title: "Office hours",
      date: new Date(start),
      endDate: new Date(start + 20 * 60 * 1000),
      type: "appointment" as const,
      path: "/calendar",
      color: "#C0392B",
      courseShortName: "CS",
      appointmentMine: true,
      appointmentBooked: true,
    };
    expect(isBookedUpcomingAppointment(past, new Date())).toBe(false);
    const future = {
      ...past,
      id: "appointment:future",
      date: new Date(Date.now() + 86_400_000),
      endDate: new Date(Date.now() + 86_400_000 + 20 * 60 * 1000),
    };
    expect(isBookedUpcomingAppointment(future, new Date())).toBe(true);
  });
});

