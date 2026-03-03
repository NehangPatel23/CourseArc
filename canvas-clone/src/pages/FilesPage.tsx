// src/pages/FilesPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import {
  UploadCloud,
  File as FileIcon,
  Trash2,
  Download,
  Pencil,
  Folder,
  Plus,
  Lock,
} from "lucide-react";

import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import RenameFileModal from "../components/RenameFileModal";
import CanvasModal from "../components/CanvasModal";

import {
  type StoredFileMeta,
  formatBytes,
  idbDeleteBlob,
  idbGetBlob,
  idbPutBlob,
  loadFilesMeta,
  saveFilesMeta,
  uid,
  addModuleRefToFile,
  renameFileMetaInCourse,
} from "../utils/files";

import {
  loadModulesFromStorage,
  saveModulesToStorage,
  type ModuleT,
  type Item,
} from "../utils/modules";

import { loadProgress } from "../utils/progress";
import { useStudentView } from "../utils/studentView";
import { isFileLockedInStudentView } from "../utils/access";

export default function FilesPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const { studentView, courseKey: effectiveCourseId } = useStudentView(
    courseId ?? "default",
  );

  const [files, setFiles] = useState<StoredFileMeta[]>([]);
  const [modules, setModules] = useState<ModuleT[]>([]);
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  const [isDragging, setIsDragging] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<StoredFileMeta | null>(null);
  const [renameTarget, setRenameTarget] = useState<StoredFileMeta | null>(null);

  const [addTarget, setAddTarget] = useState<StoredFileMeta | null>(null);
  const [selectedModuleTitle, setSelectedModuleTitle] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!courseId) return;

    const refresh = () => setFiles(loadFilesMeta(courseId));
    refresh();

    const ms = loadModulesFromStorage();
    setModules(ms);
    if (ms.length > 0) setSelectedModuleTitle(ms[0].title);

    window.addEventListener("canvasClone:filesChanged", refresh);
    return () =>
      window.removeEventListener("canvasClone:filesChanged", refresh);
  }, [courseId]);

  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [files]);

  const persistFiles = (courseIdStr: string, next: StoredFileMeta[]) => {
    setFiles(next);
    saveFilesMeta(courseIdStr, next);
  };

  const persistModules = (next: ModuleT[]) => {
    setModules(next);
    saveModulesToStorage(next);
  };

  const markBusy = (id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  async function handleUpload(fileList: FileList | File[]) {
    const cid = courseId;
    if (!cid) return;

    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const newMetas: StoredFileMeta[] = [];

    for (const f of incoming) {
      const id = uid();
      markBusy(id, true);

      const meta: StoredFileMeta = {
        id,
        name: f.name,
        size: f.size,
        mime: f.type || "application/octet-stream",
        uploadedAt: Date.now(),
        moduleTitles: [],
      };

      try {
        await idbPutBlob(`${cid}:${id}`, f);
        newMetas.push(meta);
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        markBusy(id, false);
      }
    }

    if (newMetas.length > 0) {
      setFiles((prev) => {
        const next = [...prev, ...newMetas];
        saveFilesMeta(cid, next);
        return next;
      });
    }
  }

  async function downloadFile(meta: StoredFileMeta) {
    const cid = courseId;
    if (!cid) return;

    markBusy(meta.id, true);
    try {
      const blob = await idbGetBlob(`${cid}:${meta.id}`);
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      markBusy(meta.id, false);
    }
  }

  async function deleteFile(meta: StoredFileMeta) {
    const cid = courseId;
    if (!cid) return;

    markBusy(meta.id, true);
    try {
      await idbDeleteBlob(`${cid}:${meta.id}`);
      persistFiles(
        cid,
        files.filter((f) => f.id !== meta.id),
      );
    } finally {
      markBusy(meta.id, false);
    }
  }

  function renameFile(meta: StoredFileMeta, newName: string) {
    const cid = courseId;
    if (!cid) return;

    const trimmed = newName.trim();
    if (!trimmed) return;

    renameFileMetaInCourse({
      courseId: cid,
      fileId: meta.id,
      displayName: trimmed,
    });

    const next = loadFilesMeta(cid);
    setFiles(next);
  }

  function openAddToModule(meta: StoredFileMeta) {
    setAddTarget(meta);

    const preferred =
      meta.moduleTitles?.[0] &&
      modules.some((m) => m.title === meta.moduleTitles[0])
        ? meta.moduleTitles[0]
        : (modules[0]?.title ?? "");

    setSelectedModuleTitle(preferred);
  }

  function addFileToModule(meta: StoredFileMeta, moduleTitle: string) {
    const cid = courseId;
    if (!cid) return;
    if (!moduleTitle) return;

    const newItem: Item = {
      type: "file",
      label: meta.name,
      fileId: meta.id,
      fileName: meta.name,
    } as any;

    const nextModules = modules.map((m) =>
      m.title === moduleTitle ? { ...m, items: [...m.items, newItem] } : m,
    );
    persistModules(nextModules);

    addModuleRefToFile(cid, meta.id, moduleTitle);
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const onBrowse = () => fileInputRef.current?.click();

  if (!courseId) {
    return (
      <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
        <CourseHeader />
        <div className="px-16 py-10">
          <div className="max-w-4xl text-gray-700">Missing courseId.</div>
        </div>
      </div>
    );
  }

  // ✅ More space between Size and Actions
  const GRID = "grid-cols-[minmax(0,1fr)_minmax(0,360px)_120px_170px]";

  // ✅ Force-visible SVG stroke (beats any global CSS)
  const ICON_COLOR = "#2D3B45";
  const ICON_MUTED = "#9CA3AF";
  const ICON_DANGER = "#DC2626";

  const ACTION_BTN =
    "inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

  const ACTION_PLACEHOLDER = "w-9 h-9";

  // Hard clamp icon size + stroke via inline style so they cannot vanish
  const iconProps = (stroke: string) => ({
    className: "w-4 h-4 shrink-0",
    style: {
      stroke,
      color: stroke,
      fill: "none",
      strokeWidth: 2,
    } as React.CSSProperties,
  });

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="max-w-5xl w-full">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-canvas-grayDark">
                Files
              </h2>
              <p className="text-gray-600 leading-relaxed mt-1">
                Upload and manage course files. Files are stored locally
                (IndexedDB) for this prototype.
                {studentView ? " (Student view: read-only)" : ""}
              </p>
            </div>

            {!studentView && (
              <button
                type="button"
                onClick={onBrowse}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#008EE2] text-white text-sm font-medium hover:bg-[#0079C2] shadow-sm"
              >
                <UploadCloud
                  className="w-4 h-4"
                  style={{ stroke: "#FFFFFF" }}
                />
                Upload
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files) await handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {!studentView && (
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              className={`rounded-xl border ${
                isDragging
                  ? "border-[#008EE2] bg-blue-50"
                  : "border-dashed border-gray-300 bg-gray-50"
              } px-6 py-6 transition-colors`}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <UploadCloud {...iconProps(ICON_COLOR)} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#2D3B45]">
                    Drag & drop files here
                  </div>
                  <div className="text-xs text-gray-600">
                    Or{" "}
                    <button
                      type="button"
                      onClick={onBrowse}
                      className={[
                        "inline-flex items-center",
                        // ✅ hard reset against global button styling
                        "bg-transparent text-[#008EE2]",
                        "px-0 py-0 rounded-none shadow-none border-0",
                        "hover:underline font-medium",
                        "focus:outline-none focus:ring-0",
                      ].join(" ")}
                    >
                      browse
                    </button>{" "}
                    to upload.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="h-px bg-gray-200 my-6" />

          {sortedFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8">
              <p className="text-gray-700 font-medium">No files uploaded yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Upload PDFs, images, docs, etc.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div
                className={[
                  "bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 grid items-center gap-6",
                  GRID,
                ].join(" ")}
              >
                <span className="min-w-0">File</span>
                <span className="min-w-0">Modules</span>
                <span className="min-w-0">Size</span>
                <span className="text-right min-w-0">Actions</span>
              </div>

              <div className="divide-y divide-gray-200">
                {sortedFiles.map((f) => {
                  const busy = busyIds.has(f.id);

                  const modulesText =
                    f.moduleTitles && f.moduleTitles.length > 0
                      ? f.moduleTitles.join(", ")
                      : "—";

                  // ✅ Student view: if file is locked, it must be inaccessible from Files index too
                  const lockedInStudent = studentView
                    ? isFileLockedInStudentView(modules, progress, f.id)
                    : false;

                  return (
                    <div
                      key={f.id}
                      className={[
                        "px-5 py-4 hover:bg-gray-50 transition-colors grid items-center gap-6",
                        GRID,
                      ].join(" ")}
                    >
                      {/* File cell */}
                      <div className="flex items-center gap-3 min-w-0">
                        <FileIcon {...iconProps(ICON_MUTED)} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (studentView && lockedInStudent) return;
                              navigate(`/courses/${courseId}/files/${f.id}`);
                            }}
                            disabled={studentView && lockedInStudent}
                            className={[
                              "block max-w-full text-left truncate",
                              "text-sm font-semibold text-[#2D3B45] hover:underline",
                              // ✅ hard reset against global button styling
                              "bg-transparent",
                              "px-0 py-0 rounded-none",
                              "border-0 shadow-none",
                              "focus:outline-none focus:ring-0",
                              studentView && lockedInStudent
                                ? "opacity-60 cursor-not-allowed hover:no-underline"
                                : "",
                            ].join(" ")}
                            title={
                              studentView && lockedInStudent
                                ? "Locked in Student View (complete prerequisites)"
                                : "Open preview"
                            }
                          >
                            {f.name}
                          </button>
                          <div className="text-xs text-gray-500 truncate">
                            {new Date(f.uploadedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Modules cell */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder {...iconProps(ICON_MUTED)} />
                        <span className="text-sm text-gray-600 truncate min-w-0">
                          {modulesText}
                        </span>
                      </div>

                      {/* Size cell */}
                      <div className="text-sm text-gray-600">
                        {formatBytes(f.size)}
                      </div>

                      {/* Actions cell */}
                      <div className="flex items-center justify-end gap-2">
                        {studentView ? (
                          <>
                            {/* Lock and Download are identical button footprints */}
                            {lockedInStudent ? (
                              <div
                                className={[
                                  ACTION_BTN,
                                  "hover:bg-white cursor-default",
                                ].join(" ")}
                                title="Locked in Student View"
                              >
                                <Lock {...iconProps(ICON_MUTED)} />
                              </div>
                            ) : (
                              <div className={ACTION_PLACEHOLDER} />
                            )}

                            <button
                              type="button"
                              onClick={() => downloadFile(f)}
                              disabled={busy || lockedInStudent}
                              className={ACTION_BTN}
                              title={lockedInStudent ? "Locked" : "Download"}
                            >
                              <Download {...iconProps(ICON_COLOR)} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openAddToModule(f)}
                              disabled={busy || modules.length === 0}
                              className={ACTION_BTN}
                              title="Add to module"
                            >
                              <Plus {...iconProps(ICON_COLOR)} />
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadFile(f)}
                              disabled={busy}
                              className={ACTION_BTN}
                              title="Download"
                            >
                              <Download {...iconProps(ICON_COLOR)} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setRenameTarget(f)}
                              disabled={busy}
                              className={ACTION_BTN}
                              title="Rename"
                            >
                              <Pencil {...iconProps(ICON_COLOR)} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(f)}
                              disabled={busy}
                              className={[ACTION_BTN, "hover:bg-red-50"].join(
                                " ",
                              )}
                              title="Delete"
                            >
                              <Trash2 {...iconProps(ICON_DANGER)} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {!studentView && addTarget && (
        <CanvasModal
          title="Add file to module"
          onClose={() => setAddTarget(null)}
          size="md"
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              File: <span className="font-semibold">{addTarget.name}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2D3B45] mb-1">
                Module
              </label>
              <select
                value={selectedModuleTitle}
                onChange={(e) => setSelectedModuleTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
              >
                {modules.map((m) => (
                  <option key={m.title} value={m.title}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAddTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-[#2D3B45] bg-white hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!addTarget) return;
                  addFileToModule(addTarget, selectedModuleTitle);
                  setAddTarget(null);
                }}
                disabled={!selectedModuleTitle}
                className="px-4 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </CanvasModal>
      )}

      {!studentView && (
        <>
          <ConfirmDeleteModal
            isOpen={!!deleteTarget}
            title="Delete file?"
            description={
              deleteTarget
                ? `This will permanently remove "${deleteTarget.name}" from this course. This cannot be undone.`
                : ""
            }
            confirmText="Delete"
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (!deleteTarget) return;
              deleteFile(deleteTarget);
            }}
          />

          <RenameFileModal
            isOpen={!!renameTarget}
            initialName={renameTarget?.name ?? ""}
            onClose={() => setRenameTarget(null)}
            onRename={(newName) => {
              if (!renameTarget) return;
              renameFile(renameTarget, newName);
            }}
          />
        </>
      )}
    </div>
  );
}
