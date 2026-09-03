// src/pages/FilePreviewPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  File as FileIcon,
  CheckCircle2,
  Circle,
  Lock,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import ModulePrevNext from "../components/ModulePrevNext";
import {
  isFromModules,
  modulesPathFromState,
} from "../components/BackToModulesButton";
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

import CourseFilePreview from "../components/fileViewers/CourseFilePreview";
import { useStudentView } from "../utils/studentView";
import { isFileLockedInStudentView } from "../utils/access";

type FileOccurrence = {
  moduleTitle: string;
  itemLabel: string;
  mode: ModuleRequirementsMode;
};

export default function FilePreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, fileId } = useParams();

  const { studentView, courseKey: effectiveCourseId } = useStudentView(
    courseId ?? "default",
  );

  const [meta, setMeta] = useState<StoredFileMeta | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  // Modules + progress (for completion display + auto-toggle on access)
  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  // Keep progress in sync (course changes)
  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  // Persist progress ONLY in student view (matches PagesPage behavior)
  useEffect(() => {
    if (!studentView) return;
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress, studentView]);

  // Keep modules in sync with storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "canvasClone:modules") return;
      setModules(loadModulesFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load file meta
  useEffect(() => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;

    const metas = loadFilesMeta(cid);
    const m = metas.find((x) => x.id === fid) ?? null;
    setMeta(m);
  }, [courseId, fileId]);

  // Load blob + blob URL
  useEffect(() => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;

    let alive = true;

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

  // Find every module item that references this file
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

  // Lock check per occurrence
  function canInteractOccurrence(o: FileOccurrence) {
    const mod = modules.find((m) => m.title === o.moduleTitle);
    if (!mod) return { ok: false, reason: "missing_module" as const };

    const mode = mod.requirementsMode ?? "none";
    if (mode === "none") return { ok: true, reason: "not_gated" as const };

    const unlocked = isItemUnlocked(mod, mode, progress, o.itemLabel);
    if (!unlocked) return { ok: false, reason: "locked" as const };

    return { ok: true, reason: "ok" as const };
  }

  // Student-view global lock (enforced)
  const lockedInStudent = useMemo(() => {
    if (!studentView) return false;
    if (!fileId) return false;
    return isFileLockedInStudentView(modules, progress, fileId);
  }, [studentView, modules, progress, fileId]);

  const anyLockedByGating = useMemo(() => {
    // If any occurrence is gated and not unlocked, call it "locked"
    return fileOccurrences.some((o) => {
      const mod = modules.find((m) => m.title === o.moduleTitle);
      const mode = mod?.requirementsMode ?? "none";
      if (mode === "none") return false;
      return !canInteractOccurrence(o).ok;
    });
  }, [fileOccurrences, modules, progress]);

  // Status line (Completed/Not completed/Locked/etc.)
  const completionSummary = useMemo(() => {
    // If explicitly locked in student view, that wins
    if (studentView && lockedInStudent) {
      return {
        show: true,
        text: "Locked",
        icon: <Lock className="w-4 h-4 text-gray-400" />,
      };
    }

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

    if (totalRelevant === 0 && anyLockedByGating) {
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
  }, [
    fileOccurrences,
    modules,
    progress,
    anyLockedByGating,
    studentView,
    lockedInStudent,
  ]);

  // Auto-toggle completion on access (mark ALL unlocked gated occurrences complete)
  useEffect(() => {
    if (!courseId || !fileId) return;
    if (fileOccurrences.length === 0) return;

    // In student view, do NOT auto-complete if locked
    if (studentView && lockedInStudent) return;

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
  }, [
    courseId,
    fileId,
    fileOccurrences,
    modules,
    studentView,
    lockedInStudent,
  ]);

  const download = async () => {
    const cid = courseId;
    const fid = fileId;
    if (!cid || !fid) return;
    if (!blob) return;

    if (studentView && lockedInStudent) return;

    // Use existing blobUrl if present, otherwise create one for download
    const url = blobUrl ?? URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = meta?.name ?? "download";
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (!blobUrl) URL.revokeObjectURL(url);
  };

  if (!courseId || !fileId) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-transparent">
        <CourseHeader />
        <div className="px-16 py-10">
          <div className="w-full text-gray-700">
            Missing courseId or fileId.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-1 flex-col bg-transparent">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-transparent">
        <div className="w-full">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  const from = (location.state as { from?: string } | null)?.from;
                  if (isFromModules(from) && effectiveCourseId) {
                    navigate(modulesPathFromState(effectiveCourseId, from));
                  } else if (from) navigate(from);
                  else navigate(-1);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-arc-paper hover:bg-gray-50 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {isFromModules((location.state as { from?: string } | null)?.from)
                  ? "Back to Modules"
                  : "Back"}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-canvas-grayDark truncate">
                    {meta?.name ?? "File"}
                  </h2>

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
              disabled={!blob || (studentView && lockedInStudent)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-canvas-blue text-white text-sm font-medium hover:bg-canvas-blueDark disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                studentView && lockedInStudent
                  ? "Locked in Student View"
                  : "Download"
              }
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {studentView && lockedInStudent ? (
            <div className="rounded-xl border border-arc-line bg-arc-ivory px-6 py-10 text-gray-700">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4 text-gray-400" />
                This file is locked in Student View. Complete the
                prerequisites to access it.
              </div>
            </div>
          ) : (
            <CourseFilePreview
              blob={blob}
              blobUrl={blobUrl}
              fileName={meta?.name ?? "File"}
              mime={meta?.mime}
              size={meta?.size}
            />
          )}

          {fileId && (
            <ModulePrevNext
              courseId={effectiveCourseId}
              kind="file"
              itemId={fileId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
