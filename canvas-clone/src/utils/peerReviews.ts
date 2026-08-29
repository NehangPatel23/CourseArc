import { getAssignmentById, uid } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { loadRoster } from "./courseRoster";

export type PeerReview = {
  id: string;
  assignmentId: string;
  reviewerId: string;
  revieweeId: string;
  score?: number;
  comment?: string;
  submittedAt?: number;
};

export const PEER_REVIEWS_CHANGED_EVENT = "canvasClone:peerReviewsChanged";

function key(courseId: string) {
  return `canvasClone:peerReviews:${courseId}`;
}

export function loadPeerReviews(courseId: string): PeerReview[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PeerReview[]) : [];
  } catch {
    return [];
  }
}

function savePeerReviews(courseId: string, items: PeerReview[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event(PEER_REVIEWS_CHANGED_EVENT));
  } catch {}
}

/** Replace all peer reviews for a course (course package import). */
export function replacePeerReviews(courseId: string, items: PeerReview[]) {
  savePeerReviews(courseId, Array.isArray(items) ? items : []);
}

/**
 * For each student who submitted, assign N peers to review (round-robin,
 * skipping self). Creates pending PeerReview rows without score.
 */
export function ensurePeerAssignments(courseId: string, assignmentId: string): PeerReview[] {
  const assignment = getAssignmentById(courseId, assignmentId);
  if (!assignment?.peerReviewEnabled) return loadPeerReviews(courseId);
  const reviewsPerStudent = Math.max(1, Math.floor(assignment.peerReviewCount ?? 1));

  const submitterIds = [
    ...new Set(
      loadSubmissionsForAssignment(courseId, assignmentId)
        .filter((s) => s.status === "submitted" || s.status === "graded")
        .map((s) => s.studentId),
    ),
  ];
  if (submitterIds.length < 2) return loadPeerReviews(courseId);

  const rosterStudentIds = loadRoster(courseId)
    .filter((m) => m.role === "student")
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b));

  const ordered = [
    ...rosterStudentIds.filter((id) => submitterIds.includes(id)),
    ...submitterIds.filter((id) => !rosterStudentIds.includes(id)).sort((a, b) => a.localeCompare(b)),
  ];

  const all = loadPeerReviews(courseId);
  const existingPairs = new Set(
    all
      .filter((r) => r.assignmentId === assignmentId)
      .map((r) => `${r.reviewerId}:${r.revieweeId}`),
  );
  const countByReviewer = new Map<string, number>();
  for (const r of all.filter((row) => row.assignmentId === assignmentId)) {
    countByReviewer.set(r.reviewerId, (countByReviewer.get(r.reviewerId) ?? 0) + 1);
  }

  const created: PeerReview[] = [];
  const maxAssignable = ordered.length - 1;
  const target = Math.min(reviewsPerStudent, maxAssignable);

  for (let i = 0; i < ordered.length; i++) {
    const reviewerId = ordered[i]!;
    let have = countByReviewer.get(reviewerId) ?? 0;
    for (let step = 1; step < ordered.length && have < target; step++) {
      const revieweeId = ordered[(i + step) % ordered.length]!;
      if (revieweeId === reviewerId) continue;
      const pairKey = `${reviewerId}:${revieweeId}`;
      if (existingPairs.has(pairKey)) continue;
      const review: PeerReview = {
        id: uid("pr"),
        assignmentId,
        reviewerId,
        revieweeId,
      };
      created.push(review);
      existingPairs.add(pairKey);
      have += 1;
      countByReviewer.set(reviewerId, have);
    }
  }

  if (created.length === 0) return all;
  const next = [...all, ...created];
  savePeerReviews(courseId, next);
  return next;
}

/** Reviewers who still have at least one incomplete review on this assignment. */
export function listIncompletePeerReviewers(
  courseId: string,
  assignmentId: string,
): { reviewerId: string; pending: number; total: number }[] {
  const rows = loadPeerReviews(courseId).filter((r) => r.assignmentId === assignmentId);
  const byReviewer = new Map<string, { pending: number; total: number }>();
  for (const r of rows) {
    const cur = byReviewer.get(r.reviewerId) ?? { pending: 0, total: 0 };
    cur.total += 1;
    if (typeof r.submittedAt !== "number") cur.pending += 1;
    byReviewer.set(r.reviewerId, cur);
  }
  return [...byReviewer.entries()]
    .filter(([, v]) => v.pending > 0)
    .map(([reviewerId, v]) => ({ reviewerId, ...v }))
    .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId));
}

export function getPeerReviewsForReviewee(
  courseId: string,
  assignmentId: string,
  revieweeId: string,
): PeerReview[] {
  return loadPeerReviews(courseId).filter(
    (r) => r.assignmentId === assignmentId && r.revieweeId === revieweeId,
  );
}

export function getPeerReviewsAssignedTo(
  courseId: string,
  assignmentId: string,
  reviewerId: string,
): PeerReview[] {
  return loadPeerReviews(courseId).filter(
    (r) => r.assignmentId === assignmentId && r.reviewerId === reviewerId,
  );
}

export function submitPeerReview(
  courseId: string,
  reviewId: string,
  data: { score: number; comment?: string },
): PeerReview | undefined {
  const all = loadPeerReviews(courseId);
  let updated: PeerReview | undefined;
  const next = all.map((r) => {
    if (r.id !== reviewId) return r;
    updated = {
      ...r,
      score: data.score,
      comment: data.comment?.trim() || undefined,
      submittedAt: Date.now(),
    };
    return updated;
  });
  if (updated) savePeerReviews(courseId, next);
  return updated;
}
