import { describe, expect, it } from "vitest";
import type { AppointmentGroup, AppointmentSlot } from "./appointmentGroups";
import {
  addCalendarDays,
  filterFindAppointmentGroups,
  slotMatchesFindFilters,
  startOfDay,
  timeOfDayBucket,
} from "./findAppointmentFilters";

function slot(
  partial: Partial<AppointmentSlot> & Pick<AppointmentSlot, "id" | "startAt" | "endAt">,
): AppointmentSlot {
  return {
    maxParticipants: 1,
    signups: [],
    waitlist: [],
    ...partial,
  };
}

function group(
  partial: Partial<AppointmentGroup> & Pick<AppointmentGroup, "id" | "title" | "slots">,
): AppointmentGroup {
  return {
    courseId: "1",
    published: true,
    createdBy: "inst",
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

const afternoon = Date.parse("2026-08-25T13:00:00");
const morning = Date.parse("2026-08-25T09:00:00");
const now = Date.parse("2026-08-23T12:00:00");

describe("find appointment filters", () => {
  it("classifies morning, afternoon, and evening", () => {
    expect(timeOfDayBucket(Date.parse("2026-08-25T09:00:00"))).toBe("morning");
    expect(timeOfDayBucket(Date.parse("2026-08-25T13:00:00"))).toBe("afternoon");
    expect(timeOfDayBucket(Date.parse("2026-08-25T18:00:00"))).toBe("evening");
  });

  it("hides past slots unless the student already holds them", () => {
    const openPast = slot({
      id: "past",
      startAt: now - 2 * 60 * 60 * 1000,
      endAt: now - 60 * 60 * 1000,
    });
    const minePast = slot({
      id: "mine",
      startAt: now - 2 * 60 * 60 * 1000,
      endAt: now - 60 * 60 * 1000,
      signups: [{ studentId: "stu", studentName: "Sam", signedUpAt: now - 3 * 60 * 60 * 1000 }],
    });
    const base = {
      query: "",
      courseFilterId: "all",
      availability: "all" as const,
      timeOfDay: "any" as const,
      studentId: "stu",
      now,
    };
    expect(slotMatchesFindFilters(openPast, base)).toBe(false);
    expect(slotMatchesFindFilters(minePast, base)).toBe(true);
    expect(slotMatchesFindFilters(openPast, { ...base, includePast: true })).toBe(true);
  });

  it("filters by time of day, length, course, and search", () => {
    const office = group({
      id: "g1",
      title: "Office hours",
      location: "Zoom",
      slots: [
        slot({ id: "a", startAt: afternoon, endAt: afternoon + 20 * 60 * 1000 }),
        slot({ id: "m", startAt: morning, endAt: morning + 20 * 60 * 1000 }),
      ],
    });
    const advising = group({
      id: "g2",
      courseId: "2",
      title: "Advising",
      slots: [slot({ id: "b", startAt: afternoon, endAt: afternoon + 30 * 60 * 1000 })],
    });

    const base = {
      query: "",
      courseFilterId: "all",
      availability: "open" as const,
      timeOfDay: "any" as const,
      studentId: "stu",
      now,
      fromMs: startOfDay(afternoon),
    };

    expect(
      filterFindAppointmentGroups([office, advising], base, () => "CS")
        .flatMap((r) => r.slots)
        .map((s) => s.id),
    ).toEqual(["m", "a", "b"]);

    expect(
      filterFindAppointmentGroups([office, advising], { ...base, timeOfDay: "morning" }, () => "CS")
        .flatMap((r) => r.slots)
        .map((s) => s.id),
    ).toEqual(["m"]);

    expect(
      filterFindAppointmentGroups([office, advising], { ...base, durationMinutes: 30 }, () => "CS").map(
        (r) => r.group.title,
      ),
    ).toEqual(["Advising"]);

    expect(
      filterFindAppointmentGroups([office, advising], { ...base, courseFilterId: "2" }, () => "CS").map(
        (r) => r.group.id,
      ),
    ).toEqual(["g2"]);

    expect(
      filterFindAppointmentGroups([office, advising], { ...base, query: "zoom" }, () => "CS").map(
        (r) => r.group.title,
      ),
    ).toEqual(["Office hours"]);
  });

  it("matches search text inside HTML details", () => {
    const rich = group({
      id: "g-html",
      title: "Review",
      description: "<p>Bring your <strong>laptop</strong> and notes.</p>",
      slots: [slot({ id: "s-html", startAt: afternoon, endAt: afternoon + 20 * 60 * 1000 })],
    });
    const filters = {
      query: "laptop",
      courseFilterId: "all",
      availability: "all" as const,
      timeOfDay: "any" as const,
      studentId: "stu",
      now,
    };
    expect(
      filterFindAppointmentGroups([rich], filters, () => "CS").map((r) => r.group.id),
    ).toEqual(["g-html"]);
    expect(filterFindAppointmentGroups([rich], { ...filters, query: "strong" }, () => "CS")).toEqual(
      [],
    );
  });

  it("keeps the focused group first", () => {
    const later = group({
      id: "later",
      title: "Later",
      slots: [slot({ id: "l", startAt: afternoon, endAt: afternoon + 20 * 60 * 1000 })],
    });
    const focus = group({
      id: "focus",
      title: "Focus",
      slots: [slot({ id: "f", startAt: morning, endAt: morning + 20 * 60 * 1000 })],
    });
    const rows = filterFindAppointmentGroups(
      [later, focus],
      {
        query: "",
        courseFilterId: "all",
        availability: "all",
        timeOfDay: "any",
        studentId: "stu",
        now,
      },
      () => "CS",
      "later",
    );
    expect(rows.map((r) => r.group.id)).toEqual(["later", "focus"]);
  });

  it("adds calendar days from the start of the day", () => {
    const start = startOfDay(Date.parse("2026-08-23T15:00:00"));
    expect(addCalendarDays(start, 6)).toBe(startOfDay(Date.parse("2026-08-29T08:00:00")));
  });
});
