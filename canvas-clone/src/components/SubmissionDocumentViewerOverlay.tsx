import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import SpeedGraderDocumentViewer from "./SpeedGraderDocumentViewer";
import { formatSubmissionTimestamp } from "../utils/assignmentDisplay";
import { loadDocumentAnnotations } from "../utils/submissionAnnotations";
import { downloadStoredFile, type StoredSubmissionFile } from "../utils/submissionFileStorage";

type Props = {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  fileName: string;
  stored: StoredSubmissionFile | null;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: number;
  onDownload?: () => void;
};

export default function SubmissionDocumentViewerOverlay({
  open,
  onClose,
  submissionId,
  fileName,
  stored,
  feedback,
  gradedBy,
  gradedAt,
  onDownload,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const handlePageCountChange = useCallback((total: number) => {
    setPageCount((prev) => (prev === total ? prev : total));
    setPage((p) => (p > total ? total : p));
  }, []);

  useEffect(() => {
    if (!open) return;
    setZoom(100);
    setRotation(0);
    setPage(1);
    setPageCount(1);
  }, [open, submissionId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const docAnnotations = loadDocumentAnnotations(submissionId);
  const showFeedbackPanel = Boolean(feedback) || docAnnotations.length > 0;

  const handleDownload = () => {
    if (stored) {
      downloadStoredFile(stored);
      return;
    }
    onDownload?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#2d3b45] text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/20 px-4 py-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
          title="Close viewer"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="truncate text-xs text-white/70">Submission preview with instructor feedback</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef0f3]">
          <div className="flex shrink-0 items-center gap-1 border-b border-gray-300 bg-[#f5f5f5] px-3 py-2 text-gray-700">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded p-1.5 hover:bg-gray-200"
              title="Download submission"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-1.5 hover:bg-gray-200 disabled:opacity-40"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded p-1.5 hover:bg-gray-200 disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded p-1.5 hover:bg-gray-200"
              title="Rotate document"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <div className="mx-2 h-5 w-px bg-gray-300" />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="rounded p-1.5 hover:bg-gray-200"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="rounded p-1.5 hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(100);
                setRotation(0);
              }}
              className="rounded p-1.5 hover:bg-gray-200"
              title="Reset view"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <SpeedGraderDocumentViewer
              submissionId={submissionId}
              stored={stored}
              fileName={fileName}
              zoom={zoom}
              rotation={rotation}
              page={page}
              readOnly
              onPageCountChange={handlePageCountChange}
            />
          </div>
        </div>

        {showFeedbackPanel && (
          <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-gray-300 bg-white text-canvas-grayDark">
            <div className="space-y-4 p-5">
              <h3 className="text-sm font-semibold">Feedback</h3>
              {feedback && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-green-800">Assignment feedback</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{feedback}</p>
                  {(gradedBy || gradedAt) && (
                    <p className="mt-2 text-xs text-gray-500">
                      {gradedBy ?? "Instructor"}
                      {gradedAt ? ` · ${formatSubmissionTimestamp(gradedAt)}` : ""}
                    </p>
                  )}
                </div>
              )}
              {docAnnotations.map((ann) => (
                <div key={ann.id} className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
                  <p className="text-xs font-medium text-canvas-blue">
                    Page {ann.page} · {ann.type === "pin" ? "Comment pin" : "Text note"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{ann.body}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {ann.author}, {formatSubmissionTimestamp(ann.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
