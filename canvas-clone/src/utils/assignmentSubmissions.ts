import { loadUser } from "./userStore";
import { deleteCommentAttachment } from "./submissionFileStorage";
import { getAssignmentById, uid } from "./assignments";
import type { RubricAssessment } from "./assignmentRubric";

export type SubmissionComment = {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  role: "student" | "instructor";
  attachmentName?: string;
  mediaComment?: boolean;
};

export type FeedbackEntry = {
  id: string;
  body: string;
  author: string;
  createdAt: number;
};

export type AssignmentSubmission = {
  id: string;
  courseId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  body?: string;
  fileName?: string;
  fileSize?: number;
  submittedAt: number;
  status: "submitted" | "graded" | "missing";
  score?: number;
  feedback?: string;
  feedbackEntries?: FeedbackEntry[];
  gradedAt?: number;
  gradedBy?: string;
  comments?: SubmissionComment[];
  rubricAssessments?: RubricAssessment[];
  late?: boolean;
  rawScore?: number;
  latePenalty?: number;
  latePenaltyPresetId?: string;
};

function feedbackStringFromEntries(entries: FeedbackEntry[]): string | undefined {
  if (entries.length === 0) return undefined;
  return entries.map((e) => e.body).join("\n\n");
}

export function getSubmissionFeedbackText(submission: AssignmentSubmission): string | undefined {
  if (submission.feedback?.trim()) return submission.feedback.trim();
  const entries = submission.feedbackEntries;
  if (entries?.length) return feedbackStringFromEntries(entries);
  return undefined;
}

export function getFeedbackEntries(submission: AssignmentSubmission): FeedbackEntry[] {
  if (submission.feedbackEntries?.length) return submission.feedbackEntries;
  const text = submission.feedback?.trim();
  if (!text) return [];
  const parts = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const baseTime = submission.gradedAt ?? submission.submittedAt;
    return parts.map((body, index) => ({
      id: `legacy-${submission.id}-${index}`,
      body,
      author: submission.gradedBy ?? "Instructor",
      createdAt: baseTime + index,
    }));
  }
  return [
    {
      id: `legacy-${submission.id}`,
      body: text,
      author: submission.gradedBy ?? "Instructor",
      createdAt: submission.gradedAt ?? submission.submittedAt,
    },
  ];
}

function key(courseId: string) {
  return `canvasClone:assignmentSubmissions:${courseId}`;
}

function readAll(courseId: string): AssignmentSubmission[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) {
      const seeded = seedDemoSubmissions(courseId, []);
      if (seeded.length > 0) saveAll(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    if (items.length === 0) {
      const seeded = seedDemoSubmissions(courseId, items);
      if (seeded.length > 0) saveAll(courseId, seeded);
      return seeded;
    }
    return items;
  } catch {
    return [];
  }
}

function seedDemoSubmissions(
  courseId: string,
  existing: AssignmentSubmission[],
): AssignmentSubmission[] {
  if (existing.length > 0) return existing;
  const assignmentId = `seed_major1_${courseId}`;
  const assignment = getAssignmentById(courseId, assignmentId);
  if (!assignment) return existing;

  const submittedAt = new Date("2023-09-24T12:03:00").getTime();
  const gradedAt = new Date("2023-11-04T17:31:00").getTime();

  return [
    {
      id: uid("sub"),
      courseId,
      assignmentId,
      studentId: "1",
      studentName: "Nehang Patel",
      fileName: "Rough Draft of Instructions-1.docx",
      fileSize: Math.round(1.63 * 1024 * 1024),
      submittedAt,
      status: "graded",
      score: 145,
      feedback:
        "Really nice work on this, Nehang! You've done a great job adding hierarchy to the instructions and your troubleshooting section is especially helpful. For the final version, tighten the introduction so the audience and goal are stated in the first paragraph, and add one more visual for the setup step.",
      gradedAt,
      gradedBy: "Alexander Evans",
    },
  ];
}

function saveAll(courseId: string, items: AssignmentSubmission[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event("canvasClone:assignmentSubmissionsChanged"));
  } catch {}
}

export function loadSubmissionsForAssignment(
  courseId: string,
  assignmentId: string,
): AssignmentSubmission[] {
  return readAll(courseId)
    .filter((s) => s.assignmentId === assignmentId)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

export function getStudentSubmission(
  courseId: string,
  assignmentId: string,
  studentId?: string,
): AssignmentSubmission | undefined {
  const sid = studentId ?? loadUser().id;
  return readAll(courseId).find(
    (s) => s.assignmentId === assignmentId && s.studentId === sid,
  );
}

export function submitAssignment(
  courseId: string,
  assignmentId: string,
  data: { body?: string; fileName?: string; fileSize?: number; replaceContent?: boolean },
): AssignmentSubmission {
  const user = loadUser();
  const all = readAll(courseId);
  const existing = all.find(
    (s) => s.assignmentId === assignmentId && s.studentId === user.id,
  );
  const now = Date.now();

  if (existing) {
    const updated: AssignmentSubmission = {
      ...existing,
      submittedAt: now,
      status: "submitted",
      ...(data.replaceContent
        ? { body: data.body, fileName: data.fileName, fileSize: data.fileSize }
        : {
            body: data.body ?? existing.body,
            fileName: data.fileName ?? existing.fileName,
            fileSize: data.fileSize ?? existing.fileSize,
          }),
    };
    saveAll(
      courseId,
      all.map((s) => (s.id === existing.id ? updated : s)),
    );
    return updated;
  }

  const submission: AssignmentSubmission = {
    id: uid("sub"),
    courseId,
    assignmentId,
    studentId: user.id,
    studentName: user.name,
    body: data.body,
    fileName: data.fileName,
    fileSize: data.fileSize,
    submittedAt: now,
    status: "submitted",
  };
  saveAll(courseId, [...all, submission]);
  return submission;
}

export function addSubmissionComment(
  courseId: string,
  submissionId: string,
  body: string,
  role: SubmissionComment["role"] = "student",
  meta?: { attachmentName?: string; mediaComment?: boolean },
): SubmissionComment {
  const user = loadUser();
  const all = readAll(courseId);
  const comment: SubmissionComment = {
    id: uid("cmt"),
    author: user.name,
    body: body.trim(),
    createdAt: Date.now(),
    role,
    ...(meta?.attachmentName ? { attachmentName: meta.attachmentName } : {}),
    ...(meta?.mediaComment ? { mediaComment: true } : {}),
  };
  saveAll(
    courseId,
    all.map((s) =>
      s.id === submissionId
        ? { ...s, comments: [...(s.comments ?? []), comment] }
        : s,
    ),
  );
  return comment;
}

export function deleteSubmissionComment(
  courseId: string,
  submissionId: string,
  commentId: string,
) {
  const all = readAll(courseId);
  deleteCommentAttachment(commentId);
  saveAll(
    courseId,
    all.map((s) =>
      s.id === submissionId
        ? { ...s, comments: (s.comments ?? []).filter((c) => c.id !== commentId) }
        : s,
    ),
  );
}

export function clearSubmissionFeedback(courseId: string, submissionId: string) {
  const all = readAll(courseId);
  saveAll(
    courseId,
    all.map((s) => {
      if (s.id !== submissionId) return s;
      const { feedback: _feedback, feedbackEntries: _entries, ...rest } = s;
      return rest;
    }),
  );
}

export function appendSubmissionFeedback(
  courseId: string,
  submissionId: string,
  newFeedback: string,
) {
  const trimmed = newFeedback.trim();
  if (!trimmed) return;
  const user = loadUser();
  const all = readAll(courseId);
  saveAll(
    courseId,
    all.map((s) => {
      if (s.id !== submissionId) return s;
      const entries = [
        ...getFeedbackEntries(s),
        {
          id: uid("fbk"),
          body: trimmed,
          author: user.name,
          createdAt: Date.now(),
        },
      ];
      return {
        ...s,
        feedbackEntries: entries,
        feedback: feedbackStringFromEntries(entries),
        gradedBy: user.name,
        gradedAt: Date.now(),
      };
    }),
  );
}

export function deleteFeedbackEntry(
  courseId: string,
  submissionId: string,
  entryId: string,
) {
  const all = readAll(courseId);
  saveAll(
    courseId,
    all.map((s) => {
      if (s.id !== submissionId) return s;
      const entries = getFeedbackEntries(s).filter((e) => e.id !== entryId);
      if (entries.length === 0) {
        const { feedback: _feedback, feedbackEntries: _entries, ...rest } = s;
        return rest;
      }
      return {
        ...s,
        feedbackEntries: entries,
        feedback: feedbackStringFromEntries(entries),
      };
    }),
  );
}

export function gradeSubmission(
  courseId: string,
  submissionId: string,
  data: {
    score?: number;
    feedback?: string;
    rubricAssessments?: RubricAssessment[];
    late?: boolean;
    rawScore?: number;
    latePenalty?: number;
    latePenaltyPresetId?: string;
    markGraded?: boolean;
  },
) {
  const user = loadUser();
  const all = readAll(courseId);
  const now = Date.now();
  saveAll(
    courseId,
    all.map((s) => {
      if (s.id !== submissionId) return s;
      const next = {
        ...s,
        score: data.score,
        feedback: data.feedback !== undefined ? data.feedback : s.feedback,
        rubricAssessments: data.rubricAssessments ?? s.rubricAssessments,
        late: data.late ?? s.late,
        status: data.markGraded ? ("graded" as const) : s.status,
        gradedAt: data.markGraded ? now : s.gradedAt,
        gradedBy: data.markGraded ? user.name : s.gradedBy,
      };
      if (data.late) {
        return {
          ...next,
          rawScore: data.rawScore,
          latePenalty: data.latePenalty,
          latePenaltyPresetId: data.latePenaltyPresetId,
        };
      }
      const {
        rawScore: _rawScore,
        latePenalty: _latePenalty,
        latePenaltyPresetId: _latePenaltyPresetId,
        ...withoutLatePenalty
      } = next;
      return withoutLatePenalty;
    }),
  );
}

export function getPendingSubmissionsForCourse(courseId: string): AssignmentSubmission[] {
  return readAll(courseId).filter((s) => s.status === "submitted");
}

export function getAllPendingSubmissions(): AssignmentSubmission[] {
  const out: AssignmentSubmission[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith("canvasClone:assignmentSubmissions:")) continue;
      const courseId = k.replace("canvasClone:assignmentSubmissions:", "");
      out.push(...getPendingSubmissionsForCourse(courseId));
    }
  } catch {}
  return out.sort((a, b) => b.submittedAt - a.submittedAt);
}
