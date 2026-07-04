import { useMemo } from "react";
import { Download, FileText } from "lucide-react";
import RichContentViewer from "./RichContentViewer";
import { fileExtension } from "../utils/assignmentDisplay";
import {
  downloadStoredFile,
  type StoredSubmissionFile,
} from "../utils/submissionFileStorage";

type PreviewTarget =
  | { kind: "file"; stored: StoredSubmissionFile | null; fileName: string }
  | { kind: "text"; body: string; courseId: string };

type Props = {
  target: PreviewTarget;
  onDownload?: () => void;
  fillHeight?: boolean;
};

function canEmbedPreview(stored: StoredSubmissionFile | null, fileName: string): boolean {
  if (!stored) return false;
  const mime = stored.mimeType.toLowerCase();
  const ext = fileExtension(fileName);
  return (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    ext === "pdf" ||
    mime.startsWith("text/") ||
    ext === "txt" ||
    ext === "html" ||
    ext === "htm"
  );
}

export default function SubmissionContentPreview({ target, onDownload, fillHeight }: Props) {
  const stored = target.kind === "file" ? target.stored : null;
  const fileName = target.kind === "file" ? target.fileName : "";

  const textContent = useMemo(() => {
    if (!stored || target.kind !== "file") return null;
    const mime = stored.mimeType.toLowerCase();
    const ext = fileExtension(fileName);
    if (!mime.startsWith("text/") && ext !== "txt" && ext !== "html" && ext !== "htm") {
      return null;
    }
    const comma = stored.dataUrl.indexOf(",");
    if (comma < 0) return null;
    const meta = stored.dataUrl.slice(0, comma);
    const payload = stored.dataUrl.slice(comma + 1);
    const binary = atob(payload);
    if (meta.includes("base64")) {
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  }, [stored, fileName, target.kind]);

  if (target.kind === "text") {
    return (
      <div className={`bg-white p-6 ${fillHeight ? "min-h-full" : "min-h-[320px]"}`}>
        <RichContentViewer html={target.body} courseId={target.courseId} />
      </div>
    );
  }

  if (!stored) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${
          fillHeight ? "h-full min-h-full" : "min-h-[420px]"
        }`}
      >
        <FileText className="h-12 w-12 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">{fileName}</p>
        <p className="max-w-sm text-xs text-gray-500">
          Preview is not available for this file. It may have been submitted before file preview
          was enabled, or the file was too large to store locally.
        </p>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
          >
            <Download className="h-4 w-4" />
            Try download
          </button>
        )}
      </div>
    );
  }

  const mime = stored.mimeType.toLowerCase();
  const ext = fileExtension(fileName);

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return (
      <div
        className={`flex items-center justify-center bg-[#eef0f3] p-4 ${
          fillHeight ? "h-full min-h-full" : "min-h-[420px]"
        }`}
      >
        <img
          src={stored.dataUrl}
          alt={fileName}
          className={`max-w-full rounded border border-canvas-border bg-white object-contain shadow-sm ${
            fillHeight ? "max-h-full" : "max-h-[70vh]"
          }`}
        />
      </div>
    );
  }

  if (mime === "application/pdf" || ext === "pdf") {
    return (
      <iframe
        title={fileName}
        src={stored.dataUrl}
        className={`w-full border-0 bg-white ${fillHeight ? "h-full min-h-full" : "min-h-[560px]"}`}
      />
    );
  }

  if (textContent != null) {
    return (
      <div className={`overflow-auto bg-white p-6 ${fillHeight ? "h-full min-h-full" : "min-h-[420px]"}`}>
        <pre className="whitespace-pre-wrap break-words text-sm text-canvas-grayDark">
          {textContent}
        </pre>
      </div>
    );
  }

  if (!canEmbedPreview(stored, fileName)) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="h-12 w-12 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">{fileName}</p>
        <p className="text-xs text-gray-500">
          Inline preview is not supported for this file type.
        </p>
        <button
          type="button"
          onClick={() => downloadStoredFile(stored)}
          className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
        >
          <Download className="h-4 w-4" />
          Download {fileName}
        </button>
      </div>
    );
  }

  return null;
}
