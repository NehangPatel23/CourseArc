// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { saveAssignments, type Assignment } from "./assignments";
import {
  addGroupToSet,
  addGroupSet,
  getGroupForStudent,
  getGroupmateIds,
  loadGroupSets,
  setStudentGroup,
} from "./groupSets";
import { copyLibraryRubric, resolveAssignmentRubric, saveLibraryRubric } from "./rubricLibrary";
import { saveSections } from "./courseSections";
import { studentAttendanceSummary, upsertAttendanceSession } from "./attendance";
import { saveDueDateOverrides } from "./dueDateOverrides";
import {
  applySyllabusSummaryItems,
  filterAndSortCourseSummaryItems,
  getCourseSummaryItems,
  loadSyllabus,
  saveSyllabus,
  withSyllabusHeadingIds,
} from "./syllabus";
import { saveUser } from "./userStore";
import { createEssayRubricCriterion } from "./assignmentRubric";

beforeEach(() => {
  window.localStorage.clear();
  saveUser({
    id: "stu_a",
    name: "Ada",
    email: "ada@example.edu",
    avatarInitials: "A",
    role: "student",
    enrolledCourseIds: ["c1"],
  });
});

describe("syllabus", () => {
  it("seeds a course syllabus with the course summary enabled", () => {
    const s = loadSyllabus("c1");
    expect(s.showCourseSummary).toBe(true);
    expect(s.content.length).toBeGreaterThan(20);
  });

  it("saves instructor edits", () => {
    saveSyllabus("c1", { content: "<p>Lab safety first.</p>", showCourseSummary: false });
    const s = loadSyllabus("c1");
    expect(s.content).toContain("Lab safety");
    expect(s.showCourseSummary).toBe(false);
  });

  it("builds a course summary from assignments and quizzes", () => {
    saveAssignments("c1", [
      {
        id: "a1",
        title: "Homework 1",
        dueAt: Date.parse("2026-09-01T23:59:00"),
        points: 10,
        published: true,
        status: "published",
      },
    ]);
    const rows = getCourseSummaryItems("c1");
    expect(rows.some((r) => r.title === "Homework 1" && r.kind === "assignment")).toBe(true);
  });

  it("filters upcoming items and sorts by title", () => {
    saveAssignments("c1", [
      {
        id: "a1",
        title: "Zebra",
        dueAt: Date.parse("2026-09-01T23:59:00"),
        published: true,
        status: "published",
      },
      {
        id: "a2",
        title: "Apple",
        dueAt: Date.parse("2026-07-01T23:59:00"),
        published: true,
        status: "published",
      },
    ]);
    const rows = getCourseSummaryItems("c1").filter((r) => r.id === "a1" || r.id === "a2");
    const upcoming = filterAndSortCourseSummaryItems(rows, {
      when: "upcoming",
      sortKey: "title",
      sortDir: "asc",
      now: Date.parse("2026-08-01T00:00:00"),
    });
    expect(upcoming.map((r) => r.title)).toEqual(["Zebra"]);
    const byTitle = filterAndSortCourseSummaryItems(rows, {
      sortKey: "title",
      sortDir: "asc",
    });
    expect(byTitle.map((r) => r.title)).toEqual(["Apple", "Zebra"]);
  });

  it("adds ids to syllabus headings", () => {
    const { html, headings } = withSyllabusHeadingIds(
      "<h2>How to succeed</h2><p>Read the modules.</p><h3>Late work</h3>",
    );
    expect(headings.map((h) => h.text)).toEqual(["How to succeed", "Late work"]);
    expect(html).toContain('id="syllabus-how-to-succeed"');
    expect(html).toContain('id="syllabus-late-work"');
  });

  it("writes course summary title and points back onto the assignment", () => {
    saveAssignments("c1", [
      {
        id: "a1",
        title: "Homework 1",
        dueAt: Date.parse("2026-09-01T23:59:00"),
        points: 10,
        published: true,
        status: "published",
      },
    ]);
    const rows = getCourseSummaryItems("c1").filter((r) => r.id === "a1");
    applySyllabusSummaryItems("c1", [{ ...rows[0], title: "Problem set 1", points: 25 }]);
    const updated = getCourseSummaryItems("c1").find((r) => r.id === "a1");
    expect(updated?.title).toBe("Problem set 1");
    expect(updated?.points).toBe(25);
  });

  it("uses student due date overrides in the course summary", () => {
    const baseDue = Date.parse("2026-09-01T23:59:00");
    const overrideDue = Date.parse("2026-10-01T23:59:00");
    saveAssignments("c1", [
      {
        id: "a1",
        title: "Homework 1",
        dueAt: baseDue,
        points: 10,
        published: true,
        status: "published",
      },
    ]);
    saveDueDateOverrides("c1", [
      {
        id: "o1",
        itemKind: "assignment",
        itemId: "a1",
        targetKind: "student",
        targetId: "stu_a",
        dueAt: overrideDue,
      },
    ]);
    const instructor = getCourseSummaryItems("c1").find((r) => r.id === "a1");
    const student = getCourseSummaryItems("c1", {
      studentView: true,
      studentId: "stu_a",
    }).find((r) => r.id === "a1");
    expect(instructor?.dueAt).toBe(baseDue);
    expect(student?.dueAt).toBe(overrideDue);
  });
});

describe("group sets", () => {
  it("assigns a student to one group per set", () => {
    const set = addGroupSet("c1", { name: "Labs" });
    const g1 = addGroupToSet("c1", set.id, { name: "Lab 1" });
    const g2 = addGroupToSet("c1", set.id, { name: "Lab 2" });
    expect(g1 && g2).toBeTruthy();
    setStudentGroup("c1", set.id, "stu_a", g1!.id);
    setStudentGroup("c1", set.id, "stu_a", g2!.id);
    expect(getGroupForStudent("c1", set.id, "stu_a")?.id).toBe(g2!.id);
    expect(getGroupmateIds("c1", set.id, "stu_a")).toEqual(["stu_a"]);
  });

  it("enforces max group size and same-section membership", () => {
    saveSections("c1", [
      { id: "sec_a", name: "Section A", studentIds: ["stu_a"] },
      { id: "sec_b", name: "Section B", studentIds: ["stu_b"] },
    ]);
    const capped = addGroupSet("c1", { name: "Pairs", maxGroupSize: 1 });
    const one = addGroupToSet("c1", capped.id, { name: "Pair 1" });
    expect(setStudentGroup("c1", capped.id, "stu_a", one!.id)).toBe(true);
    expect(setStudentGroup("c1", capped.id, "stu_b", one!.id)).toBe(false);

    const sectional = addGroupSet("c1", { name: "Labs", sameSectionOnly: true });
    const lab = addGroupToSet("c1", sectional.id, { name: "Lab A" });
    expect(setStudentGroup("c1", sectional.id, "stu_a", lab!.id)).toBe(true);
    expect(setStudentGroup("c1", sectional.id, "stu_b", lab!.id)).toBe(false);
  });
});

describe("rubric library", () => {
  it("resolves an attached library rubric for GradePro", () => {
    const criterion = createEssayRubricCriterion("Clarity", 10);
    const saved = saveLibraryRubric("c1", { title: "Clarity rubric", criteria: [criterion] });
    const assignment: Assignment = {
      id: "a1",
      title: "Essay",
      points: 10,
      rubricId: saved.id,
    };
    const rubric = resolveAssignmentRubric("c1", assignment, 10);
    expect(rubric[0]?.title).toBe("Clarity");
  });

  it("falls back to the generated assignment rubric", () => {
    const rubric = resolveAssignmentRubric("c1", { id: "a1", title: "X", points: 100 }, 100);
    expect(rubric.length).toBeGreaterThan(0);
  });

  it("copies a rubric into another course", () => {
    const saved = saveLibraryRubric("c1", {
      title: "Source rubric",
      criteria: [createEssayRubricCriterion("Voice", 5)],
    });
    const copied = copyLibraryRubric("c1", saved.id, "c2");
    expect(copied?.title).toBe("Source rubric");
    expect(copied?.id).not.toBe(saved.id);
    expect(copied?.criteria[0]?.title).toBe("Voice");
  });
});

describe("attendance", () => {
  it("records roll-call status for a student", () => {
    upsertAttendanceSession("c1", {
      date: "2026-08-28",
      records: { stu_a: "present", stu_b: "absent" },
    });
    expect(studentAttendanceSummary("c1", "stu_a").counts.present).toBe(1);
    expect(studentAttendanceSummary("c1", "stu_b").counts.absent).toBe(1);
  });
});
