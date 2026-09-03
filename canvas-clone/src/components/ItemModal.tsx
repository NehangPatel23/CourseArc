import { useEffect, useMemo, useRef, useState } from "react";
import CanvasModal from "./CanvasModal";
import Icon from "../icons/Icon";
import DateTimeField from "./DateTimeField";
import {
  addFileToCourse,
  loadFilesMeta,
  type StoredFileMeta,
} from "../utils/files";
import { loadAssignments, type Assignment } from "../utils/assignments";
import { loadQuizzes, type Quiz } from "../utils/quizzes";
import { loadTopics, type DiscussionTopic } from "../utils/discussions";
import { loadSections } from "../utils/courseSections";
import { slugifyLabel } from "../utils/modules";
import { loadCoursePagesIndex, type PageIndexEntry } from "../utils/pageStorage";

type ItemType = "page" | "file" | "link" | "section" | "assignment" | "quiz" | "discussion";
type ItemRequirementType = "must_view" | "must_mark_done";

export type ItemModalValue = {
  type: ItemType;
  label: string;
  url?: string;

  fileId?: string;
  fileName?: string;

  pageId?: string;
  assignmentId?: string;
  quizId?: string;
  discussionId?: string;
  /** Course that owns the linked assignment/quiz/discussion. */
  ownerCourseId?: string;

  // ✅ NEW
  requirementType?: ItemRequirementType;
  assignedSectionIds?: string[];
  unlockAt?: string;
};

type Props = {
  mode: "add" | "edit";
  initialValues?: {
    type: ItemType;
    label: string;
    url?: string;
    fileId?: string;
    fileName?: string;
    pageId?: string;
    assignmentId?: string;
    quizId?: string;
    discussionId?: string;

    // ✅ NEW
    requirementType?: ItemRequirementType;
    assignedSectionIds?: string[];
    unlockAt?: string;
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
  const [assignedSectionIds, setAssignedSectionIds] = useState<string[]>(
    initialValues?.assignedSectionIds ?? [],
  );
  const [unlockAt, setUnlockAt] = useState<number | undefined>(() => {
    const raw = initialValues?.unlockAt;
    if (!raw) return undefined;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? undefined : t;
  });

  // File flows
  const [fileAddMode, setFileAddMode] = useState<FileAddMode>("upload");
  const [fileEditMode, setFileEditMode] = useState<FileEditMode>("replace");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFiles, setExistingFiles] = useState<StoredFileMeta[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<string>(
    initialValues?.fileId ?? "",
  );

  // Page / assignment / quiz / discussion linking
  const [pages, setPages] = useState<PageIndexEntry[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>(
    initialValues?.pageId ?? "",
  );
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
    setSelectedExistingId((current) => {
      if (current && list.some((f) => f.id === current)) return current;
      const fromItem = initialValues?.fileId;
      if (fromItem && list.some((f) => f.id === fromItem)) return fromItem;
      // Add (or edit with no linked file): default the existing-file picker.
      if (list.length > 0 && !fromItem) return list[0].id;
      return current;
    });
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

  useEffect(() => {
    if (type !== "page" || !courseId) {
      setPages([]);
      return;
    }
    setPages(loadCoursePagesIndex(courseId));
  }, [type, courseId]);

  // Load assignments / quizzes for linking
  useEffect(() => {
    if (type !== "assignment" || !courseId) return;
    const list = loadAssignments(courseId);
    setAssignments(list);
    if (!selectedAssignmentId && mode === "add" && list.length > 0) {
      setSelectedAssignmentId(list[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  useEffect(() => {
    if (type !== "quiz" || !courseId) return;
    const list = loadQuizzes(courseId);
    setQuizzes(list);
    if (!selectedQuizId && mode === "add" && list.length > 0) setSelectedQuizId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  useEffect(() => {
    if (type !== "discussion" || !courseId) return;
    const list = loadTopics(courseId);
    setTopics(list);
    if (!selectedDiscussionId && mode === "add" && list.length > 0) {
      setSelectedDiscussionId(list[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, courseId]);

  useEffect(() => {
    if (type !== "page" || mode !== "add") return;
    const p = pages.find((x) => x.id === selectedPageId);
    if (p && !label.trim()) setLabel(p.title);
  }, [type, mode, selectedPageId, pages, label]);

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

    if (type === "page") return true;
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
    selectedPageId,
    fileAddMode,
    fileEditMode,
  ]);

  const selectedPageTitle = useMemo(() => {
    const p = pages.find((x) => x.id === selectedPageId);
    if (p?.title) return p.title;
    if (selectedPageId && mode === "edit") return label.trim() || "Current page";
    return "";
  }, [pages, selectedPageId, mode, label]);
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
      type === "page"
        ? pages.map((p) => ({ id: p.id, title: p.title || p.id }))
        : type === "assignment"
          ? assignments.map((a) => ({ id: a.id, title: a.title }))
          : type === "quiz"
            ? quizzes.map((x) => ({ id: x.id, title: x.title }))
            : topics.map((t) => ({ id: t.id, title: t.title }));
    if (!q) return list;
    return list.filter((it) => it.title.toLowerCase().includes(q));
  }, [type, pickerSearch, pages, assignments, quizzes, topics]);

  const selectPickerItem = (id: string) => {
    if (type === "page") setSelectedPageId(id);
    else if (type === "assignment") setSelectedAssignmentId(id);
    else if (type === "quiz") setSelectedQuizId(id);
    else setSelectedDiscussionId(id);
    setPickerOpen(false);
  };

  const pickerOpenFor =
    type === "page" || type === "assignment" || type === "quiz" || type === "discussion";
  const pickerNoun =
    type === "page"
      ? "page"
      : type === "assignment"
        ? "assignment"
        : type === "quiz"
          ? "quiz"
          : "discussion";

  const submit = async () => {
    if (!canSubmit) return;
    const sectionAssign = assignedSectionIds.length ? assignedSectionIds : undefined;
    const unlockIso =
      type !== "section" && typeof unlockAt === "number"
        ? new Date(unlockAt).toISOString()
        : undefined;
    const emit = (item: ItemModalValue) => {
      onSubmit({
        ...item,
        assignedSectionIds: item.assignedSectionIds ?? sectionAssign,
        unlockAt: unlockIso,
      });
      onClose();
    };

    // Section headers (module-only visual grouping)
    if (type === "section") {
      emit({
        type: "section",
        label: label.trim(),
        assignedSectionIds: sectionAssign,
      });
      return;
    }

    if (type === "page") {
      emit({
        type: "page",
        label: label.trim(),
        pageId: selectedPageId || initialValues?.pageId || slugifyLabel(label.trim()),
        requirementType,
        assignedSectionIds: sectionAssign,
      });
      return;
    }

    if (type === "assignment") {
      emit({
        type: "assignment",
        label: label.trim(),
        assignmentId: selectedAssignmentId,
        ownerCourseId: courseId,
        assignedSectionIds: sectionAssign,
      });
      return;
    }

    if (type === "quiz") {
      emit({
        type: "quiz",
        label: label.trim(),
        quizId: selectedQuizId,
        ownerCourseId: courseId,
        assignedSectionIds: sectionAssign,
      });
      return;
    }

    if (type === "discussion") {
      emit({
        type: "discussion",
        label: label.trim(),
        discussionId: selectedDiscussionId,
        ownerCourseId: courseId,
        requirementType: "must_view",
        assignedSectionIds: sectionAssign,
      });
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

            emit({
              type: "file",
              label: label.trim(), // ✅ keep display name
              fileId: meta.id,
              fileName: meta.name, // ✅ store actual file name
              requirementType,
            });

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

          emit({
            type: "file",
            label: meta.name,
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });
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

          emit({
            type: "file",
            label: label.trim(), // ✅ keep display name
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });

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

          emit({
            type: "file",
            label: label.trim(), // ✅ keep display name
            fileId: meta.id,
            fileName: meta.name,
            requirementType,
          });
          return;
        }

        // Label-only edit (no replacement selected)
        emit({
          type: "file",
          label: label.trim(),
          fileId: currentId,
          fileName: currentName,
          requirementType,
        });
        return;
      } finally {
        setIsWorking(false);
      }
    }

    // Non-file types
    emit({
      type,
      label: label.trim(),
      url: type === "link" ? url.trim() : undefined,
      requirementType,
    });
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
          <label className="mb-1 block text-sm font-medium text-arc-ink">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="form-input"
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
          <label className="mb-1 block text-sm font-medium text-arc-ink">
            Name
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="form-input"
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

        {/* Assign to sections */}
        {type !== "section" && courseId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
              Assign to sections
            </label>
            <p className="mb-2 text-xs text-arc-mute">Leave unchecked to show for every section.</p>
            <div className="flex flex-wrap gap-2">
              {loadSections(courseId).map((s) => {
                const on = assignedSectionIds.includes(s.id);
                return (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setAssignedSectionIds((prev) =>
                          on ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                        )
                      }
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {type !== "section" && (
          <DateTimeField
            label="Unlock at (optional)"
            value={unlockAt}
            onChange={setUnlockAt}
            description="Students cannot open this item until this time."
          />
        )}

        {/* ✅ Requirement (not shown for assignments/quizzes/discussions) */}
        {type !== "section" && type !== "assignment" && type !== "quiz" && type !== "discussion" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
              Requirement
            </label>
            <select
              value={requirementType}
              onChange={(e) =>
                setRequirementType(e.target.value as ItemRequirementType)
              }
              className="form-input"
            >
              <option value="must_mark_done">Must mark as done</option>
              <option value="must_view">
                Must view (auto-complete on view)
              </option>
            </select>
            <p className="mt-1 text-xs text-arc-mute">
              “Must view” will automatically mark the item complete when opened.
            </p>
          </div>
        )}

        {/* Link URL */}
        {type === "link" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="form-input"
              placeholder="https://example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
        )}

        {/* Page picker */}
        {type === "page" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
              Page
            </label>
            {!courseId ? (
              <p className="text-xs text-red-600">
                Missing courseId (cannot link pages).
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    setPickerOpen(true);
                  }}
                  className="form-input flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className={selectedPageTitle ? "" : "text-arc-mute"}>
                    {selectedPageTitle ||
                      (mode === "add"
                        ? "Create a new page from the name above"
                        : "Current page")}
                  </span>
                  <Icon name="search" size={16} className="text-arc-mute" />
                </button>
                <p className="mt-1 text-xs text-arc-mute">
                  {mode === "add"
                    ? "Pick an existing page, or leave this blank to create a new one from the name."
                    : "Links this item to a page in this course."}
                </p>
              </>
            )}
          </div>
        )}

        {/* Assignment picker */}
        {type === "assignment" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
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
                  className="form-input flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className={selectedAssignmentTitle ? "" : "text-arc-mute"}>
                    {selectedAssignmentTitle || "Choose an assignment…"}
                  </span>
                  <Icon name="search" size={16} className="text-arc-mute" />
                </button>
                <p className="mt-1 text-xs text-arc-mute">
                  Links to an existing assignment in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* Quiz picker */}
        {type === "quiz" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
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
                  className="form-input flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className={selectedQuizTitle ? "" : "text-arc-mute"}>
                    {selectedQuizTitle || "Choose a quiz…"}
                  </span>
                  <Icon name="search" size={16} className="text-arc-mute" />
                </button>
                <p className="mt-1 text-xs text-arc-mute">
                  Links to an existing quiz in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* Discussion picker */}
        {type === "discussion" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-arc-ink">
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
                  className="form-input flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className={selectedDiscussionTitle ? "" : "text-arc-mute"}>
                    {selectedDiscussionTitle || "Choose a discussion…"}
                  </span>
                  <Icon name="search" size={16} className="text-arc-mute" />
                </button>
                <p className="mt-1 text-xs text-arc-mute">
                  Links to an existing discussion in this course.
                </p>
              </>
            )}
          </div>
        )}

        {/* FILE UI */}
        {type === "file" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-arc-ink">
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
                        ? "border-arc-copper text-arc-copper bg-arc-copper/10"
                        : "border-arc-ink/15 text-arc-ink bg-arc-ivory"
                    }`}
                  >
                    Upload new
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileAddMode("existing")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileAddMode === "existing"
                        ? "border-arc-copper text-arc-copper bg-arc-copper/10"
                        : "border-arc-ink/15 text-arc-ink bg-arc-ivory"
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
                      className="btn-canvas-secondary"
                    >
                      Choose file
                    </button>
                    <div className="min-w-0 truncate text-sm text-arc-mute">
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
                      className="form-input"
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
                    <p className="text-xs text-arc-mute">
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
                        ? "border-arc-copper text-arc-copper bg-arc-copper/10"
                        : "border-arc-ink/15 text-arc-ink bg-arc-ivory"
                    }`}
                  >
                    Replace upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileEditMode("switch")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      fileEditMode === "switch"
                        ? "border-arc-copper text-arc-copper bg-arc-copper/10"
                        : "border-arc-ink/15 text-arc-ink bg-arc-ivory"
                    }`}
                  >
                    Switch to existing
                  </button>
                </div>

                {fileEditMode === "replace" ? (
                  <div className="space-y-1">
                    <div className="text-xs text-arc-mute">
                      Current: {initialValues?.fileName ?? "File"}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-canvas-secondary"
                      >
                        Choose replacement
                      </button>
                      <div className="min-w-0 truncate text-sm text-arc-mute">
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
                    <p className="text-xs text-arc-mute">
                      Replacing here uploads a NEW file and updates only this
                      module item to point to it. The old file stays in Files.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                      className="form-input"
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
                    <p className="text-xs text-arc-mute">
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
            className="btn-canvas-secondary"
            disabled={isWorking}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || isWorking}
            className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWorking ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </CanvasModal>

    {pickerOpen && pickerOpenFor && (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-arc-moss/45 p-4"
        onClick={() => setPickerOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="paper-grain flex max-h-[70vh] w-[440px] max-w-[92vw] flex-col bg-arc-paper shadow-lift ring-1 ring-arc-ink/10"
        >
          <div className="border-b border-arc-ink/10 px-4 py-3">
            <h3 className="font-display text-sm font-medium text-arc-ink">
              Select a {pickerNoun}
            </h3>
            <div className="relative mt-2">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-arc-mute" />
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={`Search ${pickerNoun}s…`}
                className="form-input py-2 pl-9 pr-3"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pickerItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-arc-mute">
                No {pickerNoun}s found.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {pickerItems.map((it) => {
                  const active =
                    type === "page"
                      ? it.id === selectedPageId
                      : type === "assignment"
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
                            ? "bg-arc-copper/10 text-arc-copper"
                            : "text-arc-ink hover:bg-arc-paper"
                        }`}
                      >
                        <span className="truncate">{it.title}</span>
                        {active && <Icon name="check" size={16} className="shrink-0 text-arc-copper" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex justify-end border-t border-arc-ink/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="btn-canvas-secondary"
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
