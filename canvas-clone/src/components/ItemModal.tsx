import { useEffect, useMemo, useRef, useState } from "react";
import CanvasModal from "./CanvasModal";
import {
  addFileToCourse,
  loadFilesMeta,
  type StoredFileMeta,
} from "../utils/files";

type ItemType = "page" | "file" | "link" | "section";
type ItemRequirementType = "must_view" | "must_mark_done";

export type ItemModalValue = {
  type: ItemType;
  label: string;
  url?: string;

  fileId?: string;
  fileName?: string;

  // ✅ NEW
  requirementType?: ItemRequirementType;
};

type Props = {
  mode: "add" | "edit";
  initialValues?: {
    type: ItemType;
    label: string;
    url?: string;
    fileId?: string;
    fileName?: string;

    // ✅ NEW
    requirementType?: ItemRequirementType;
  };
  onClose: () => void;
  onSubmit: (item: ItemModalValue) => void;

  courseId?: string;
  moduleTitle?: string;
};

function isValidUrlLike(s: string) {
  return !!s.trim();
}

type FileAddMode = "upload" | "existing";
type FileEditMode = "replace" | "switch";

export default function ItemModal({
  mode,
  initialValues,
  onClose,
  onSubmit,
  courseId,
  moduleTitle,
}: Props) {
  const [type, setType] = useState<ItemType>(initialValues?.type ?? "page");
  const [label, setLabel] = useState<string>(initialValues?.label ?? "");
  const [url, setUrl] = useState<string>(initialValues?.url ?? "");

  // ✅ NEW: requirement type (default conservative)
  const [requirementType, setRequirementType] = useState<ItemRequirementType>(
    initialValues?.requirementType ?? "must_mark_done",
  );

  // File flows
  const [fileAddMode, setFileAddMode] = useState<FileAddMode>("upload");
  const [fileEditMode, setFileEditMode] = useState<FileEditMode>("replace");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFiles, setExistingFiles] = useState<StoredFileMeta[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");

  const [isWorking, setIsWorking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialValues) return;
    setType(initialValues.type);
    setLabel(initialValues.label ?? "");
    setUrl(initialValues.url ?? "");
    setRequirementType(initialValues.requirementType ?? "must_mark_done");
  }, [initialValues]);

  // If user switches to section, requirementType is irrelevant; keep state but we won't submit it.
  // If user switches away from section and requirementType is empty for some reason, default it.
  useEffect(() => {
    if (type === "section") return;
    if (!requirementType) setRequirementType("must_mark_done");
  }, [type, requirementType]);

  // Load course files when type=file
  useEffect(() => {
    if (type !== "file") return;
    if (!courseId) {
      setExistingFiles([]);
      return;
    }
    const list = loadFilesMeta(courseId);
    setExistingFiles(list);
    if (!selectedExistingId && list.length > 0) {
      setSelectedExistingId(list[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  // When picking an existing file, default label to its name in Add mode (unless user already typed)
  useEffect(() => {
    if (type !== "file") return;
    if (mode !== "add") return;
    if (fileAddMode !== "existing") return;
    const meta = existingFiles.find((f) => f.id === selectedExistingId);
    if (!meta) return;
    if (!label.trim()) setLabel(meta.name);
  }, [type, mode, fileAddMode, selectedExistingId, existingFiles, label]);

  // If upload new is chosen and file picked, default label to file name if empty
  useEffect(() => {
    if (type !== "file") return;
    if (!selectedFile) return;
    if (!label.trim()) setLabel(selectedFile.name);
  }, [type, selectedFile, label]);

  const canSubmit = useMemo(() => {
    if (!label.trim()) return false;

    if (type === "link") return isValidUrlLike(url);

    // Section headers have no additional fields.
    if (type === "section") return true;

    if (type === "file") {
      if (!courseId) return false;

      if (mode === "add") {
        return fileAddMode === "upload" ? !!selectedFile : !!selectedExistingId;
      }

      // edit
      if (fileEditMode === "replace") {
        // We allow save even if no file is selected (label-only edit).
        return true;
      }
      if (fileEditMode === "switch") {
        return !!selectedExistingId;
      }
    }

    return true;
  }, [
    label,
    type,
    url,
    mode,
    courseId,
    selectedFile,
    selectedExistingId,
    fileAddMode,
    fileEditMode,
  ]);

  const submit = async () => {
    if (!canSubmit) return;

    // Section headers (module-only visual grouping)
    if (type === "section") {
      onSubmit({
        type: "section",
        label: label.trim(),
        // requirementType intentionally omitted
      });
      onClose();
      return;
    }

    if (type === "file") {
      if (!courseId) return;

      setIsWorking(true);
      try {
        // ----------------
        // ADD MODE
        // ----------------
        if (mode === "add") {
          if (fileAddMode === "existing") {
            const meta = existingFiles.find((f) => f.id === selectedExistingId);
            if (!meta) return;

            onSubmit({
              type: "file",
              label: label.trim(), // ✅ keep display name
              fileId: meta.id,
              fileName: meta.name, // ✅ store actual file name
              requirementType,
            });

            onClose();
            return;
          }

          // upload new -> add to Files
          if (!selectedFile) return;

          const meta = await addFileToCourse({
            courseId,
            file: selectedFile,
            moduleTitle,
            displayName: label.trim(),
          });

          onSubmit({
            type: "file",
            label: meta.name,
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });
          onClose();
          return;
        }

        // ----------------
        // EDIT MODE
        // ----------------
        const currentId = initialValues?.fileId;
        const currentName = initialValues?.fileName;

        // Switch to existing file from Files
        if (fileEditMode === "switch") {
          const meta = existingFiles.find((f) => f.id === selectedExistingId);
          if (!meta) return;

          onSubmit({
            type: "file",
            label: label.trim(), // ✅ keep display name
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });

          onClose();
          return;
        }

        // Replace upload (MODULE-ONLY REPLACEMENT)
        if (selectedFile) {
          const meta = await addFileToCourse({
            courseId,
            file: selectedFile,
            moduleTitle,
            displayName: label.trim(),
          });

          onSubmit({
            type: "file",
            label: label.trim(), // ✅ keep display name
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });
          onClose();
          return;
        }

        // Label-only edit (no replacement selected)
        onSubmit({
          type: "file",
          label: label.trim(),
          fileId: currentId,
          fileName: currentName,
          requirementType,
        });
        onClose();
        return;
      } finally {
        setIsWorking(false);
      }
    }

    // Non-file types
    onSubmit({
      type,
      label: label.trim(),
      url: type === "link" ? url.trim() : undefined,
      requirementType,
    });
    onClose();
  };

  return (
    <CanvasModal
      title={mode === "add" ? "Add Item" : "Edit Item"}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-[#2D3B45] mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
          >
            <option value="page">Page</option>
            <option value="file">File</option>
            <option value="link">External URL</option>
            <option value="section">Section Header</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[#2D3B45] mb-1">
            Name
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] placeholder-gray-400 focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
            placeholder={
              type === "file"
                ? "File name"
                : type === "section"
                  ? "Section title (e.g., Learning Materials)"
                  : "Item name"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        {/* ✅ Requirement */}
        {type !== "section" && (
          <div>
            <label className="block text-sm font-medium text-[#2D3B45] mb-1">
              Requirement
            </label>
            <select
              value={requirementType}
              onChange={(e) =>
                setRequirementType(e.target.value as ItemRequirementType)
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
            >
              <option value="must_mark_done">Must mark as done</option>
              <option value="must_view">
                Must view (auto-complete on view)
              </option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              “Must view” will automatically mark the item complete when opened.
            </p>
          </div>
        )}

        {/* Link URL */}
        {type === "link" && (
          <div>
            <label className="block text-sm font-medium text-[#2D3B45] mb-1">
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] placeholder-gray-400 focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
              placeholder="https://example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
        )}

        {/* FILE UI */}
        {type === "file" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#2D3B45]">
              File
            </label>

            {!courseId ? (
              <p className="text-xs text-red-600">
                Missing courseId (cannot use files).
              </p>
            ) : null}

            {/* Add mode: Upload vs Existing */}
            {mode === "add" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFileAddMode("upload")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileAddMode === "upload"
                        ? "border-[#008EE2] text-[#008EE2] bg-blue-50"
                        : "border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    Upload new
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileAddMode("existing")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileAddMode === "existing"
                        ? "border-[#008EE2] text-[#008EE2] bg-blue-50"
                        : "border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    Select existing
                  </button>
                </div>

                {fileAddMode === "upload" ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                    >
                      Choose file
                    </button>
                    <div className="text-sm text-gray-600 min-w-0 truncate">
                      {selectedFile?.name ?? "No file selected"}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFile(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
                    >
                      {existingFiles.length === 0 ? (
                        <option value="">No files available</option>
                      ) : (
                        existingFiles.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500">
                      This will create a module item referencing the existing
                      file (no upload).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Edit mode: Replace vs Switch
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFileEditMode("replace")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileEditMode === "replace"
                        ? "border-[#008EE2] text-[#008EE2] bg-blue-50"
                        : "border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    Replace upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileEditMode("switch")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileEditMode === "switch"
                        ? "border-[#008EE2] text-[#008EE2] bg-blue-50"
                        : "border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    Switch to existing
                  </button>
                </div>

                {fileEditMode === "replace" ? (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">
                      Current: {initialValues?.fileName ?? "File"}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                      >
                        Choose replacement
                      </button>
                      <div className="text-sm text-gray-600 min-w-0 truncate">
                        {selectedFile?.name ?? "No replacement selected"}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setSelectedFile(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Replacing here uploads a NEW file and updates only this
                      module item to point to it. The old file stays in Files.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
                    >
                      {existingFiles.length === 0 ? (
                        <option value="">No files available</option>
                      ) : (
                        existingFiles.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500">
                      This makes the module item point to another file from
                      Files.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-[#2D3B45] bg-white hover:bg-gray-100 transition-all"
            disabled={isWorking}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || isWorking}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isWorking ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
