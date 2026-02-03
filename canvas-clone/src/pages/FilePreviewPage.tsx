import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  File as FileIcon,
  CheckCircle2,
  Circle,
  Lock,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import {
  idbGetBlob,
  loadFilesMeta,
  formatBytes,
  type StoredFileMeta,
} from "../utils/files";

import {
  loadModulesFromStorage,
  type ModuleT,
  type ModuleRequirementsMode,
} from "../utils/modules";

import {
  loadProgress,
  saveProgress,
  getItemCompleted,
  setItemCompleted,
  isItemUnlocked,
} from "../utils/progress";

type PreviewKind = "image" | "pdf" | "video" | "audio" | "unknown";

type FileOccurrence = {
  moduleTitle: string;
  itemLabel: string;
  mode: ModuleRequirementsMode;
};

export default function FilePreviewPage() {
  const navigate = useNavigate();
  const { courseId, fileId } = useParams();

  const [meta, setMeta] = useState<StoredFileMeta | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  // If browser fails to play media, we can show a fallback message
  const [mediaError, setMediaError] = useState<string | null>(null);

  // ✅ NEW: modules + progress (for completion display + auto-toggle on access)
  const effectiveCourseId = courseId ?? "default";
  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  // Keep progress in sync (courseId changes)
  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  useEffect(() => {
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress]);

  // Keep modules in sync with storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "canvasClone:modules") return;
      setModules(loadModulesFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;

    const metas = loadFilesMeta(cid);
    const m = metas.find((x) => x.id === fid) ?? null;
    setMeta(m);
  }, [courseId, fileId]);

  useEffect(() => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;

    let alive = true;
    setMediaError(null);

    (async () => {
      const b = await idbGetBlob(`${cid}:${fid}`);
      if (!alive) return;

      setBlob(b ?? null);

      if (b) {
        const url = URL.createObjectURL(b);
        setBlobUrl(url);
      } else {
        setBlobUrl(null);
      }
    })();

    return () => {
      alive = false;
      setBlob(null);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [courseId, fileId]);

  const previewKind: PreviewKind = useMemo(() => {
    if (!meta) return "unknown";
    const mime = meta.mime ?? "";
    if (mime.startsWith("image/")) return "image";
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "unknown";
  }, [meta]);

  // ✅ NEW: find every module item that references this file
  const fileOccurrences: FileOccurrence[] = useMemo(() => {
    const fid = fileId;
    if (!fid) return [];

    const out: FileOccurrence[] = [];

    for (const m of modules) {
      const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;

      for (const it of m.items as any[]) {
        if (it?.type === "file" && it.fileId === fid) {
          out.push({
            moduleTitle: m.title,
            itemLabel: it.label,
            mode,
          });
        }
      }
    }

    return out;
  }, [modules, fileId]);

  // ✅ NEW: lock check on a per-occurrence basis
  function canInteractOccurrence(o: FileOccurrence) {
    const mod = modules.find((m) => m.title === o.moduleTitle);
    if (!mod) return { ok: false, reason: "missing_module" as const };

    const mode = mod.requirementsMode ?? "none";
    if (mode === "none") return { ok: true, reason: "not_gated" as const };

    const unlocked = isItemUnlocked(mod, mode, progress, o.itemLabel);
    if (!unlocked) return { ok: false, reason: "locked" as const };

    return { ok: true, reason: "ok" as const };
  }

  const anyLocked = useMemo(() => {
    // If any occurrence is gated and not unlocked, call it "locked"
    return fileOccurrences.some((o) => {
      const mod = modules.find((m) => m.title === o.moduleTitle);
      const mode = mod?.requirementsMode ?? "none";
      if (mode === "none") return false;
      return !canInteractOccurrence(o).ok;
    });
  }, [fileOccurrences, modules, progress]);

  // ✅ NEW: show a status line ALWAYS, and compute "Completed" like Pages
  const completionSummary = useMemo(() => {
    // Not referenced by any module item
    if (fileOccurrences.length === 0) {
      return {
        show: true,
        text: "Not in any module",
        icon: <Circle className="w-4 h-4 text-gray-300" />,
      };
    }

    const anyGated = fileOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) {
      return { show: true, text: "Not gated", icon: null as any };
    }

    let totalRelevant = 0;
    let doneRelevant = 0;

    for (const o of fileOccurrences) {
      const mod = modules.find((m) => m.title === o.moduleTitle);
      const mode = mod?.requirementsMode ?? "none";
      if (mode === "none") continue;

      const gate = canInteractOccurrence(o);
      if (!gate.ok) continue;

      totalRelevant += 1;
      if (getItemCompleted(progress, o.moduleTitle, o.itemLabel)) {
        doneRelevant += 1;
      }
    }

    if (totalRelevant === 0 && anyLocked) {
      return {
        show: true,
        text: "Locked",
        icon: <Lock className="w-4 h-4 text-gray-400" />,
      };
    }

    if (totalRelevant > 0 && doneRelevant === totalRelevant) {
      return {
        show: true,
        text: "Completed",
        icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      };
    }

    return {
      show: true,
      text: "Not completed",
      icon: <Circle className="w-4 h-4 text-gray-300" />,
    };
  }, [fileOccurrences, modules, progress, anyLocked]);

  // ✅ NEW: auto-toggle completion on access (mark ALL unlocked gated occurrences complete)
  useEffect(() => {
    if (!courseId || !fileId) return;
    if (fileOccurrences.length === 0) return;

    setProgress((p) => {
      let next = p;
      let changed = false;

      for (const o of fileOccurrences) {
        const mod = modules.find((m) => m.title === o.moduleTitle);
        if (!mod) continue;

        const mode = mod.requirementsMode ?? "none";
        if (mode === "none") continue;

        // only mark if unlocked (sequential rules)
        if (!isItemUnlocked(mod, mode, next, o.itemLabel)) continue;

        if (!getItemCompleted(next, o.moduleTitle, o.itemLabel)) {
          next = setItemCompleted(next, o.moduleTitle, o.itemLabel, true);
          changed = true;
        }
      }

      return changed ? next : p;
    });
  }, [courseId, fileId, fileOccurrences, modules]);

  const download = async () => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;
    if (!blob) return;

    // Use existing blobUrl if present, otherwise create one for download
    const url = blobUrl ?? URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = meta?.name ?? "download";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // If we created a temporary URL (blobUrl was null), revoke it
    if (!blobUrl) URL.revokeObjectURL(url);
  };

  if (!courseId || !fileId) {
    return (
      <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
        <CourseHeader />
        <div className="px-16 py-10">
          <div className="max-w-4xl text-gray-700">
            Missing courseId or fileId.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-[#2D3B45] truncate">
                    {meta?.name ?? "File"}
                  </h2>

                  {/* ✅ NEW: completion status chip (Canvas-like) */}
                  {completionSummary.show && (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      {completionSummary.icon}
                      {completionSummary.text}
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  {meta
                    ? `${formatBytes(meta.size)} • ${meta.mime}`
                    : "Loading…"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={download}
              disabled={!blob}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#008EE2] text-white text-sm font-medium hover:bg-[#0079C2] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
            {!blobUrl ? (
              <div className="px-6 py-10 text-gray-700">
                File blob not found in IndexedDB. Try re-uploading this file.
              </div>
            ) : mediaError ? (
              <div className="px-6 py-10 text-gray-700">
                {mediaError} Use Download instead.
              </div>
            ) : previewKind === "image" ? (
              <div className="bg-white">
                <img
                  src={blobUrl}
                  alt={meta?.name ?? "file"}
                  className="w-full max-h-[75vh] object-contain"
                />
              </div>
            ) : previewKind === "pdf" ? (
              <iframe
                title="PDF Preview"
                src={blobUrl}
                className="w-full h-[75vh] bg-white"
              />
            ) : previewKind === "video" ? (
              <div className="bg-black">
                <video
                  controls
                  className="w-full h-[75vh]"
                  src={blobUrl}
                  onError={() =>
                    setMediaError(
                      "This video format is not supported for inline preview.",
                    )
                  }
                />
              </div>
            ) : previewKind === "audio" ? (
              <div className="bg-white px-6 py-10">
                <audio
                  controls
                  className="w-full"
                  src={blobUrl}
                  onError={() =>
                    setMediaError(
                      "This audio format is not supported for inline preview.",
                    )
                  }
                />
                <div className="text-xs text-gray-500 mt-3">
                  If playback fails, download the file and open it locally.
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 text-gray-700">
                No inline preview available for this file type. Use Download.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
