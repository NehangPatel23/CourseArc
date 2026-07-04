import { loadAnnouncements, saveAnnouncements } from "./announcements";
import { loadModulesFromStorage } from "./modules";
import { loadCourses, updateCourse, type Course } from "./coursesStore";

export type HealthIssue = {
  id: string;
  label: string;
  href: string;
  severity: "warning" | "info";
};

export function getCourseHealth(courseId: string): { issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const course = loadCourses().find((c) => c.id === courseId);
  if (!course) return { issues };

  if (!course.published) {
    issues.push({
      id: "unpublished",
      label: "Course is not published",
      href: `/courses/${courseId}/home`,
      severity: "warning",
    });
  }

  const modules = loadModulesFromStorage();
  if (modules.length === 0 || modules.every((m) => m.items.length === 0)) {
    issues.push({
      id: "empty-modules",
      label: "No module content",
      href: `/courses/${courseId}/modules`,
      severity: "warning",
    });
  }

  const drafts = loadAnnouncements(courseId).filter((a) => a.status === "draft");
  if (drafts.length > 0) {
    issues.push({
      id: "draft-announcements",
      label: `${drafts.length} draft announcement${drafts.length > 1 ? "s" : ""}`,
      href: `/courses/${courseId}/announcements`,
      severity: "info",
    });
  }

  return { issues };
}

export function getAllCourseHealthIssues(): { course: Course; issues: HealthIssue[] }[] {
  return loadCourses()
    .map((course) => ({ course, issues: getCourseHealth(course.id).issues }))
    .filter((x) => x.issues.length > 0);
}

export function countDraftCourses(): number {
  return loadCourses().filter((c) => !c.published && !c.archived).length;
}

export function publishAllDraftCourses(): number {
  const drafts = loadCourses().filter((c) => !c.published && !c.archived);
  for (const c of drafts) updateCourse(c.id, { published: true });
  return drafts.length;
}

export function publishAllDraftAnnouncements(): number {
  let count = 0;
  for (const c of loadCourses()) {
    const anns = loadAnnouncements(c.id);
    let changed = false;
    const next = anns.map((a) => {
      if (a.status === "draft") {
        count++;
        changed = true;
        return { ...a, status: "published" as const, postedAt: a.postedAt || Date.now() };
      }
      return a;
    });
    if (changed) saveAnnouncements(c.id, next);
  }
  return count;
}
