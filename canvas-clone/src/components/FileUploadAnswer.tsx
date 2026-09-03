import { useRef, useState } from "react";
import type { QuizAnswer } from "../utils/quizSubmissions";
import type { QuizQuestion } from "../utils/quizzes";
import {
  deleteQuizAnswerFile,
  downloadQuizAnswerFile,
  fileMatchesAllowed,
  formatAllowedTypes,
  saveQuizAnswerFile,
} from "../utils/quizFileAnswers";
import { useToast } from "./ui/Toast";

const DEFAULT_MAX = 8 * 1024 * 1024;

type Props = {
  question: QuizQuestion;
  answer?: QuizAnswer;
  onChange: (next: QuizAnswer) => void;
  disabled: boolean;
  storageKey: string;
  review?: boolean;
};

export default function FileUploadAnswer({
  question,
  answer,
  onChange,
  disabled,
  storageKey,
  review,
}: Props) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const maxBytes = question.maxUploadBytes && question.maxUploadBytes > 0 ? question.maxUploadBytes : DEFAULT_MAX;
  const accept = (question.allowedMimeTypes ?? []).join(",");

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxBytes) {
      showToast(`File must be under ${Math.round(maxBytes / (1024 * 1024))}MB`, "negative");
      return;
    }
    if (!fileMatchesAllowed(file, question.allowedMimeTypes)) {
      showToast(`Allowed types: ${formatAllowedTypes(question.allowedMimeTypes)}`, "negative");
      return;
    }
    setBusy(true);
    try {
      const meta = await saveQuizAnswerFile(storageKey, file);
      onChange({
        questionId: question.id,
        fileStorageKey: meta.storageKey,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        fileMime: meta.mimeType,
      });
      showToast("File attached", "positive", "files");
    } catch {
      showToast("Could not store the file in this browser", "negative");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (answer?.fileStorageKey) {
      try {
        await deleteQuizAnswerFile(answer.fileStorageKey);
      } catch {}
    }
    onChange({ questionId: question.id });
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDownload = async () => {
    if (!answer?.fileStorageKey || !answer.fileName) return;
    try {
      await downloadQuizAnswerFile({
        storageKey: answer.fileStorageKey,
        fileName: answer.fileName,
        fileSize: answer.fileSize ?? 0,
        mimeType: answer.fileMime ?? "application/octet-stream",
      });
    } catch {
      showToast("File is not available on this device (upload is stored locally).", "negative");
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-arc-mute">
        {formatAllowedTypes(question.allowedMimeTypes)} · max {Math.round(maxBytes / (1024 * 1024))}MB
      </p>
      {answer?.fileName ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-arc-line bg-arc-ivory px-3 py-2 text-sm">
          <span className="font-medium text-arc-ink">{answer.fileName}</span>
          {typeof answer.fileSize === "number" && (
            <span className="text-arc-mute">({Math.max(1, Math.round(answer.fileSize / 1024))} KB)</span>
          )}
          <button type="button" className="text-arc-copper hover:underline" onClick={() => void onDownload()}>
            Download
          </button>
          {!disabled && (
            <button type="button" className="text-arc-mute hover:text-arc-ink hover:underline" onClick={() => void onRemove()}>
              Remove
            </button>
          )}
        </div>
      ) : disabled ? (
        <p className="text-sm italic text-arc-mute">No file uploaded.</p>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept={accept || undefined}
          disabled={busy}
          onChange={(e) => void onPick(e.target.files?.[0])}
          className="block w-full text-sm text-arc-ink file:mr-3 file:rounded-md file:border file:border-arc-line file:bg-arc-paper file:px-3 file:py-1.5 file:text-sm"
        />
      )}
      {review && (
        <p className="text-xs text-amber-700">File uploads are graded manually in GradePro.</p>
      )}
    </div>
  );
}
