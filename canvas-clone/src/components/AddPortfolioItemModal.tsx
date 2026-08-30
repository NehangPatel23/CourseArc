import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { type IconName } from "../icons/Icon";
import CanvasModal from "./CanvasModal";
import {
  addExternalPortfolioProject,
  addPortfolioEntry,
  PERSONAL_PORTFOLIO_COURSE_ID,
  type PortfolioExternalType,
  type StudentWorkItem,
} from "../utils/ePortfolioStore";
import type { Course } from "../utils/coursesStore";

type Tab = "course" | "external";

type Props = {
  onClose: () => void;
  onFeatured?: () => void;
  initialTab?: Tab;
  subjectId: string;
  courses: Course[];
  catalog: StudentWorkItem[];
  featuredKeys: Set<string>;
};

const COURSE_KIND_META: Record<
  "assignment" | "quiz" | "discussion",
  { label: string; icon: IconName; accent: string }
> = {
  assignment: {
    label: "Assignment",
    icon: "clipboard",
    accent: "bg-arc-copper/10 text-arc-copper border-arc-copper/20",
  },
  quiz: {
    label: "Quiz",
    icon: "help",
    accent: "bg-arc-gold/15 text-arc-ink border-arc-gold/25",
  },
  discussion: {
    label: "Discussion",
    icon: "chat",
    accent: "bg-arc-sage/15 text-arc-sage border-arc-sage/25",
  },
};

const EXTERNAL_TYPES: {
  id: PortfolioExternalType;
  label: string;
  hint: string;
  icon: IconName;
}[] = [
  { id: "github", label: "GitHub", hint: "Repository or gist", icon: "globe" },
  { id: "website", label: "Website", hint: "Live demo or site", icon: "globe" },
  { id: "link", label: "Link", hint: "Any URL", icon: "link" },
  { id: "file", label: "File", hint: "Zip, PDF, etc.", icon: "folder" },
];

function fieldClass(error?: string) {
  return `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-canvas-grayDark outline-none transition placeholder:text-gray-400 ${
    error
      ? "border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100"
      : "border-arc-line focus:border-arc-copper focus:ring-2 focus:ring-arc-copper/20"
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p>;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddPortfolioItemModal({
  onClose,
  onFeatured,
  initialTab = "course",
  subjectId,
  courses,
  catalog,
  featuredKeys,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string | "all">("all");
  const [kindFilter, setKindFilter] = useState<"assignment" | "quiz" | "discussion" | "all">(
    "all",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [coursePickError, setCoursePickError] = useState<string | undefined>();

  const [title, setTitle] = useState("");
  const [extType, setExtType] = useState<PortfolioExternalType>("github");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [courseId, setCourseId] = useState(PERSONAL_PORTFOLIO_COURSE_ID);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    url?: string;
    file?: string;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((w) => {
      const key = `${w.kind}:${w.courseId}:${w.itemId}:${w.submissionId ?? ""}`;
      if (featuredKeys.has(key)) return false;
      if (courseFilter !== "all" && w.courseId !== courseFilter) return false;
      if (kindFilter !== "all" && w.kind !== kindFilter) return false;
      if (q && !w.title.toLowerCase().includes(q) && !w.courseShortName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [catalog, featuredKeys, courseFilter, kindFilter, query]);

  const clearFieldError = (key: keyof typeof errors) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const validateExternal = (): boolean => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Add a title for this project.";
    if (extType === "file") {
      if (!file) next.file = "Choose a file to upload (max 4MB).";
      else if (file.size > 4 * 1024 * 1024) next.file = "File must be under 4MB.";
    } else {
      const trimmed = url.trim();
      if (!trimmed) next.url = "Enter a URL.";
      else {
          try {
            const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            // Validates URL shape
            void new URL(withProto);
            if (extType === "github" && !/github\.com/i.test(withProto)) {
              next.url = "Use a github.com link for GitHub projects.";
            }
          } catch {
            next.url = "Enter a valid URL.";
          }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const acceptFile = (f: File | null) => {
    setFile(f);
    clearFieldError("file");
    if (f && f.size > 4 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: "File must be under 4MB." }));
    }
  };

  const handleFeatureCourse = () => {
    if (!selectedKey) {
      setCoursePickError("Select a submission to feature.");
      return;
    }
    const work = available.find(
      (w) => `${w.kind}:${w.courseId}:${w.itemId}:${w.submissionId ?? ""}` === selectedKey,
    );
    if (!work) {
      setCoursePickError("That submission is no longer available.");
      return;
    }
    addPortfolioEntry(
      {
        courseId: work.courseId,
        kind: work.kind,
        itemId: work.itemId,
        submissionId: work.submissionId,
        title: work.title,
      },
      subjectId,
    );
    onFeatured?.();
    onClose();
  };

  const handleAddExternal = async () => {
    setFormError(null);
    if (!validateExternal()) {
      setFormError("Fix the highlighted fields to continue.");
      return;
    }
    setBusy(true);
    try {
      const result = await addExternalPortfolioProject(
        {
          title,
          externalType: extType,
          url,
          description,
          note,
          courseId,
          file: file ?? undefined,
        },
        subjectId,
      );
      if (!result.ok) {
        if (/title/i.test(result.error)) setErrors({ title: result.error });
        else if (/url/i.test(result.error)) setErrors({ url: result.error });
        else if (/file/i.test(result.error)) setErrors({ file: result.error });
        setFormError(result.error);
        return;
      }
      onFeatured?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <CanvasModal title="Add to ArcFolio" onClose={onClose} size="xl">
      <div className="mb-5 flex gap-1 rounded-xl bg-canvas-grayLight p-1">
        <button
          type="button"
          onClick={() => {
            setTab("course");
            setFormError(null);
            setCoursePickError(undefined);
          }}
          className={`flex-1 px-3 py-2.5 text-sm font-semibold transition ${
            tab === "course"
              ? "bg-arc-ivory text-arc-ink shadow-paper"
              : "text-arc-mute hover:text-arc-ink"
          }`}
        >
          Course work
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("external");
            setFormError(null);
            setCoursePickError(undefined);
          }}
          className={`flex-1 px-3 py-2.5 text-sm font-semibold transition ${
            tab === "external"
              ? "bg-arc-ivory text-arc-ink shadow-paper"
              : "text-arc-mute hover:text-arc-ink"
          }`}
        >
          External project
        </button>
      </div>

      {tab === "course" ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Pick a graded or submitted item from your courses to feature on your showcase.
          </p>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-arc-mute"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search submissions…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-arc-copper focus:ring-2 focus:ring-arc-copper/20"
              />
            </label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-arc-copper focus:ring-2 focus:ring-arc-copper/20"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_name}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as "assignment" | "quiz" | "discussion" | "all")
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-arc-copper focus:ring-2 focus:ring-arc-copper/20"
            >
              <option value="all">All types</option>
              <option value="assignment">Assignments</option>
              <option value="quiz">Quizzes</option>
              <option value="discussion">Discussions</option>
            </select>
          </div>

          <div
            className={`max-h-[min(360px,50vh)] overflow-y-auto rounded-2xl border ${
              coursePickError ? "border-red-300 ring-2 ring-red-100" : "border-gray-200"
            }`}
          >
            {available.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                No matching submissions to feature.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {available.map((work) => {
                  const key = `${work.kind}:${work.courseId}:${work.itemId}:${work.submissionId ?? ""}`;
                  const meta = COURSE_KIND_META[work.kind];
                  const selected = selectedKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKey(key);
                          setCoursePickError(undefined);
                        }}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                          selected ? "bg-arc-copper/15" : "hover:bg-arc-paper"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-arc-copper bg-arc-copper text-white"
                              : "border-arc-line bg-white"
                          }`}
                        >
                          {selected && <Icon name="check" size={12} />}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}
                        >
                          <Icon name={meta.icon} size={12} />
                          {meta.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-canvas-grayDark">
                            {work.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                              style={{ backgroundColor: work.courseColor }}
                            />
                            {work.courseShortName}
                            {work.subtitle ? ` · ${work.subtitle}` : ""}
                            {work.scoreLabel ? ` · ${work.scoreLabel}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <FieldError message={coursePickError} />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-canvas-secondary text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFeatureCourse}
              className="btn-canvas-primary text-sm"
            >
              Feature selected
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add a GitHub repo, website, link, or file to showcase outside course submissions.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-canvas-grayDark">Project type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EXTERNAL_TYPES.map((t) => {
                const on = extType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setExtType(t.id);
                      clearFieldError("url");
                      clearFieldError("file");
                    }}
                    className={`border px-3 py-3 text-left transition ${
                      on
                        ? "border-arc-copper bg-arc-copper/15 ring-2 ring-arc-copper/20"
                        : "border-arc-line hover:border-arc-copper/40 hover:bg-arc-paper"
                    }`}
                  >
                    <Icon
                      name={t.icon}
                      size={16}
                      className={`mb-1.5 ${on ? "text-arc-copper" : "text-arc-mute"}`}
                    />
                    <span className="block text-sm font-semibold text-canvas-grayDark">
                      {t.label}
                    </span>
                    <span className="block text-[11px] text-gray-500">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-canvas-grayDark">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
              }}
              placeholder="My capstone project"
              className={fieldClass(errors.title)}
              aria-invalid={!!errors.title}
            />
            <FieldError message={errors.title} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-canvas-grayDark">
                Course <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={fieldClass()}
              >
                <option value={PERSONAL_PORTFOLIO_COURSE_ID}>Personal / no course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_name} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1" />
          </div>

          {extType === "file" ? (
            <div>
              <p className="mb-1 text-sm font-medium text-canvas-grayDark">
                File <span className="text-red-500">*</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  acceptFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                  errors.file
                    ? "border-red-400 bg-red-50/60"
                    : dragOver
                      ? "border-arc-copper bg-arc-copper/15"
                      : "border-arc-line bg-arc-paper hover:border-arc-copper/50 hover:bg-arc-copper/10"
                }`}
              >
                <span className="mb-2 flex h-11 w-11 items-center justify-center bg-arc-ivory ring-1 ring-arc-ink/10">
                  <Icon name="upload" size={20} className="text-arc-copper" />
                </span>
                {file ? (
                  <>
                    <span className="text-sm font-semibold text-canvas-grayDark">{file.name}</span>
                    <span className="mt-1 text-xs text-gray-500">{formatBytes(file.size)} · click or drop to replace</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-canvas-grayDark">
                      Drop a file here, or click to browse
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      Zip, PDF, docs, images — max 4MB
                    </span>
                  </>
                )}
              </button>
              {file && (
                <button
                  type="button"
                  onClick={() => {
                    acceptFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-canvas-red"
                >
                  <Icon name="close" size={12} />
                  Remove file
                </button>
              )}
              <FieldError message={errors.file} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-canvas-grayDark">
                URL <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Icon
                  name="link"
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-arc-mute"
                />
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    clearFieldError("url");
                  }}
                  placeholder={
                    EXTERNAL_TYPES.find((t) => t.id === extType)?.hint === "Repository or gist"
                      ? "https://github.com/you/repo"
                      : "https://"
                  }
                  className={`${fieldClass(errors.url)} pl-10`}
                  aria-invalid={!!errors.url}
                />
              </div>
              <FieldError message={errors.url} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-canvas-grayDark">
              Short description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project?"
              className={fieldClass()}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-canvas-grayDark">
              Reflection note <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What did you learn or want to highlight?"
              className={`${fieldClass()} resize-none`}
            />
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-canvas-secondary text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAddExternal()}
              className="btn-canvas-primary text-sm disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add project"}
            </button>
          </div>
        </div>
      )}
    </CanvasModal>
  );
}
