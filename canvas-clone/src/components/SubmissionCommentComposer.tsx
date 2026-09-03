import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import Icon from "../icons/Icon";
import ConfirmActionModal from "./ConfirmActionModal";
import { useToast } from "./ui/Toast";
import {
  addSubmissionComment,
  type SubmissionComment,
} from "../utils/assignmentSubmissions";
import { saveCommentAttachmentFromUpload } from "../utils/submissionFileStorage";
import RichPromptField from "./RichPromptField";
import { richTextIsEmpty } from "../utils/richContent";

const QUICK_EMOJIS = ["👍", "👏", "😊"];

type Props = {
  courseId: string;
  submissionId: string;
  onPosted?: (comment: SubmissionComment) => void;
  /** Confirm before posting when attachment/media is present. */
  confirmAttachments?: boolean;
};

export default function SubmissionCommentComposer({
  courseId,
  submissionId,
  onPosted,
  confirmAttachments = true,
}: Props) {
  const { showToast } = useToast();
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const appendEmoji = (emoji: string) => {
    setCommentDraft((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${emoji}`);
  };

  const saveComment = async () => {
    const hasText = !richTextIsEmpty(commentDraft);
    if (!hasText && !pendingAttachment) return;

    const comment = addSubmissionComment(
      courseId,
      submissionId,
      hasText ? commentDraft.trim() : `Attached ${pendingAttachment!.name}`,
      "student",
      pendingAttachment ? { attachmentName: pendingAttachment.name } : undefined,
    );

    if (pendingAttachment) {
      const { saved, tooLarge } = await saveCommentAttachmentFromUpload(
        comment.id,
        pendingAttachment,
      );
      if (tooLarge) {
        showToast("Comment saved but attachment is too large to store", "negative");
      } else if (!saved) {
        showToast("Comment saved but attachment could not be stored", "negative");
      }
    }

    setCommentDraft("");
    setPendingAttachment(null);
    onPosted?.(comment);
    showToast("Comment saved", "positive", "grading");
  };

  const handleSaveComment = () => {
    if (confirmAttachments && pendingAttachment) {
      setConfirmOpen(true);
      return;
    }
    void saveComment();
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
        const blob = new Blob(mediaChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `media-comment-${Date.now()}.webm`, {
          type: blob.type,
        });
        const comment = addSubmissionComment(
          courseId,
          submissionId,
          `Voice comment (${recordingSeconds}s)`,
          "student",
          { attachmentName: file.name, mediaComment: true },
        );
        const { saved } = await saveCommentAttachmentFromUpload(comment.id, file);
        if (!saved) {
          showToast(
            "Recording saved as comment but audio could not be stored",
            "negative",
          );
        } else {
          showToast("Media comment saved", "positive", "grading");
        }
        onPosted?.(comment);
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
    <div className="border-t border-arc-ink/10 pt-5">
      <label
        htmlFor="gradepro-submission-comment"
        className="mb-2 block text-sm font-semibold text-canvas-grayDark"
      >
        Add a Comment:
      </label>
      <RichPromptField
        value={commentDraft}
        onChange={setCommentDraft}
        courseId={courseId}
        mountKey={`gradepro-comment-${submissionId}`}
        placeholder="Write a comment…"
        height={160}
        alwaysEdit
      />
      {pendingAttachment && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-arc-ink/10 bg-arc-ivory px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 truncate text-arc-ink">
            <Icon name="paperclip" size={14} className="shrink-0" />
            {pendingAttachment.name}
          </span>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            className="text-arc-copper hover:underline"
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
            className="rounded p-1 hover:bg-arc-paper"
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
            className="inline-flex items-center gap-1 text-arc-copper hover:underline"
          >
            <Mic className="h-4 w-4" />
            Media Comment
          </button>
        )}
        <button
          type="button"
          onClick={() => commentFileRef.current?.click()}
          className="inline-flex items-center gap-1 text-arc-copper hover:underline"
        >
          <Icon name="paperclip" size={16} />
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
        disabled={richTextIsEmpty(commentDraft) && !pendingAttachment}
        className="btn-canvas-primary mt-4 disabled:opacity-50"
      >
        Save
      </button>

      <ConfirmActionModal
        isOpen={confirmOpen}
        title="Post comment with attachment?"
        description="Your comment and file will be visible to your instructor."
        confirmText="Post comment"
        tone="primary"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          void saveComment();
        }}
      />
    </div>
  );
}

/** Lightweight composer for quiz / discussion GradePro. */
export function SimpleStudentCommentComposer({
  courseId,
  onSubmit,
  placeholder = "Write a comment…",
}: {
  courseId?: string;
  onSubmit: (body: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="border-t border-arc-ink/10 pt-4">
      <label className="mb-2 block text-sm font-semibold text-arc-ink">
        Add a Comment
      </label>
      <RichPromptField
        value={draft}
        onChange={setDraft}
        courseId={courseId}
        mountKey="simple-student-comment"
        placeholder={placeholder}
        height={140}
        alwaysEdit
      />
      <button
        type="button"
        disabled={richTextIsEmpty(draft)}
        onClick={() => {
          if (richTextIsEmpty(draft)) return;
          onSubmit(draft);
          setDraft("");
        }}
        className="btn-canvas-primary mt-2 disabled:opacity-50"
      >
        Post
      </button>
    </div>
  );
}
