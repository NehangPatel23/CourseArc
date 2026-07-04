import { getCourseBadgeCount } from "./activity";
import { getCourseHealth } from "./courseHealth";
import { getNextDueForCourse } from "./deadlines";
import { getCourseProgressPercent } from "./dashboard";
import { loadCourses } from "./coursesStore";
import type { AlertTone } from "./alertTypes";

export type CourseAlert = {
  tone: AlertTone;
  label: string;
  detail?: string;
  priority: number;
};

export function getCourseAlerts(
  courseId: string,
  studentView: boolean,
): CourseAlert[] {
  const course = loadCourses().find((c) => c.id === courseId);
  if (!course) return [];

  const alerts: CourseAlert[] = [];

  if (!course.published) {
    alerts.push({ tone: "negative", label: "Draft", priority: 3 });
  }

  const badge = getCourseBadgeCount(courseId);
  if (badge.total > 0) {
    alerts.push({
      tone: "negative",
      label: `${badge.total} unread`,
      detail: `${badge.unreadAnnouncements} announcements, ${badge.newContent} new`,
      priority: 2,
    });
  }

  const nextDue = getNextDueForCourse(courseId);
  if (nextDue?.overdue) {
    alerts.push({ tone: "negative", label: "Overdue", detail: nextDue.label, priority: 1 });
  } else if (nextDue && studentView) {
    alerts.push({
      tone: "neutral",
      label: `Due ${nextDue.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      priority: 4,
    });
  }

  if (studentView) {
    const progress = getCourseProgressPercent(courseId);
    if (progress >= 100) {
      alerts.push({ tone: "positive", label: "Complete", priority: 5 });
    }
  } else {
    const { issues } = getCourseHealth(courseId);
    if (issues.length > 0) {
      alerts.push({
        tone: "negative",
        label: `${issues.length} issue${issues.length > 1 ? "s" : ""}`,
        priority: 2,
      });
    } else if (course.published) {
      alerts.push({ tone: "positive", label: "Live", priority: 6 });
    }
  }

  if (studentView && course.published && alerts.every((a) => a.tone === "positive" || a.priority >= 5)) {
    return alerts.filter((a) => a.label !== "Complete" || alerts.length === 1).slice(0, 1);
  }

  return alerts.sort((a, b) => a.priority - b.priority).slice(0, 2);
}

export function getHeroStatTone(
  label: string,
  value: string | number,
  studentView: boolean,
): AlertTone | undefined {
  if (studentView) {
    if (label === "Due this week" && Number(value) > 0) return "negative";
    if (label === "Term GPA") {
      const gpa = parseFloat(String(value));
      if (!Number.isNaN(gpa) && gpa >= 3.5) return "positive";
      if (!Number.isNaN(gpa) && gpa < 3.0) return "negative";
    }
    return undefined;
  }

  if (label === "Drafts" || label === "Draft needs publishing") {
    return Number(value) > 0 ? "negative" : "positive";
  }
  if (label === "Published") return "positive";
  return undefined;
}

export type HeroStatAction =
  | { type: "navigate"; href: string }
  | { type: "filter"; filter: "all" | "published" | "unpublished" }
  | { type: "term"; term: string | null };

export function getHeroStatAction(
  label: string,
  studentView: boolean,
  activeTerm: string | null,
): HeroStatAction | undefined {
  if (label === "Due this week") return { type: "navigate", href: "/calendar" };
  if (label === "Drafts" || label === "Draft needs publishing") {
    return { type: "filter", filter: "unpublished" };
  }
  if (label === "Published") return { type: "filter", filter: "published" };
  if (label === "Current term" && activeTerm) return { type: "term", term: activeTerm };
  if (label === "Enrolled courses" && studentView) return { type: "filter", filter: "all" };
  return undefined;
}
