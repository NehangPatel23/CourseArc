// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  canAddStudents,
  canCreateCourses,
  canEditAssignments,
  canEditCourseContent,
  canEditPages,
  canPublishCourse,
  canManageAccommodations,
  canManageCalendarSchedule,
  canManageCourse,
  canManageStaffRoster,
  isInstructorView,
  isStaffView,
  isStudentView,
  isTaView,
  staffCommentRole,
} from "./permissions";
import {
  applyDemoPersonaOverlay,
  DEMO_SELF_PERSONA_ID,
  DEMO_TA_PERSONA_ID,
  getActiveStudentId,
  type PersonaOverlayUser,
} from "./demoPersona";
import {
  readStudentView,
  readViewAs,
  setViewAs,
  VIEW_AS_KEY,
  writeGlobalStudentView,
} from "./studentView";
import { loginAs } from "./userStore";

const STORED: PersonaOverlayUser = {
  id: "1",
  name: "Nehang Patel",
  email: "nehang@example.edu",
  avatarInitials: "NP",
  avatarColor: "#008EE2",
  role: "instructor",
  enrolledCourseIds: ["1", "2"],
};

const VIEWS = ["student", "ta", "instructor"] as const;

beforeEach(() => {
  window.localStorage.clear();
});

describe("permissions matrix", () => {
  const cases = {
    isStudentView: { student: true, ta: false, instructor: false },
    isTaView: { student: false, ta: true, instructor: false },
    isInstructorView: { student: false, ta: false, instructor: true },
    isStaffView: { student: false, ta: true, instructor: true },
    canEditCourseContent: { student: false, ta: true, instructor: true },
    canEditAssignments: { student: false, ta: true, instructor: true },
    canEditPages: { student: false, ta: true, instructor: true },
    canPublishCourse: { student: false, ta: true, instructor: true },
    canManageCourse: { student: false, ta: false, instructor: true },
    canManageStaffRoster: { student: false, ta: false, instructor: true },
    canAddStudents: { student: false, ta: true, instructor: true },
    canManageAccommodations: { student: false, ta: true, instructor: true },
    canManageCalendarSchedule: { student: false, ta: true, instructor: true },
    canCreateCourses: { student: false, ta: false, instructor: true },
    staffCommentRole: { student: "instructor", ta: "ta", instructor: "instructor" },
  } as const;

  const fns = {
    isStudentView,
    isTaView,
    isInstructorView,
    isStaffView,
    canEditCourseContent,
    canEditAssignments,
    canEditPages,
    canPublishCourse,
    canManageCourse,
    canManageStaffRoster,
    canAddStudents,
    canManageAccommodations,
    canManageCalendarSchedule,
    canCreateCourses,
    staffCommentRole,
  };

  for (const view of VIEWS) {
    it(`matches Canvas-style TA matrix for ${view}`, () => {
      for (const [name, expected] of Object.entries(cases)) {
        expect(fns[name as keyof typeof fns](view)).toBe(expected[view]);
      }
    });
  }
});

describe("readViewAs migration", () => {
  it("defaults to student when nothing is stored", () => {
    expect(readViewAs()).toBe("student");
    expect(readStudentView()).toBe(true);
  });

  it("migrates legacy studentView true to student", () => {
    window.localStorage.setItem("canvasClone:studentView:global", "true");
    expect(readViewAs()).toBe("student");
    expect(readStudentView()).toBe(true);
  });

  it("migrates legacy studentView false to instructor", () => {
    window.localStorage.setItem("canvasClone:studentView:global", "false");
    expect(readViewAs()).toBe("instructor");
    expect(readStudentView()).toBe(false);
  });

  it("prefers viewAs over the legacy boolean", () => {
    window.localStorage.setItem("canvasClone:studentView:global", "false");
    window.localStorage.setItem(VIEW_AS_KEY, "ta");
    expect(readViewAs()).toBe("ta");
    expect(readStudentView()).toBe(false);
  });

  it("writeGlobalStudentView(false) stores instructor, not ta", () => {
    setViewAs("ta");
    writeGlobalStudentView(false);
    expect(readViewAs()).toBe("instructor");
  });

  it("setViewAs(ta) sets Taylor as the active persona", () => {
    setViewAs("ta");
    expect(getActiveStudentId()).toBe(DEMO_TA_PERSONA_ID);
  });

  it("leaving TA view for student does not keep Taylor as the student persona", () => {
    setViewAs("ta");
    setViewAs("student");
    expect(getActiveStudentId()).toBe(DEMO_SELF_PERSONA_ID);
  });
});

describe("demo persona overlay", () => {
  it("returns the stored instructor in instructor view", () => {
    setViewAs("instructor");
    const user = applyDemoPersonaOverlay(STORED);
    expect(user.id).toBe("1");
    expect(user.name).toBe("Nehang Patel");
    expect(user.role).toBe("instructor");
  });

  it("overlays Taylor Kim only in TA view", () => {
    setViewAs("ta");
    const user = applyDemoPersonaOverlay(STORED);
    expect(user.id).toBe(DEMO_TA_PERSONA_ID);
    expect(user.name).toBe("Taylor Kim");
    expect(user.email).toBe("taylor.kim@example.edu");
    expect(user.role).toBe("ta");
  });

  it("does not overlay Taylor in student view", () => {
    setViewAs("ta");
    setViewAs("student");
    const user = applyDemoPersonaOverlay(STORED);
    expect(user.id).not.toBe(DEMO_TA_PERSONA_ID);
    expect(user.role).toBe("student");
  });

  it("loginAs student keeps named demo personas", () => {
    loginAs("student", "demo_alex");
    expect(readViewAs()).toBe("student");
    expect(getActiveStudentId()).toBe("demo_alex");
    expect(applyDemoPersonaOverlay(STORED).name).toBe("Alex Chen");

    loginAs("student", "demo_jordan");
    expect(getActiveStudentId()).toBe("demo_jordan");
    expect(applyDemoPersonaOverlay(STORED).name).toBe("Jordan Lee");

    loginAs("student", "demo_sam");
    expect(getActiveStudentId()).toBe("demo_sam");
    expect(applyDemoPersonaOverlay(STORED).name).toBe("Sam Rivera");
  });
});
