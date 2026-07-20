import { loadSettings } from "./settingsStore";
import { readStudentView } from "./studentView";

export type NotificationAudience = "student" | "instructor" | "all";

export type NotificationKind =
  | "grades_posted"
  | "announcement"
  | "assignment_due"
  | "submission_received"
  | "quiz_submitted"
  | "discussion_submitted"
  | "system";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  audience: NotificationAudience;
  title: string;
  body: string;
  unread: boolean;
  courseId?: string;
  href?: string;
  timestamp: number;
};

export const NOTIFICATIONS_CHANGED_EVENT = "canvasClone:notificationsChanged";

const NOTIFICATIONS_KEY = "canvasClone:notifications";

const SEED: AppNotification[] = [
  {
    id: "seed_student_welcome",
    kind: "system",
    audience: "student",
    title: "Student notifications",
    body: "You’ll see grade posts, new announcements, and due reminders here.",
    unread: false,
    timestamp: Date.now() - 172800000,
  },
  {
    id: "seed_instructor_welcome",
    kind: "system",
    audience: "instructor",
    title: "Instructor notifications",
    body: "You’ll see new submissions, grading alerts, and confirmations when you release grades or publish announcements.",
    unread: false,
    timestamp: Date.now() - 172800000,
  },
];

function currentAudience(): "student" | "instructor" {
  return readStudentView() ? "student" : "instructor";
}

function normalize(n: Partial<AppNotification> & Pick<AppNotification, "id" | "kind" | "title" | "body" | "unread" | "timestamp">): AppNotification {
  const audience =
    n.audience ??
    (n.kind === "submission_received" ||
    n.kind === "quiz_submitted" ||
    n.kind === "discussion_submitted"
      ? "instructor"
      : n.kind === "system"
        ? "all"
        : "student");
  return {
    id: n.id,
    kind: n.kind,
    audience,
    title: n.title,
    body: n.body,
    unread: n.unread,
    courseId: n.courseId,
    href: n.href,
    timestamp: n.timestamp,
  };
}

function matchesAudience(n: AppNotification, audience: "student" | "instructor") {
  return n.audience === "all" || n.audience === audience;
}

function readAll(): AppNotification[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return SEED.map((n) => ({ ...n }));
    const parsed = JSON.parse(raw) as Partial<AppNotification>[];
    if (!Array.isArray(parsed)) return SEED.map((n) => ({ ...n }));
    return parsed
      .filter((n): n is Partial<AppNotification> & Pick<AppNotification, "id" | "kind" | "title" | "body" | "unread" | "timestamp"> =>
        Boolean(n && n.id && n.kind && n.title && n.body != null && typeof n.unread === "boolean" && typeof n.timestamp === "number"),
      )
      .map(normalize);
  } catch {
    return SEED.map((n) => ({ ...n }));
  }
}

function saveAll(items: AppNotification[]) {
  try {
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  } catch {}
}

/** Notifications visible for the current student/instructor role. */
export function loadNotifications(): AppNotification[] {
  const audience = currentAudience();
  return readAll()
    .filter((n) => matchesAudience(n, audience))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getUnreadNotificationCount(): number {
  const audience = currentAudience();
  return readAll().filter((n) => n.unread && matchesAudience(n, audience)).length;
}

export function getEffectiveUnreadNotificationCount(): number {
  return getUnreadNotificationCount();
}

export function markNotificationRead(id: string) {
  saveAll(readAll().map((n) => (n.id === id ? { ...n, unread: false } : n)));
}

/** Mark read only for the current role’s notifications. */
export function markAllNotificationsRead() {
  const audience = currentAudience();
  saveAll(
    readAll().map((n) =>
      matchesAudience(n, audience) ? { ...n, unread: false } : n,
    ),
  );
}

export function deleteNotification(id: string) {
  saveAll(readAll().filter((n) => n.id !== id));
}

/** Clear read notifications for the current role only. */
export function deleteReadNotifications() {
  const audience = currentAudience();
  saveAll(
    readAll().filter((n) => {
      if (!matchesAudience(n, audience)) return true;
      return n.unread;
    }),
  );
}

function pushNotification(
  input: Omit<AppNotification, "id" | "unread" | "timestamp"> & {
    unread?: boolean;
    timestamp?: number;
  },
): AppNotification {
  const notification: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    kind: input.kind,
    audience: input.audience,
    title: input.title,
    body: input.body,
    courseId: input.courseId,
    href: input.href,
    unread: input.unread ?? true,
    timestamp: input.timestamp ?? Date.now(),
  };
  saveAll([notification, ...readAll()]);
  return notification;
}

/** Grades made visible — student alert + instructor confirmation. */
export function notifyGradesPosted(
  courseId: string,
  courseTitle: string,
  individual = false,
) {
  pushNotification({
    kind: "grades_posted",
    audience: "student",
    title: individual
      ? `Your grade for ${courseTitle} is now available`
      : `Grades posted — ${courseTitle}`,
    body: individual
      ? `Your instructor has posted your grade for ${courseTitle}. Open the gradebook to review your scores and feedback.`
      : `Your instructor has posted grades for ${courseTitle}. Open the gradebook to review your scores and feedback.`,
    courseId,
    href: `/courses/${courseId}/grades`,
  });
  pushNotification({
    kind: "grades_posted",
    audience: "instructor",
    title: individual
      ? `Grade released successfully — ${courseTitle}`
      : `Grades released successfully — ${courseTitle}`,
    body: individual
      ? `A student’s grade for ${courseTitle} is now visible to them.`
      : `Grades for ${courseTitle} are now visible to students.`,
    courseId,
    href: `/courses/${courseId}/grades`,
  });
}

/** Announcement published — student alert + instructor confirmation. */
export function notifyAnnouncementPublished(
  courseId: string,
  courseTitle: string,
  announcementTitle: string,
  announcementId: string,
) {
  if (!loadSettings().notifyAnnouncements) return null;
  const href = `/courses/${courseId}/announcements/${announcementId}`;
  pushNotification({
    kind: "announcement",
    audience: "student",
    title: `New announcement: ${announcementTitle}`,
    body: `A new announcement was published in ${courseTitle}.`,
    courseId,
    href,
  });
  pushNotification({
    kind: "announcement",
    audience: "instructor",
    title: `Announcement published — ${announcementTitle}`,
    body: `“${announcementTitle}” is now live for students in ${courseTitle}.`,
    courseId,
    href,
  });
}

/** Assignment due soon — student reminder + instructor heads-up. */
export function notifyAssignmentDueSoon(
  courseId: string,
  courseTitle: string,
  assignmentTitle: string,
  assignmentId: string,
  dueAt: number,
) {
  if (!loadSettings().notifyAssignments) return null;
  const dueLabel = new Date(dueAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const href = `/courses/${courseId}/assignments/${assignmentId}`;
  pushNotification({
    kind: "assignment_due",
    audience: "student",
    title: `Due soon: ${assignmentTitle}`,
    body: `${assignmentTitle} in ${courseTitle} is due ${dueLabel}.`,
    courseId,
    href,
  });
  pushNotification({
    kind: "assignment_due",
    audience: "instructor",
    title: `Upcoming due date: ${assignmentTitle}`,
    body: `${assignmentTitle} in ${courseTitle} is due ${dueLabel}. Students may need a reminder.`,
    courseId,
    href,
  });
}

/** Instructor: student submitted an assignment. */
export function notifySubmissionReceived(input: {
  courseId: string;
  courseTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string;
}) {
  return pushNotification({
    kind: "submission_received",
    audience: "instructor",
    title: `New submission: ${input.assignmentTitle}`,
    body: `${input.studentName} submitted ${input.assignmentTitle} in ${input.courseTitle}.`,
    courseId: input.courseId,
    href: `/courses/${input.courseId}/assignments/${input.assignmentId}/grade`,
  });
}

/** Instructor: student submitted a quiz (especially when manual grading is needed). */
export function notifyQuizSubmitted(input: {
  courseId: string;
  courseTitle: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  needsManualGrading: boolean;
}) {
  return pushNotification({
    kind: "quiz_submitted",
    audience: "instructor",
    title: input.needsManualGrading
      ? `Needs grading: ${input.quizTitle}`
      : `Quiz submitted: ${input.quizTitle}`,
    body: input.needsManualGrading
      ? `${input.studentName} submitted ${input.quizTitle} in ${input.courseTitle} and needs manual grading.`
      : `${input.studentName} submitted ${input.quizTitle} in ${input.courseTitle}.`,
    courseId: input.courseId,
    href: `/courses/${input.courseId}/quizzes/${input.quizId}/grade`,
  });
}

/** Instructor: graded discussion participation ready to score. */
export function notifyDiscussionSubmitted(input: {
  courseId: string;
  courseTitle: string;
  topicId: string;
  topicTitle: string;
  studentName: string;
}) {
  return pushNotification({
    kind: "discussion_submitted",
    audience: "instructor",
    title: `Discussion to grade: ${input.topicTitle}`,
    body: `${input.studentName} participated in ${input.topicTitle} (${input.courseTitle}).`,
    courseId: input.courseId,
    href: `/courses/${input.courseId}/discussions/${input.topicId}/grade`,
  });
}
