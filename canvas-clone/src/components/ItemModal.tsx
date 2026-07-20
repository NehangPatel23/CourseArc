import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import CanvasModal from "./CanvasModal";
import {
  addFileToCourse,
  loadFilesMeta,
  type StoredFileMeta,
} from "../utils/files";
import { loadAssignments, type Assignment } from "../utils/assignments";
import { loadQuizzes, type Quiz } from "../utils/quizzes";
import { loadTopics, type DiscussionTopic } from "../utils/discussions";

type ItemType = "page" | "file" | "link" | "section" | "assignment" | "quiz" | "discussion";
type ItemRequirementType = "must_view" | "must_mark_done";

export type ItemModalValue = {
  type: ItemType;
  label: string;
  url?: string;

  fileId?: string;
  fileName?: string;

  assignmentId?: string;
  quizId?: string;
  discussionId?: string;
  /** Course that owns the linked assignment/quiz/discussion. */
  ownerCourseId?: string;

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
    assignmentId?: string;
    quizId?: string;
    discussionId?: string;

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

  // Assignment / quiz linking
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    initialValues?.assignmentId ?? "",
  );
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    initialValues?.quizId ?? "",
  );
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string>(
    initialValues?.discussionId ?? "",
  );

  const [isWorking, setIsWorking] = useState(false);

  // Popup picker for choosing an assignment/quiz to link.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

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

  // Load assignments / quizzes for linking
  useEffect(() => {
    if (type !== "assignment" || !courseId) return;
    const list = loadAssignments(courseId);
    setAssignments(list);
    if (!selectedAssignmentId && list.length > 0) setSelectedAssignmentId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  useEffect(() => {
    if (type !== "quiz" || !courseId) return;
    const list = loadQuizzes(courseId);
    setQuizzes(list);
    if (!selectedQuizId && list.length > 0) setSelectedQuizId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  useEffect(() => {
    if (type !== "discussion" || !courseId) return;
    const list = loadTopics(courseId);
    setTopics(list);
    if (!selectedDiscussionId && list.length > 0) setSelectedDiscussionId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  // Default the label to the linked assignment/quiz title when empty
  useEffect(() => {
    if (type !== "assignment" || mode !== "add") return;
    const a = assignments.find((x) => x.id === selectedAssignmentId);
    if (a && !label.trim()) setLabel(a.title);
  }, [type, mode, selectedAssignmentId, assignments, label]);

  useEffect(() => {
    if (type !== "quiz" || mode !== "add") return;
    const q = quizzes.find((x) => x.id === selectedQuizId);
    if (q && !label.trim()) setLabel(q.title);
  }, [type, mode, selectedQuizId, quizzes, label]);

  useEffect(() => {
    if (type !== "discussion" || mode !== "add") return;
    const t = topics.find((x) => x.id === selectedDiscussionId);
    if (t && !label.trim()) setLabel(t.title);
  }, [type, mode, selectedDiscussionId, topics, label]);

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

    if (type === "assignment") return !!courseId && !!selectedAssignmentId;
    if (type === "quiz") return !!courseId && !!selectedQuizId;
    if (type === "discussion") return !!courseId && !!selectedDiscussionId;

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
    selectedAssignmentId,
    selectedQuizId,
    selectedDiscussionId,
    fileAddMode,
    fileEditMode,
  ]);

  const selectedAssignmentTitle = useMemo(
    () => assignments.find((a) => a.id === selectedAssignmentId)?.title ?? "",
    [assignments, selectedAssignmentId],
  );
  const selectedQuizTitle = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId)?.title ?? "",
    [quizzes, selectedQuizId],
  );
  const selectedDiscussionTitle = useMemo(
    () => topics.find((t) => t.id === selectedDiscussionId)?.title ?? "",
    [topics, selectedDiscussionId],
  );

  const pickerItems = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const list =
      type === "assignment"
        ? assignments.map((a) => ({ id: a.id, title: a.title }))
        : type === "quiz"
          ? quizzes.map((x) => ({ id: x.id, title: x.title }))
          : topics.map((t) => ({ id: t.id, title: t.title }));
    if (!q) return list;
    return list.filter((it) => it.title.toLowerCase().includes(q));
  }, [type, pickerSearch, assignments, quizzes, topics]);

  const selectPickerItem = (id: string) => {
    if (type === "assignment") setSelectedAssignmentId(id);
    else if (type === "quiz") setSelectedQuizId(id);
    else setSelectedDiscussionId(id);
    setPickerOpen(false);
  };

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

    if (type === "assignment") {
      onSubmit({
        type: "assignment",
        label: label.trim(),
        assignmentId: selectedAssignmentId,
        ownerCourseId: courseId,
        // Requirement intentionally omitted: assignments complete on submission.
      });
      onClose();
      return;
    }

    if (type === "quiz") {
      onSubmit({
        type: "quiz",
        label: label.trim(),
        quizId: selectedQuizId,
        ownerCourseId: courseId,
        // Requirement intentionally omitted: quizzes complete on submission.
      });
      onClose();
      return;
    }

    if (type === "discussion") {
      onSubmit({
        type: "discussion",
        label: label.trim(),
        discussionId: selectedDiscussionId,
        ownerCourseId: courseId,
        requirementType: "must_view",
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
    <>
    <CanvasModal
      title={mode === "add" ? "Add Item" : "Edit Item"}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
          >
            <option value="page">Page</option>
            <option value="assignment">Assignment</option>
            <option value="quiz">Quiz</option>
            <option value="discussion">Discussion</option>
            <option value="file">File</option>
            <option value="link">External URL</option>
            <option value="section">Section Header</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            Name
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
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

        {/* ✅ Requirement (not shown for assignments/quizzes/discussions) */}
        {type !== "section" && type !== "assignment" && type !== "quiz" && type !== "discussion" && (
          <div>
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              Requirement
            </label>
            <select
              value={requirementType}
              onChange={(e) =>
                setRequirementType(e.target.value as ItemRequirementType)
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
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
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
              placeholder="https://example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
        )}

        {/* Assignment picker */}
        {type === "assignment" && (
          <div>
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              Assignment
            </label>
            {!courseId ? (
              <p className="text-xs text-red-600">
                Missing courseId (cannot link assignments).
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    setPickerOpen(true);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                >
                  <span className={selectedAssignmentTitle ? "" : "text-gray-400"}>
                    {selectedAssignmentTitle || "Choose an assignment…"}
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Links to an existing assignment in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* Quiz picker */}
        {type === "quiz" && (
          <div>
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              Quiz
            </label>
            {!courseId ? (
              <p className="text-xs text-red-600">
                Missing courseId (cannot link quizzes).
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    setPickerOpen(true);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                >
                  <span className={selectedQuizTitle ? "" : "text-gray-400"}>
                    {selectedQuizTitle || "Choose a quiz…"}
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Links to an existing quiz in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* Discussion picker */}
        {type === "discussion" && (
          <div>
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              Discussion
            </label>
            {!courseId ? (
              <p className="text-xs text-red-600">
                Missing courseId (cannot link discussions).
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    setPickerOpen(true);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                >
                  <span className={selectedDiscussionTitle ? "" : "text-gray-400"}>
                    {selectedDiscussionTitle || "Choose a discussion…"}
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Links to an existing discussion in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* FILE UI */}
        {type === "file" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-canvas-grayDark">
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
                        ? "border-canvas-blue text-canvas-blue bg-blue-50"
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
                        ? "border-canvas-blue text-canvas-blue bg-blue-50"
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
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
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
                        ? "border-canvas-blue text-canvas-blue bg-blue-50"
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
                        ? "border-canvas-blue text-canvas-blue bg-blue-50"
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
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
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
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-canvas-grayDark bg-white hover:bg-gray-100 transition-all"
            disabled={isWorking}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || isWorking}
            className="px-4 py-2 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isWorking ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </CanvasModal>

    {pickerOpen && (type === "assignment" || type === "quiz" || type === "discussion") && (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
        onClick={() => setPickerOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[70vh] w-[440px] max-w-[92vw] flex-col rounded-lg bg-white shadow-xl"
        >
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-canvas-grayDark">
              {type === "assignment"
                ? "Select an assignment"
                : type === "quiz"
                  ? "Select a quiz"
                  : "Select a discussion"}
            </h3>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={`Search ${type === "assignment" ? "assignments" : type === "quiz" ? "quizzes" : "discussions"}…`}
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-canvas-blue focus:ring-1 focus:ring-canvas-blue"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pickerItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">
                {type === "assignment"
                  ? "No assignments found."
                  : type === "quiz"
                    ? "No quizzes found."
                    : "No discussions found."}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {pickerItems.map((it) => {
                  const active =
                    type === "assignment"
                      ? it.id === selectedAssignmentId
                      : type === "quiz"
                        ? it.id === selectedQuizId
                        : it.id === selectedDiscussionId;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => selectPickerItem(it.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                          active
                            ? "bg-canvas-blueTint text-canvas-blueDark"
                            : "text-canvas-grayDark hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate">{it.title}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-canvas-blue" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex justify-end border-t border-gray-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
