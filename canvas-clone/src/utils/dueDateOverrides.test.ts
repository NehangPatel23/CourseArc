// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  addSection,
  deleteSection,
  getSectionForStudent,
  getStudentSectionName,
  isItemVisibleToStudent,
  isModuleVisibleToStudent,
  loadSections,
  setStudentSection,
} from "./courseSections";
import type { ModuleT } from "./modules";
import {
  getEffectiveDueAt,
  listCalendarDueVariants,
  replaceItemOverrides,
  resolveEffectiveDates,
  hasDueDateOverrides,
  applyEffectiveDates,
} from "./dueDateOverrides";

beforeEach(() => {
  window.localStorage.clear();
});

describe("course sections", () => {
  it("seeds two sections and looks up a student", () => {
    const sections = loadSections("1");
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0].name).toMatch(/Section/);
    const studentId = sections[0].studentIds[0];
    if (studentId) {
      expect(getSectionForStudent("1", studentId)?.id).toBe(sections[0].id);
      expect(getStudentSectionName("1", studentId)).toBe(sections[0].name);
    }
  });

  it("moves a student between sections", () => {
    const sections = loadSections("1");
    const extra = addSection("1", { name: "Honors" });
    const studentId = sections.flatMap((s) => s.studentIds)[0] ?? "demo_alex";
    setStudentSection("1", studentId, extra.id);
    expect(getSectionForStudent("1", studentId)?.id).toBe(extra.id);
    setStudentSection("1", studentId, null);
    expect(getSectionForStudent("1", studentId)).toBeUndefined();
  });

  it("hides a module assigned to another section", () => {
    const sections = loadSections("1");
    const a = sections[0];
    const b = sections[1] ?? addSection("1", { name: "Section 002" });
    const studentId = a.studentIds[0] ?? "demo_alex";
    setStudentSection("1", studentId, a.id);
    const mod: ModuleT = {
      title: "Week 1",
      items: [],
      assignedSectionIds: [b.id],
    };
    expect(isModuleVisibleToStudent(mod, "1", studentId)).toBe(false);
    expect(isModuleVisibleToStudent({ ...mod, assignedSectionIds: [a.id] }, "1", studentId)).toBe(
      true,
    );
    expect(isModuleVisibleToStudent({ title: "Open", items: [] }, "1", studentId)).toBe(true);
  });

  it("deletes a section", () => {
    addSection("1", { name: "Temp" });
    const before = loadSections("1").length;
    const doomed = loadSections("1").find((s) => s.name === "Temp");
    expect(doomed).toBeTruthy();
    deleteSection("1", doomed!.id);
    expect(loadSections("1").length).toBe(before - 1);
  });
});

describe("due date overrides", () => {
  it("student override beats section override beats default", () => {
    const sections = loadSections("1");
    const section = sections[0];
    const studentId = section?.studentIds[0] ?? "demo_alex";
    if (section) setStudentSection("1", studentId, section.id);

    const defaultDue = 1_000;
    const sectionDue = 2_000;
    const studentDue = 3_000;

    replaceItemOverrides("1", "assignment", "asg1", [
      {
        id: "ddo_sec",
        targetKind: "section",
        targetId: section?.id ?? "sec",
        dueAt: sectionDue,
      },
      {
        id: "ddo_stu",
        targetKind: "student",
        targetId: studentId,
        dueAt: studentDue,
      },
    ]);

    expect(getEffectiveDueAt("1", "assignment", "asg1", defaultDue, studentId)).toBe(studentDue);

    replaceItemOverrides("1", "assignment", "asg1", [
      {
        id: "ddo_sec",
        targetKind: "section",
        targetId: section?.id ?? "sec",
        dueAt: sectionDue,
      },
    ]);
    expect(getEffectiveDueAt("1", "assignment", "asg1", defaultDue, studentId)).toBe(sectionDue);
    expect(getEffectiveDueAt("1", "assignment", "asg1", defaultDue, "nobody")).toBe(defaultDue);
  });

  it("lists instructor calendar variants including everyone else", () => {
    loadSections("1");
    replaceItemOverrides("1", "quiz", "q1", [
      { id: "ddo1", targetKind: "section", targetId: loadSections("1")[0].id, dueAt: 5_000 },
    ]);
    const variants = listCalendarDueVariants("1", "quiz", "q1", 1_000);
    expect(variants.some((v) => v.label === "Everyone else" && v.dueAt === 1_000)).toBe(true);
    expect(variants.some((v) => v.dueAt === 5_000)).toBe(true);
  });

  it("merges availability fields from the override", () => {
    const studentId = "demo_alex";
    replaceItemOverrides("1", "assignment", "asg2", [
      {
        id: "ddo_av",
        targetKind: "student",
        targetId: studentId,
        availableUntil: 9_000,
      },
    ]);
    const resolved = resolveEffectiveDates(
      "1",
      "assignment",
      "asg2",
      { dueAt: 1_000, availableFrom: 100, availableUntil: 2_000 },
      studentId,
    );
    expect(resolved.dueAt).toBe(1_000);
    expect(resolved.availableFrom).toBe(100);
    expect(resolved.availableUntil).toBe(9_000);
    expect(resolved.overrideLabel).toBeTruthy();
  });

  it("applies effective dates onto an item and detects overrides", () => {
    loadSections("1");
    const studentId = "demo_alex";
    replaceItemOverrides("1", "quiz", "q-apply", [
      { id: "ddo_app", targetKind: "student", targetId: studentId, dueAt: 42_000, availableFrom: 10 },
    ]);
    expect(hasDueDateOverrides("1", "quiz", "q-apply")).toBe(true);
    const merged = applyEffectiveDates(
      "1",
      "quiz",
      { id: "q-apply", dueAt: 1, availableFrom: 2, availableUntil: 3 },
      studentId,
    );
    expect(merged.dueAt).toBe(42_000);
    expect(merged.availableFrom).toBe(10);
    expect(merged.availableUntil).toBe(3);
  });
});

describe("item section visibility", () => {
  it("hides items assigned to another section", () => {
    const sections = loadSections("1");
    const home = sections[0];
    expect(home).toBeTruthy();
    const other = addSection("1", { name: "Other" });
    const studentId = home.studentIds[0] ?? "demo_alex";
    setStudentSection("1", studentId, home.id);
    expect(
      isItemVisibleToStudent({ type: "page", label: "All" }, "1", studentId),
    ).toBe(true);
    expect(
      isItemVisibleToStudent(
        { type: "page", label: "Other only", assignedSectionIds: [other.id] },
        "1",
        studentId,
      ),
    ).toBe(false);
    expect(
      isItemVisibleToStudent(
        { type: "page", label: "Home only", assignedSectionIds: [home.id] },
        "1",
        studentId,
      ),
    ).toBe(true);
  });
});

describe("canStudentTakeQuiz with availability overrides", () => {
  it("uses overridden availableFrom / availableUntil", async () => {
    const { canStudentTakeQuiz } = await import("./quizzes");
    const now = Date.parse("2026-06-01T12:00:00Z");
    const quiz = {
      id: "q-gate",
      title: "Gated quiz",
      published: true,
      status: "published" as const,
      questions: [
        {
          id: "qq1",
          type: "true_false" as const,
          prompt: "True?",
          points: 1,
          correctTrueFalse: true,
        },
      ],
      availableFrom: now + 86_400_000,
      availableUntil: now + 2 * 86_400_000,
    };
    expect(canStudentTakeQuiz(quiz, now)).toBe(false);
    replaceItemOverrides("1", "quiz", "q-gate", [
      {
        id: "ovr1",
        targetKind: "student",
        targetId: "stu1",
        availableFrom: now - 1_000,
        availableUntil: now + 86_400_000,
      },
    ]);
    expect(
      canStudentTakeQuiz(quiz, now, { courseId: "1", studentId: "stu1" }),
    ).toBe(true);
    expect(
      canStudentTakeQuiz(quiz, now, { courseId: "1", studentId: "other" }),
    ).toBe(false);
  });
});
