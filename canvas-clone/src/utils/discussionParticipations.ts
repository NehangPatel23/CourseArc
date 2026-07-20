import { loadUser } from "./userStore";
import type { FeedbackEntry, SubmissionComment } from "./assignmentSubmissions";
import { getTopicById, isGradedDiscussion, uid } from "./discussions";

export type DiscussionParticipation = {
  id: string;
  topicId: string;
  studentId: string;
  studentName: string;
  replyCount: number;
  firstPostedAt?: number;
  status: "submitted" | "graded" | "missing";
  score?: number;
  gradedAt?: number;
  gradedBy?: string;
  comments?: SubmissionComment[];
  feedbackEntries?: FeedbackEntry[];
};

export const DISCUSSION_PARTICIPATIONS_CHANGED_EVENT =
  "canvasClone:discussionParticipationsChanged";

function key(courseId: string) {
  return `canvasClone:discussionParticipations:${courseId}`;
}

function readAll(courseId: string): DiscussionParticipation[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(courseId: string, items: DiscussionParticipation[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT));
  } catch {}
}

export function loadParticipationsForTopic(
  courseId: string,
  topicId: string,
): DiscussionParticipation[] {
  return readAll(courseId).filter((p) => p.topicId === topicId);
}

export function getParticipationById(
  courseId: string,
  participationId: string,
): DiscussionParticipation | undefined {
  return readAll(courseId).find((p) => p.id === participationId);
}

export function getParticipationForStudent(
  courseId: string,
  topicId: string,
  studentId = loadUser().id,
): DiscussionParticipation | undefined {
  return loadParticipationsForTopic(courseId, topicId).find(
    (p) => p.studentId === studentId,
  );
}

export function getPendingParticipationsForTopic(
  courseId: string,
  topicId: string,
): DiscussionParticipation[] {
  const topic = getTopicById(courseId, topicId);
  if (!topic || !isGradedDiscussion(topic)) return [];
  return loadParticipationsForTopic(courseId, topicId).filter(
    (p) => p.status === "submitted",
  );
}

export function getPendingParticipationsForCourse(courseId: string): DiscussionParticipation[] {
  return readAll(courseId).filter((p) => {
    const topic = getTopicById(courseId, p.topicId);
    return topic && isGradedDiscussion(topic) && p.status === "submitted";
  });
}

/** Record or update participation when a student posts on a graded discussion. */
export function recordDiscussionParticipation(
  courseId: string,
  topicId: string,
  studentId = loadUser().id,
  studentName = loadUser().name,
): DiscussionParticipation | undefined {
  const topic = getTopicById(courseId, topicId);
  if (!topic || !isGradedDiscussion(topic)) return undefined;

  const now = Date.now();
  const all = readAll(courseId);
  const existing = all.find((p) => p.topicId === topicId && p.studentId === studentId);

  if (existing) {
    const updated: DiscussionParticipation = {
      ...existing,
      replyCount: existing.replyCount + 1,
      firstPostedAt: existing.firstPostedAt ?? now,
      status: existing.status === "graded" ? "graded" : "submitted",
    };
    saveAll(
      courseId,
      all.map((p) => (p.id === existing.id ? updated : p)),
    );
    return updated;
  }

  const created: DiscussionParticipation = {
    id: uid("dpart"),
    topicId,
    studentId,
    studentName,
    replyCount: 1,
    firstPostedAt: now,
    status: "submitted",
  };
  saveAll(courseId, [...all, created]);
  return created;
}

export function gradeParticipation(
  courseId: string,
  participationId: string,
  score: number,
  maxPoints: number,
): void {
  const user = loadUser();
  const clamped = Math.max(0, Math.min(maxPoints, score));
  saveAll(
    courseId,
    readAll(courseId).map((p) =>
      p.id === participationId
        ? {
            ...p,
            score: clamped,
            status: "graded" as const,
            gradedAt: Date.now(),
            gradedBy: user.name,
          }
        : p,
    ),
  );
}

export function addParticipationComment(
  courseId: string,
  participationId: string,
  body: string,
  role: SubmissionComment["role"] = "instructor",
): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const user = loadUser();
  const comment: SubmissionComment = {
    id: uid("dpc"),
    author: user.name,
    body: trimmed,
    createdAt: Date.now(),
    role,
  };
  saveAll(
    courseId,
    readAll(courseId).map((p) =>
      p.id === participationId
        ? { ...p, comments: [...(p.comments ?? []), comment] }
        : p,
    ),
  );
}

export function appendParticipationFeedback(
  courseId: string,
  participationId: string,
  body: string,
): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const user = loadUser();
  const entry: FeedbackEntry = {
    id: uid("dpfb"),
    body: trimmed,
    author: user.name,
    createdAt: Date.now(),
  };
  saveAll(
    courseId,
    readAll(courseId).map((p) =>
      p.id === participationId
        ? { ...p, feedbackEntries: [...(p.feedbackEntries ?? []), entry] }
        : p,
    ),
  );
}
