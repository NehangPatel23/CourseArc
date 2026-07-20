import { getTopicById, isGradedDiscussion } from "./discussions";
import {
  getPendingParticipationsForCourse,
  getPendingParticipationsForTopic,
  loadParticipationsForTopic,
} from "./discussionParticipations";
import {
  getAttemptsForQuiz,
  type QuizAttempt,
} from "./quizSubmissions";
import {
  loadSubmissionsForAssignment,
  getPendingSubmissionsForCourse,
} from "./assignmentSubmissions";
import { loadAssignments } from "./assignments";
import { loadQuizzes } from "./quizzes";

export function getPendingAssignmentCount(
  courseId: string,
  assignmentId: string,
): number {
  return loadSubmissionsForAssignment(courseId, assignmentId).filter(
    (s) => s.status === "submitted",
  ).length;
}

export function isQuizAttemptPending(attempt: QuizAttempt): boolean {
  return !attempt.autoGraded && attempt.gradedAt == null;
}

export function getPendingQuizCount(courseId: string, quizId: string): number {
  return getAttemptsForQuiz(courseId, quizId).filter(isQuizAttemptPending).length;
}

export function getPendingDiscussionCount(
  courseId: string,
  topicId: string,
): number {
  const topic = getTopicById(courseId, topicId);
  if (!topic || !isGradedDiscussion(topic)) return 0;
  return getPendingParticipationsForTopic(courseId, topicId).length;
}

export function getTotalPendingGradeCount(courseId: string): number {
  const assignmentPending = getPendingSubmissionsForCourse(courseId).length;
  const quizPending = loadQuizzes(courseId)
    .flatMap((q) => getAttemptsForQuiz(courseId, q.id))
    .filter(isQuizAttemptPending).length;
  const discussionPending = getPendingParticipationsForCourse(courseId).length;
  return assignmentPending + quizPending + discussionPending;
}

export function getDiscussionParticipationStats(
  courseId: string,
  topicId: string,
): { total: number; submitted: number; graded: number } {
  const parts = loadParticipationsForTopic(courseId, topicId);
  return {
    total: parts.length,
    submitted: parts.filter((p) => p.status === "submitted").length,
    graded: parts.filter((p) => p.status === "graded").length,
  };
}

export function getAssignmentsNeedingGrading(courseId: string): Array<{
  assignmentId: string;
  title: string;
  pendingCount: number;
}> {
  const pending = getPendingSubmissionsForCourse(courseId);
  const byAssignment = new Map<string, number>();
  for (const s of pending) {
    byAssignment.set(s.assignmentId, (byAssignment.get(s.assignmentId) ?? 0) + 1);
  }
  const assignments = loadAssignments(courseId);
  return [...byAssignment.entries()]
    .map(([assignmentId, pendingCount]) => ({
      assignmentId,
      title: assignments.find((a) => a.id === assignmentId)?.title ?? "Assignment",
      pendingCount,
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount);
}

export type NeedsGradingItem = {
  kind: "assignment" | "quiz" | "discussion";
  itemId: string;
  title: string;
  pendingCount: number;
  gradePath: string;
};

export function getItemsNeedingGrading(courseId: string): NeedsGradingItem[] {
  const items: NeedsGradingItem[] = [];

  for (const a of getAssignmentsNeedingGrading(courseId)) {
    items.push({
      kind: "assignment",
      itemId: a.assignmentId,
      title: a.title,
      pendingCount: a.pendingCount,
      gradePath: `/courses/${courseId}/assignments/${a.assignmentId}/grade`,
    });
  }

  for (const q of loadQuizzes(courseId)) {
    const pendingCount = getPendingQuizCount(courseId, q.id);
    if (pendingCount <= 0) continue;
    items.push({
      kind: "quiz",
      itemId: q.id,
      title: q.title,
      pendingCount,
      gradePath: `/courses/${courseId}/quizzes/${q.id}/grade`,
    });
  }

  const pendingParticipations = getPendingParticipationsForCourse(courseId);
  const byTopic = new Map<string, number>();
  for (const p of pendingParticipations) {
    byTopic.set(p.topicId, (byTopic.get(p.topicId) ?? 0) + 1);
  }
  for (const [topicId, pendingCount] of byTopic) {
    const topic = getTopicById(courseId, topicId);
    items.push({
      kind: "discussion",
      itemId: topicId,
      title: topic?.title ?? "Discussion",
      pendingCount,
      gradePath: `/courses/${courseId}/discussions/${topicId}/grade`,
    });
  }

  return items.sort((a, b) => b.pendingCount - a.pendingCount);
}
