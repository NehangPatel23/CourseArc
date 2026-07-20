import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { MessageSquare, Trash2, Type, X } from "lucide-react";
import { detectPreviewKind } from "../utils/filePreviewKind";
import {
  addDocumentAnnotation,
  deleteDocumentAnnotation,
  loadDocumentAnnotations,
  updateDocumentAnnotation,
  type DocumentAnnotation,
} from "../utils/submissionAnnotations";
import type { StoredSubmissionFile } from "../utils/submissionFileStorage";
import SubmissionFileViewer from "./SubmissionFileViewer";

export type GraderAnnotationTool = "select" | "comment" | "text";

type Props = {
  submissionId: string;
  stored: StoredSubmissionFile | null;
  fileName: string;
  zoom: number;
  rotation: number;
  page: number;
  activeTool?: GraderAnnotationTool;
  readOnly?: boolean;
  /** When true, pin/text annotations are not rendered (e.g. grades not yet posted). */
  hideAnnotations?: boolean;
  onPageCountChange?: (total: number) => void;
  onAnnotationsChange?: () => void;
};

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeTextContent(stored: StoredSubmissionFile): string {
  const comma = stored.dataUrl.indexOf(",");
  if (comma < 0) return "";
  const meta = stored.dataUrl.slice(0, comma);
  const payload = stored.dataUrl.slice(comma + 1);
  const binary = atob(payload);
  if (meta.includes("base64")) {
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(payload);
}

type DocMetrics = { width: number; height: number };

let pdfWorkerConfigured = false;

async function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  pdfWorkerConfigured = true;
}

function SpeedGraderDocumentViewer({
  submissionId,
  stored,
  fileName,
  zoom,
  rotation,
  page,
  activeTool = "select",
  readOnly = false,
  hideAnnotations = false,
  onPageCountChange,
  onAnnotationsChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>(() =>
    loadDocumentAnnotations(submissionId),
  );
  const [docMetrics, setDocMetrics] = useState<DocMetrics | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [pendingPin, setPendingPin] = useState<{ xPct: number; yPct: number } | null>(null);
  const onPageCountChangeRef = useRef(onPageCountChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const lastPageCountRef = useRef<number | null>(null);

  onPageCountChangeRef.current = onPageCountChange;
  onAnnotationsChangeRef.current = onAnnotationsChange;

  const previewKind = detectPreviewKind(fileName, stored?.mimeType);
  const isPdf = previewKind === "pdf";
  const isImage = previewKind === "image";
  const isText = previewKind === "text";
  const usesAnnotatableCanvas = isPdf || isImage || isText;

  const refreshAnnotations = useCallback(() => {
    setAnnotations(loadDocumentAnnotations(submissionId));
    onAnnotationsChangeRef.current?.();
  }, [submissionId]);

  useEffect(() => {
    refreshAnnotations();
    const handler = () => refreshAnnotations();
    window.addEventListener("canvasClone:docAnnotationsChanged", handler);
    return () => window.removeEventListener("canvasClone:docAnnotationsChanged", handler);
  }, [refreshAnnotations]);

  useEffect(() => {
    setActivePinId(null);
    setPendingPin(null);
    setDraftBody("");
  }, [submissionId, page]);

  useEffect(() => {
    lastPageCountRef.current = null;
  }, [submissionId, stored?.dataUrl]);

  const storedDataUrl = stored?.dataUrl ?? null;

  useEffect(() => {
    if (!storedDataUrl) return;
    const dataUrl = storedDataUrl;
    let cancelled = false;

    const notifyPageCount = (total: number) => {
      if (lastPageCountRef.current === total) return;
      lastPageCountRef.current = total;
      onPageCountChangeRef.current?.(total);
    };

    async function render() {
      setRenderError(null);
      try {
        if (isPdf) {
          await ensurePdfWorker();
          const pdfjs = await import("pdfjs-dist");
          const bytes = dataUrlToUint8Array(dataUrl);
          const pdf = await pdfjs.getDocument({ data: bytes }).promise;
          if (cancelled) return;

          const total = pdf.numPages;
          notifyPageCount(total);

          const pdfPage = await pdf.getPage(Math.min(Math.max(1, page), total));
          const viewport = pdfPage.getViewport({ scale: 1.4 * (zoom / 100) });
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (!cancelled) setDocMetrics({ width: viewport.width, height: viewport.height });
          return;
        }

        if (isImage) {
          const img = new Image();
          img.src = dataUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Image failed to load"));
          });
          if (cancelled) return;
          const scale = zoom / 100;
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, w, h);
          notifyPageCount(1);
          setDocMetrics({ width: w, height: h });
          return;
        }

        if (isText) {
          notifyPageCount(1);
          setDocMetrics({ width: 720, height: 900 });
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Failed to render document");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [storedDataUrl, isPdf, isImage, isText, page, zoom]);

  const pageAnnotations = hideAnnotations
    ? []
    : annotations.filter((a) => a.page === page);

  const handleDocumentClick = (e: MouseEvent<HTMLDivElement>) => {
    if (readOnly) {
      setPendingPin(null);
      setActivePinId(null);
      return;
    }
    if (!docRef.current || !docMetrics) return;
    const rect = docRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTool === "comment") {
      setPendingPin({ xPct, yPct });
      setDraftBody("");
      setActivePinId(null);
      return;
    }

    if (activeTool === "text") {
      const text = window.prompt("Enter annotation text:");
      if (!text?.trim()) return;
      addDocumentAnnotation(submissionId, {
        type: "text",
        page,
        xPct,
        yPct,
        body: text.trim(),
      });
      refreshAnnotations();
    }

    if (activeTool === "select") {
      setPendingPin(null);
      setActivePinId(null);
    }
  };

  const savePendingPin = () => {
    if (!pendingPin || !draftBody.trim()) return;
    addDocumentAnnotation(submissionId, {
      type: "pin",
      page,
      xPct: pendingPin.xPct,
      yPct: pendingPin.yPct,
      body: draftBody.trim(),
    });
    setPendingPin(null);
    setDraftBody("");
    refreshAnnotations();
  };

  const saveEditPin = (id: string) => {
    if (!draftBody.trim()) return;
    updateDocumentAnnotation(submissionId, id, { body: draftBody.trim() });
    setActivePinId(null);
    setDraftBody("");
    refreshAnnotations();
  };

  if (!stored) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center p-8 text-center text-sm text-gray-500">
        File preview unavailable. Re-submit the assignment to enable the document viewer.
      </div>
    );
  }

  if (!usesAnnotatableCanvas) {
    return (
      <SubmissionFileViewer
        stored={stored}
        fileName={fileName}
        fillHeight
        readOnly={readOnly}
      />
    );
  }

  if (renderError) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center p-8 text-center text-sm text-red-600">
        {renderError}
      </div>
    );
  }

  const cursorClass =
    !readOnly && (activeTool === "comment" || activeTool === "text")
      ? "cursor-crosshair"
      : "cursor-default";

  return (
    <div className="flex min-h-full w-full justify-center bg-[#c8ccd1] p-6">
      <div
        className="inline-block origin-center transition-transform duration-200"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div
          ref={docRef}
          className={`relative bg-white shadow-lg ${cursorClass}`}
          style={{
            width: docMetrics?.width ?? 720,
            height: docMetrics?.height ?? 900,
          }}
          onClick={handleDocumentClick}
          role="presentation"
        >
          {isText ? (
            <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words p-8 text-sm text-gray-800">
              {decodeTextContent(stored)}
            </pre>
          ) : (
            <canvas ref={canvasRef} className="block h-full w-full" />
          )}

          <div className="pointer-events-none absolute inset-0">
            {pageAnnotations.map((ann) => (
              <div
                key={ann.id}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${ann.xPct}%`, top: `${ann.yPct}%` }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePinId(ann.id);
                    setDraftBody(ann.body);
                    setPendingPin(null);
                  }}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shadow-md ${
                    ann.type === "pin"
                      ? "bg-canvas-blue text-white"
                      : "bg-amber-400 text-gray-900"
                  }`}
                >
                  {ann.type === "pin" ? (
                    <MessageSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Type className="h-3.5 w-3.5" />
                  )}
                  {ann.author.split(" ")[0]}
                </button>
                {activePinId === ann.id && (
                  <div
                    className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs text-gray-500">{ann.author}</p>
                    {!readOnly && activeTool === "select" ? (
                      <>
                        <textarea
                          value={draftBody}
                          onChange={(e) => setDraftBody(e.target.value)}
                          rows={3}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditPin(ann.id)}
                            className="rounded bg-canvas-blue px-2 py-1 text-xs text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteDocumentAnnotation(submissionId, ann.id);
                              setActivePinId(null);
                              refreshAnnotations();
                            }}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-xs text-gray-700">{ann.body}</p>
                    )}
                  </div>
                )}
                {activePinId !== ann.id && ann.type === "text" && (
                  <div className="mt-1 max-w-[200px] rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-gray-800 shadow">
                    {ann.body}
                  </div>
                )}
              </div>
            ))}

            {!readOnly && pendingPin && (
              <div
                className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-full"
                style={{ left: `${pendingPin.xPct}%`, top: `${pendingPin.yPct}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas-blue text-white shadow-lg">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div className="absolute left-1/2 top-full mt-2 w-60 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Add comment
                  </label>
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    placeholder="Write feedback on this spot..."
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={savePendingPin}
                      disabled={!draftBody.trim()}
                      className="rounded bg-canvas-blue px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPin(null);
                        setDraftBody("");
                      }}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function viewerPropsEqual(prev: Props, next: Props) {
  return (
    prev.submissionId === next.submissionId &&
    prev.stored?.dataUrl === next.stored?.dataUrl &&
    prev.fileName === next.fileName &&
    prev.zoom === next.zoom &&
    prev.rotation === next.rotation &&
    prev.page === next.page &&
    prev.activeTool === next.activeTool &&
    prev.readOnly === next.readOnly &&
    prev.hideAnnotations === next.hideAnnotations
  );
}

export default memo(SpeedGraderDocumentViewer, viewerPropsEqual);
