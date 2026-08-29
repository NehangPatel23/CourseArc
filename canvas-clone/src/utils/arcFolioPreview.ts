import { getStudentSubmission } from "./assignmentSubmissions";
import { getParticipationForStudent } from "./discussionParticipations";
import { loadReplies, type DiscussionReply } from "./discussions";
import {
  getPortfolioEntryFile,
  type PortfolioEntry,
} from "./ePortfolioStore";
import { detectPreviewKind, type FilePreviewKind } from "./filePreviewKind";
import { htmlPreview } from "./htmlPreview";
import { getRosterMemberName } from "./courseRoster";
import {
  getAttemptEffectiveScore,
  getStudentAttemptsForQuiz,
  getStudentFinalScore,
  type QuizAttempt,
} from "./quizSubmissions";
import { getQuizById } from "./quizzes";
import type { StoredSubmissionFile } from "./submissionFileStorage";
import { getSubmissionFile } from "./submissionFileStorage";
import { loadUser } from "./userStore";

export type ArcFolioFilePreview = {
  stored: StoredSubmissionFile | null;
  fileName: string;
  kind: FilePreviewKind;
};

export type ArcFolioPreview =
  | {
      kind: "assignment-text";
      courseId: string;
      body: string;
      excerpt: string;
    }
  | {
      kind: "assignment-file";
      file: ArcFolioFilePreview;
      excerpt: string;
    }
  | {
      kind: "assignment-empty";
      message: string;
    }
  | {
      kind: "quiz";
      quizTitle: string;
      scoreLabel: string | null;
      attempts: Array<{
        attemptNumber: number;
        scoreLabel: string;
        submittedAt: number;
      }>;
    }
  | {
      kind: "discussion";
      courseId: string;
      replies: DiscussionReply[];
      excerpt: string;
      replyCount: number;
    }
  | {
      kind: "external-url";
      externalType: "github" | "website" | "link";
      url: string;
      host: string;
      pathLabel: string;
      description?: string;
    }
  | {
      kind: "external-file";
      file: ArcFolioFilePreview;
      description?: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

function hostFromUrl(url: string): { host: string; pathLabel: string } {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`.replace(/\/$/, "") || "/";
    return { host: u.host, pathLabel: path === "/" ? u.host : `${u.host}${path}` };
  } catch {
    return { host: url, pathLabel: url };
  }
}

function asViewerFile(
  stored: { dataUrl: string; fileName: string; mimeType: string; size: number } | null,
  fileName: string,
): ArcFolioFilePreview {
  return {
    stored,
    fileName,
    kind: detectPreviewKind(fileName, stored?.mimeType),
  };
}

function studentDisplayName(courseId: string, studentId: string): string {
  if (courseId && courseId !== "_personal") {
    const rosterName = getRosterMemberName(courseId, studentId);
    if (rosterName && rosterName !== studentId) return rosterName;
  }
  const user = loadUser();
  if (user.id === studentId) return user.name;
  return studentId;
}

function formatQuizScore(attempt: QuizAttempt): string {
  const earned = getAttemptEffectiveScore(attempt);
  return `${earned}/${attempt.maxScore}`;
}

export function resolveArcFolioPreview(
  entry: PortfolioEntry,
  studentId = loadUser().id,
): ArcFolioPreview {
  if (entry.kind === "external") {
    if (entry.externalType === "file") {
      const stored = getPortfolioEntryFile(entry);
      const fileName = stored?.fileName || entry.fileName || "File";
      return {
        kind: "external-file",
        file: asViewerFile(stored, fileName),
        description: entry.description,
      };
    }
    const url = entry.url?.trim();
    if (!url) {
      return { kind: "unavailable", message: "No URL saved for this project." };
    }
    const { host, pathLabel } = hostFromUrl(url);
    return {
      kind: "external-url",
      externalType: entry.externalType ?? "link",
      url,
      host,
      pathLabel,
      description: entry.description,
    };
  }

  if (entry.kind === "assignment") {
    const submission = getStudentSubmission(entry.courseId, entry.itemId, studentId);
    if (!submission) {
      return {
        kind: "assignment-empty",
        message: "Submission not found for this assignment.",
      };
    }
    if (submission.fileName) {
      const stored = getSubmissionFile(submission.id);
      return {
        kind: "assignment-file",
        file: asViewerFile(stored, submission.fileName),
        excerpt: submission.fileName,
      };
    }
    if (submission.body?.trim()) {
      const preview = htmlPreview(submission.body, 160);
      return {
        kind: "assignment-text",
        courseId: entry.courseId,
        body: submission.body,
        excerpt: preview.text || "Text submission",
      };
    }
    return {
      kind: "assignment-empty",
      message: "This submission has no previewable content.",
    };
  }

  if (entry.kind === "quiz") {
    const quiz = getQuizById(entry.courseId, entry.itemId);
    const attempts = getStudentAttemptsForQuiz(entry.courseId, entry.itemId, studentId);
    const final = quiz
      ? getStudentFinalScore(entry.courseId, quiz, studentId)
      : undefined;
    const scoreLabel =
      final && typeof final.score === "number"
        ? `${Math.round(final.score * 100) / 100}/${final.maxScore}`
        : attempts.length > 0
          ? formatQuizScore(attempts[attempts.length - 1])
          : null;
    return {
      kind: "quiz",
      quizTitle: quiz?.title ?? entry.title,
      scoreLabel,
      attempts: attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        scoreLabel: formatQuizScore(a),
        submittedAt: a.submittedAt,
      })),
    };
  }

  // discussion
  const part = getParticipationForStudent(entry.courseId, entry.itemId, studentId);
  const authorName = part?.studentName || studentDisplayName(entry.courseId, studentId);
  const replies = loadReplies(entry.courseId, entry.itemId)
    .filter((r) => r.author === authorName)
    .sort((a, b) => a.createdAt - b.createdAt);
  const firstBody = replies[0]?.body ?? "";
  const excerpt = htmlPreview(firstBody, 140).text;
  return {
    kind: "discussion",
    courseId: entry.courseId,
    replies,
    excerpt: excerpt || (part ? `${part.replyCount} replies` : "No replies found"),
    replyCount: part?.replyCount ?? replies.length,
  };
}
