import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Mic, Paperclip, Square } from "lucide-react";
import AssignmentAvailabilityFields from "../components/AssignmentAvailabilityFields";
import SubmissionContentPreview from "../components/SubmissionContentPreview";
import SubmissionDocumentViewerOverlay from "../components/SubmissionDocumentViewerOverlay";
import LateSubmissionBadge from "../components/LateSubmissionBadge";
import RichContentViewer from "../components/RichContentViewer";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import {
  formatFileSize,
  formatSubmissionTimestamp,
  fileExtension,
} from "../utils/assignmentDisplay";
import {
  canStudentSubmit,
  formatAssignmentDueDate,
  getAssignmentById,
  hasAvailabilityWindow,
  isStudentViewableAssignment,
} from "../utils/assignments";
import {
  addSubmissionComment,
  getFeedbackEntries,
  getStudentSubmission,
  type SubmissionComment,
} from "../utils/assignmentSubmissions";
import { loadDocumentAnnotations } from "../utils/submissionAnnotations";
import {
  downloadStoredFile,
  getCommentAttachment,
  getSubmissionFile,
  saveCommentAttachmentFromUpload,
} from "../utils/submissionFileStorage";
import { isLateSubmission } from "../utils/latePenalty";
import { loadUser } from "../utils/userStore";

const QUICK_EMOJIS = ["👍", "👏", "😊"];

function FileTypeIcon({ name }: { name: string }) {
  const ext = fileExtension(name);
  const label = ext === "docx" || ext === "doc" ? "W" : ext.slice(0, 3).toUpperCase() || "F";
  const color =
    ext === "docx" || ext === "doc"
      ? "bg-blue-600"
      : ext === "pdf"
        ? "bg-red-600"
        : "bg-gray-500";

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded text-sm font-bold text-white ${color}`}
    >
      {label}
    </div>
  );
}

function CommentAttachment({ commentId, name }: { commentId: string; name: string }) {
  const stored = getCommentAttachment(commentId);
  if (!stored) {
    return <p className="mt-2 text-xs text-gray-500">Attachment: {name}</p>;
  }
  return (
    <button
      type="button"
      onClick={() => downloadStoredFile(stored)}
      className="mt-2 inline-flex items-center gap-1 text-xs text-canvas-blue hover:underline"
    >
      <Paperclip className="h-3.5 w-3.5" />
      {name}
    </button>
  );
}

function CommentBlock({
  comment,
  courseId,
  highlightFeedback = false,
}: {
  comment: SubmissionComment & { id: string };
  courseId: string;
  highlightFeedback?: boolean;
}) {
  const attachment = comment.attachmentName ? getCommentAttachment(comment.id) : null;

  const content = (
    <>
      {comment.mediaComment && attachment ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{comment.body}</p>
          <audio controls src={attachment.dataUrl} className="w-full max-w-full" />
        </div>
      ) : comment.role === "instructor" && comment.body.includes("<") ? (
        <RichContentViewer html={comment.body} courseId={courseId} className="text-sm text-gray-700" />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
      )}
      {comment.attachmentName && !comment.mediaComment && (
        <CommentAttachment commentId={comment.id} name={comment.attachmentName} />
      )}
      <p className="mt-2 text-xs text-gray-500">
        {comment.author}, {formatSubmissionTimestamp(comment.createdAt)}
      </p>
    </>
  );

  if (highlightFeedback) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3">
        <p className="mb-2 text-xs font-semibold text-green-800">Assignment feedback</p>
        {content}
      </div>
    );
  }

  return <div>{content}</div>;
}

export default function AssignmentSubmissionDetailsPage() {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const user = loadUser();
  const { showToast } = useToast();

  const assignment = assignmentId ? getAssignmentById(effectiveCourseId, assignmentId) : undefined;
  const [submission, setSubmission] = useState(() =>
    assignmentId ? getStudentSubmission(effectiveCourseId, assignmentId) : undefined,
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const commentFileRef = useRef<HTMLInputElement>(null);
  const textPreviewRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const storedFile = useMemo(
    () => (submission ? getSubmissionFile(submission.id) : null),
    [submission],
  );

  useEffect(() => {
    if (!studentView) {
      navigate(`/courses/${effectiveCourseId}/assignments/${assignmentId}/grade`, { replace: true });
    }
  }, [studentView, navigate, effectiveCourseId, assignmentId]);

  useEffect(() => {
    if (!assignmentId) return;
    const refresh = () => setSubmission(getStudentSubmission(effectiveCourseId, assignmentId));
    refresh();
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", refresh);
    return () => window.removeEventListener("canvasClone:assignmentSubmissionsChanged", refresh);
  }, [effectiveCourseId, assignmentId]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!assignment || !assignmentId) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Assignment not found.</p>
      </div>
    );
  }

  if (studentView && !isStudentViewableAssignment(assignment)) {
    navigate(`/courses/${effectiveCourseId}/assignments`, { replace: true });
    return null;
  }

  if (!submission) {
    return (
      <div className="p-8">
        <p className="text-gray-500">No submission found.</p>
        <Link
          to={`/courses/${effectiveCourseId}/assignments/${assignmentId}`}
          className="text-canvas-blue hover:underline"
        >
          Back to assignment
        </Link>
      </div>
    );
  }

  const canResubmit =
    studentView && canStudentSubmit(assignment) && assignment.allowResubmissions;
  const pronounLabel = user.pronouns ? ` (${user.pronouns})` : "";
  const maxPoints = assignment.points ?? 100;
  const hasFile = Boolean(submission.fileName);
  const hasText = Boolean(submission.body?.trim());
  const docAnnotations = loadDocumentAnnotations(submission.id);
  const feedbackEntries = getFeedbackEntries(submission);
  const feedbackEntryIds = new Set(feedbackEntries.map((e) => e.id));
  const hasDocumentFeedback =
    feedbackEntries.length > 0 ||
    docAnnotations.length > 0 ||
    submission.status === "graded";

  const openDocumentViewer = () => {
    if (!storedFile && hasFile) {
      showToast("Preview unavailable — re-submit the file to enable the document viewer", "negative");
      return;
    }
    setViewerOpen(true);
  };

  const instructorComments: (SubmissionComment & { id: string })[] = [
    ...feedbackEntries.map((entry) => ({
      id: entry.id,
      author: entry.author,
      body: entry.body,
      createdAt: entry.createdAt,
      role: "instructor" as const,
    })),
    ...(submission.comments ?? []),
  ];

  const handleDownloadFile = () => {
    if (storedFile) {
      downloadStoredFile(storedFile);
      return;
    }
    showToast("Download unavailable — re-submit the file to enable download", "negative");
  };

  const appendEmoji = (emoji: string) => {
    setCommentDraft((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${emoji}`);
  };

  const handleSaveComment = async () => {
    const hasText = Boolean(commentDraft.trim());
    if (!hasText && !pendingAttachment) return;

    const comment = addSubmissionComment(
      effectiveCourseId,
      submission.id,
      hasText ? commentDraft.trim() : `Attached ${pendingAttachment!.name}`,
      "student",
      pendingAttachment ? { attachmentName: pendingAttachment.name } : undefined,
    );

    if (pendingAttachment) {
      const { saved, tooLarge } = await saveCommentAttachmentFromUpload(comment.id, pendingAttachment);
      if (tooLarge) {
        showToast("Comment saved but attachment is too large to store", "negative");
      } else if (!saved) {
        showToast("Comment saved but attachment could not be stored", "negative");
      }
    }

    setCommentDraft("");
    setPendingAttachment(null);
    setSubmission(getStudentSubmission(effectiveCourseId, assignmentId));
    showToast("Comment saved", "positive");
  };

  const startMediaComment = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Media recording is not supported in this browser", "negative");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `media-comment-${Date.now()}.webm`, {
          type: blob.type,
        });
        const comment = addSubmissionComment(
          effectiveCourseId,
          submission.id,
          `Voice comment (${recordingSeconds}s)`,
          "student",
          { attachmentName: file.name, mediaComment: true },
        );
        const { saved } = await saveCommentAttachmentFromUpload(comment.id, file);
        if (!saved) {
          showToast("Recording saved as comment but audio could not be stored", "negative");
        } else {
          showToast("Media comment saved", "positive");
        }
        setSubmission(getStudentSubmission(effectiveCourseId, assignmentId));
        setRecordingSeconds(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      showToast("Microphone access was denied", "negative");
    }
  };

  const stopMediaComment = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-white">
      <div className="border-b border-canvas-border px-8 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-canvas-grayDark">Submission Details</h1>
            {isLateSubmission(submission, assignment.dueAt) && <LateSubmissionBadge />}
          </div>
          {submission.status === "graded" && submission.score != null && (
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-canvas-grayDark">Grade:</span>{" "}
              {submission.score} / {maxPoints}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-canvas-grayDark">{assignment.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <p>
                  {user.name}
                  {pronounLabel} submitted {formatSubmissionTimestamp(submission.submittedAt)}
                </p>
                {isLateSubmission(submission, assignment.dueAt) && <LateSubmissionBadge />}
              </div>
            </div>
            {canResubmit && (
              <Link
                to={`/courses/${effectiveCourseId}/assignments/${assignmentId}`}
                state={{ openSubmit: true }}
                className="btn-canvas-primary shrink-0"
              >
                Re-submit Assignment
              </Link>
            )}
          </div>

          {hasFile && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-canvas-grayDark">Files</h3>
              <div className="flex w-full items-center justify-between gap-4 rounded-md border border-canvas-border bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={openDocumentViewer}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90"
                >
                  <FileTypeIcon name={submission.fileName!} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-canvas-grayDark">
                      {submission.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(storedFile?.size ?? submission.fileSize)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  {hasDocumentFeedback && (
                    <button
                      type="button"
                      onClick={openDocumentViewer}
                      className="text-sm font-medium text-canvas-blue hover:underline"
                    >
                      View Feedback
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadFile}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasText && (
            <div className="mt-8" ref={textPreviewRef}>
              <h3 className="mb-3 text-sm font-semibold text-canvas-grayDark">Text entry</h3>
              <div className="overflow-hidden rounded-md border border-canvas-border">
                <SubmissionContentPreview
                  target={{
                    kind: "text",
                    body: submission.body!,
                    courseId: effectiveCourseId,
                  }}
                />
              </div>
            </div>
          )}

          {!hasFile && !hasText && (
            <p className="mt-8 text-sm text-gray-500">This submission has no content to display.</p>
          )}

          {assignment.dueAt && (
            <p className="mt-6 text-xs text-gray-500">
              Due {formatAssignmentDueDate(assignment.dueAt)}
            </p>
          )}
          {hasAvailabilityWindow(assignment) && (
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              <AssignmentAvailabilityFields assignment={assignment} />
            </div>
          )}
        </div>

        <aside
          id="submission-comments"
          className="w-[340px] shrink-0 overflow-y-auto border-l border-canvas-border bg-canvas-grayLight px-5 py-6"
        >
          <div className="space-y-5">
            {instructorComments.length === 0 ? (
              <p className="text-sm text-gray-500">No comments yet.</p>
            ) : (
              instructorComments.map((comment) => (
                <CommentBlock
                  key={comment.id}
                  comment={comment}
                  courseId={effectiveCourseId}
                  highlightFeedback={feedbackEntryIds.has(comment.id)}
                />
              ))
            )}

            <div className="border-t border-canvas-border pt-5">
              <label
                htmlFor="submission-comment"
                className="mb-2 block text-sm font-semibold text-canvas-grayDark"
              >
                Add a Comment:
              </label>
              <textarea
                id="submission-comment"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-canvas-grayDark focus:border-canvas-blue focus:outline-none focus:ring-1 focus:ring-canvas-blue"
                placeholder="Write a comment..."
              />
              {pendingAttachment && (
                <div className="mt-2 flex items-center justify-between rounded-md border border-canvas-border bg-white px-3 py-2 text-xs">
                  <span className="inline-flex items-center gap-1 truncate text-gray-700">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    {pendingAttachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="text-canvas-blue hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="mt-2 flex gap-2 text-lg">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendEmoji(emoji)}
                    className="rounded p-1 hover:bg-gray-200"
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopMediaComment}
                    className="inline-flex items-center gap-1 font-medium text-canvas-red hover:underline"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Stop recording ({recordingSeconds}s)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startMediaComment}
                    className="inline-flex items-center gap-1 text-canvas-blue hover:underline"
                  >
                    <Mic className="h-4 w-4" />
                    Media Comment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => commentFileRef.current?.click()}
                  className="inline-flex items-center gap-1 text-canvas-blue hover:underline"
                >
                  <Paperclip className="h-4 w-4" />
                  Attach File
                </button>
                <input
                  ref={commentFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPendingAttachment(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={!commentDraft.trim() && !pendingAttachment}
                className="mt-4 rounded-md bg-canvas-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </aside>
      </div>

      {hasFile && (
        <SubmissionDocumentViewerOverlay
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          submissionId={submission.id}
          fileName={submission.fileName!}
          stored={storedFile}
          feedback={feedbackEntries.map((e) => e.body).join("\n\n") || undefined}
          gradedBy={submission.gradedBy}
          gradedAt={submission.gradedAt}
          onDownload={handleDownloadFile}
        />
      )}
    </div>
  );
}
