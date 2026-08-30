import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import AppEmptyState from "../components/AppEmptyState";
import AddPortfolioItemModal from "../components/AddPortfolioItemModal";
import {
  ArcFolioCardPreview,
  ArcFolioPreviewModal,
} from "../components/ArcFolioArtifactPreview";
import PageIdentityHeader from "../components/PageIdentityHeader";
import StudentViewBanner from "../components/StudentViewBanner";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../components/ui/Toast";
import {
  EPORTFOLIO_CHANGED_EVENT,
  exportPortfolioJson,
  listStudentWork,
  loadPortfolioDoc,
  movePortfolioEntry,
  PERSONAL_PORTFOLIO_COURSE_ID,
  portfolioStudentHasContent,
  removePortfolioEntry,
  resolveEntryMeta,
  updatePortfolioEntry,
  updatePortfolioProfile,
  type PortfolioDoc,
  type PortfolioEntry,
  type PortfolioExternalType,
  type PortfolioWorkKind,
  type StudentWorkItem,
} from "../utils/ePortfolioStore";
import { loadCourses } from "../utils/coursesStore";
import { getRosterMemberName, loadRoster, type RosterMember } from "../utils/courseRoster";
import { useStudentView } from "../utils/studentView";
import { useUser } from "../hooks/useUser";
import { ensureDemoRoster } from "../utils/demoPersona";

const KIND_META: Record<PortfolioWorkKind, { label: string; icon: IconName; accent: string }> = {
  assignment: { label: "Assignment", icon: "clipboard", accent: "bg-arc-copper/10 text-arc-copper" },
  quiz: { label: "Quiz", icon: "help", accent: "bg-arc-gold/15 text-arc-ink" },
  discussion: { label: "Discussion", icon: "chat", accent: "bg-arc-sage/15 text-arc-sage" },
  external: { label: "Project", icon: "briefcase", accent: "bg-arc-copper-tint text-arc-copper-dark" },
};

const EXTERNAL_TYPE_META: Record<PortfolioExternalType, { label: string; icon: IconName; placeholder: string }> = {
  github: { label: "GitHub", icon: "globe", placeholder: "https://github.com/you/repo" },
  website: { label: "Website", icon: "globe", placeholder: "https://yoursite.com" },
  link: { label: "Link", icon: "link", placeholder: "https://…" },
  file: { label: "File / zip", icon: "folder", placeholder: "" },
};

function formatSubmitted(ts?: number) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExternalTypeIcon({ type }: { type?: PortfolioExternalType }) {
  const meta = type ? EXTERNAL_TYPE_META[type] : EXTERNAL_TYPE_META.link;
  return <Icon name={meta.icon} size={12} />;
}

export default function PortfolioPage() {
  const user = useUser();
  const { studentView } = useStudentView();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const courses = useMemo(
    () => loadCourses().filter((c) => !c.archived && c.published),
    [user.id],
  );
  const courseById = useMemo(() => new Map(loadCourses().map((c) => [c.id, c])), [user.id]);

  const paramCourseId = searchParams.get("courseId") ?? "";
  const paramStudentId = searchParams.get("studentId") ?? "";

  const [browseCourseId, setBrowseCourseId] = useState(paramCourseId);
  const [browseStudentId, setBrowseStudentId] = useState(paramStudentId);

  const viewingOther =
    !studentView && !!browseCourseId && !!browseStudentId;
  const subjectId = viewingOther ? browseStudentId : user.id;

  const [doc, setDoc] = useState<PortfolioDoc>(() => loadPortfolioDoc(subjectId));
  const [catalog, setCatalog] = useState<StudentWorkItem[]>(() => listStudentWork(subjectId));
  const [addModalTab, setAddModalTab] = useState<"course" | "external" | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [skillsDraft, setSkillsDraft] = useState("");

  const [featuredCourseFilter, setFeaturedCourseFilter] = useState<string | "all">("all");
  const [featuredKindFilter, setFeaturedKindFilter] = useState<PortfolioWorkKind | "all">("all");
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);

  const roster = useMemo((): RosterMember[] => {
    if (!browseCourseId) return [];
    ensureDemoRoster(browseCourseId);
    return loadRoster(browseCourseId).filter((m) => m.role === "student");
  }, [browseCourseId, user.id]);

  const subjectName = viewingOther
    ? getRosterMemberName(browseCourseId, browseStudentId) || "Student"
    : user.name;

  useEffect(() => {
    setBrowseCourseId(paramCourseId);
    setBrowseStudentId(paramStudentId);
  }, [paramCourseId, paramStudentId]);

  useEffect(() => {
    const refresh = () => {
      setDoc(loadPortfolioDoc(subjectId));
      setCatalog(listStudentWork(subjectId));
    };
    refresh();
    window.addEventListener(EPORTFOLIO_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EPORTFOLIO_CHANGED_EVENT, refresh);
  }, [subjectId]);

  const canEdit = studentView && !previewMode && !viewingOther;
  const entries = doc.entries;

  const featuredKeys = useMemo(() => {
    return new Set(
      entries.map(
        (e) => `${e.kind}:${e.courseId}:${e.itemId}:${e.submissionId ?? ""}`,
      ),
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (featuredCourseFilter !== "all" && e.courseId !== featuredCourseFilter) return false;
      if (featuredKindFilter !== "all" && e.kind !== featuredKindFilter) return false;
      return true;
    });
  }, [entries, featuredCourseFilter, featuredKindFilter]);

  const selectBrowse = (courseId: string, studentId: string) => {
    setBrowseCourseId(courseId);
    setBrowseStudentId(studentId);
    const next = new URLSearchParams();
    if (courseId) next.set("courseId", courseId);
    if (studentId) next.set("studentId", studentId);
    setSearchParams(next, { replace: true });
  };

  const startEditNote = (entry: PortfolioEntry) => {
    setEditingNoteId(entry.id);
    setNoteDraft(entry.note ?? "");
  };

  const saveNote = () => {
    if (!editingNoteId) return;
    updatePortfolioEntry(editingNoteId, { note: noteDraft }, subjectId);
    setEditingNoteId(null);
    setNoteDraft("");
  };

  const startEditProfile = () => {
    setHeadlineDraft(doc.headline ?? "");
    setBioDraft(doc.bio ?? "");
    setSkillsDraft((doc.skills ?? []).join(", "));
    setEditingProfile(true);
  };

  const saveProfile = () => {
    const skills = skillsDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updatePortfolioProfile(
      { headline: headlineDraft, bio: bioDraft, skills },
      subjectId,
    );
    setEditingProfile(false);
    showToast("ArcFolio profile saved", "positive");
  };

  const handleExport = () => {
    const json = exportPortfolioJson(subjectId, {
      id: subjectId,
      name: subjectName,
    });
    const safeName = subjectName.replace(/[^\w.-]+/g, "_").slice(0, 40) || "arcfolio";
    downloadJson(`${safeName}-arcfolio.json`, json);
    showToast("ArcFolio exported", "positive");
  };

  const previewEntry = previewEntryId
    ? entries.find((e) => e.id === previewEntryId) ?? null
    : null;

  // ——— Instructor browser (no student selected yet) ———
  if (!studentView && !viewingOther) {
    return (
      <div className="w-full">
        <StudentViewBanner label="Browsing student ArcFolios" />
        <div className="px-8 py-10 lg:px-12">
        <p className="kicker mb-6 text-arc-mute">Instructor desk — browse student ArcFolios by course</p>

        <PageIdentityHeader
          className="mb-8"
          icon="briefcase"
          label="ArcFolio"
          title="Student ArcFolios"
          description={
            <>
              Choose a course, then a student, to view their showcase. You can also open an ArcFolio
              from{" "}
              <Link to={browseCourseId ? `/courses/${browseCourseId}/people` : "/courses"} className="text-arc-copper hover:underline">
                People
              </Link>{" "}
              by clicking a student’s name.
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bg-arc-ivory p-5 ring-1 ring-arc-line/80">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-arc-mute">
              1. Select course
            </h2>
            <div className="space-y-2">
              {courses.length === 0 ? (
                <p className="text-sm text-arc-mute">No published courses.</p>
              ) : (
                courses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectBrowse(c.id, "")}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      browseCourseId === c.id
                        ? "border-arc-copper bg-arc-copper/15"
                        : "border-arc-line hover:border-arc-copper/40"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-arc-ink">
                        {c.short_name}
                      </span>
                      <span className="block truncate text-xs text-arc-mute">{c.title}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="bg-arc-ivory p-5 ring-1 ring-arc-line/80">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-arc-mute">
              2. Select student
            </h2>
            {!browseCourseId ? (
              <p className="text-sm text-arc-mute">Select a course first.</p>
            ) : roster.length === 0 ? (
              <p className="text-sm text-arc-mute">No students on this roster.</p>
            ) : (
              <ul className="divide-y divide-arc-line">
                {roster.map((m) => {
                  const hasContent = portfolioStudentHasContent(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectBrowse(browseCourseId, m.id)}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-arc-paper"
                      >
                        <span>
                          <span className="block text-sm font-medium text-arc-ink">
                            {m.name}
                          </span>
                          {m.email && (
                            <span className="block text-xs text-arc-mute">{m.email}</span>
                          )}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            hasContent
                              ? "bg-arc-sage/15 text-arc-sage"
                              : "bg-arc-paper text-arc-mute"
                          }`}
                        >
                          {hasContent ? "Has ArcFolio" : "Empty"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {viewingOther && (
        <StudentViewBanner
          label={`Viewing ${subjectName}${
            browseCourseId && courseById.get(browseCourseId)
              ? ` · ${courseById.get(browseCourseId)!.short_name}`
              : ""
          }`}
        />
      )}
      <div className="px-8 py-10 lg:px-12">
      {viewingOther && (
        <div className="mb-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => selectBrowse(browseCourseId, "")}
            className="text-sm text-arc-copper hover:underline"
          >
            ← Change student
          </button>
          <Link
            to={`/courses/${browseCourseId}/people`}
            className="text-sm text-arc-copper hover:underline"
          >
            People
          </Link>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <PageIdentityHeader
          className="min-w-0 flex-1"
          icon="briefcase"
          label="ArcFolio"
          title={subjectName}
          leading={
            !viewingOther ? (
              <UserAvatar
                name={user.name}
                initials={user.avatarInitials}
                color={user.avatarColor}
                imageUrl={user.avatarImage}
                doodleId={user.avatarDoodle}
                size="lg"
                ring
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-arc-copper/15 text-lg font-semibold text-arc-copper">
                {subjectName
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )
          }
          badge={
            (previewMode || viewingOther) && (
              <span className="rounded-full bg-arc-copper/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-arc-copper">
                {viewingOther ? "Student showcase" : "Preview"}
              </span>
            )
          }
          description={
            <>
              {editingProfile && canEdit ? (
                <div className="mt-1 max-w-xl space-y-3">
                  <label className="block text-sm">
                    <span className="text-arc-mute">Headline</span>
                    <input
                      value={headlineDraft}
                      onChange={(e) => setHeadlineDraft(e.target.value)}
                      maxLength={120}
                      placeholder="e.g. Algorithms · Spring ArcFolio"
                      className="form-input mt-1 w-full text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-arc-mute">About</span>
                    <textarea
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="A short reflection on your work…"
                      className="form-input mt-1 w-full text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-arc-mute">Skills / tags</span>
                    <input
                      value={skillsDraft}
                      onChange={(e) => setSkillsDraft(e.target.value)}
                      placeholder="React, Python, Systems — comma separated"
                      className="form-input mt-1 w-full text-sm"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveProfile} className="btn-canvas-primary text-sm">
                      Save profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="btn-canvas-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-xl">
                  {doc.headline ? (
                    <p className="text-base font-medium text-arc-ink">{doc.headline}</p>
                  ) : (
                    canEdit && <p className="text-sm italic text-arc-mute">No headline yet</p>
                  )}
                  {doc.bio ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-arc-mute">{doc.bio}</p>
                  ) : (
                    canEdit && (
                      <p className="mt-1 text-sm text-arc-mute">
                        Feature course work and external projects (GitHub, sites, zip files).
                      </p>
                    )
                  )}
                  {(doc.skills?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {doc.skills!.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-arc-paper px-2.5 py-0.5 text-xs font-medium text-gray-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={startEditProfile}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-arc-copper hover:underline"
                    >
                      <Icon name="pencil" size={12} />
                      Edit profile
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-arc-mute">
                <span className="rounded-full bg-arc-paper px-2.5 py-1 font-medium text-gray-700">
                  {entries.length} featured
                </span>
                <span className="rounded-full bg-arc-paper px-2.5 py-1 font-medium text-gray-700">
                  {entries.filter((e) => e.kind === "external").length} external
                </span>
                {!viewingOther && (
                  <span className="rounded-full bg-arc-paper px-2.5 py-1 font-medium text-gray-700">
                    {catalog.length} course submissions
                  </span>
                )}
              </div>
            </>
          }
        />

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
          {canEdit && (
            <button
              type="button"
              onClick={() => setAddModalTab("course")}
              className="btn-canvas-primary inline-flex items-center justify-center gap-1.5 text-sm"
            >
              <Icon name="plus" size={16} />
              Add to ArcFolio
            </button>
          )}
          {!viewingOther && studentView && (
            <button
              type="button"
              onClick={() => setPreviewMode((v) => !v)}
              className="btn-canvas-secondary inline-flex items-center justify-center gap-1.5 text-sm"
            >
              <Icon name="eye" size={16} />
              {previewMode ? "Exit preview" : "Preview showcase"}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="btn-canvas-secondary inline-flex items-center justify-center gap-1.5 text-sm"
          >
            <Icon name="download" size={16} />
            Export JSON
          </button>
          <a
            href={`/portfolio/${encodeURIComponent(subjectId)}/public`}
            className="btn-canvas-secondary inline-flex items-center justify-center gap-1.5 text-sm"
          >
            <Icon name="link" size={16} />
            Public share
          </a>
        </div>
      </div>

      {addModalTab && canEdit && (
        <AddPortfolioItemModal
          initialTab={addModalTab}
          onClose={() => setAddModalTab(null)}
          onFeatured={() => showToast("Added to ArcFolio", "positive")}
          subjectId={subjectId}
          courses={courses}
          catalog={catalog}
          featuredKeys={featuredKeys}
        />
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-arc-ink">Featured work</h2>
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select
                value={featuredCourseFilter}
                onChange={(e) => setFeaturedCourseFilter(e.target.value)}
                className="form-input text-sm"
              >
                <option value="all">All courses</option>
                <option value={PERSONAL_PORTFOLIO_COURSE_ID}>Personal projects</option>
                {courses
                  .filter((c) => entries.some((e) => e.courseId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}
                    </option>
                  ))}
              </select>
              <select
                value={featuredKindFilter}
                onChange={(e) =>
                  setFeaturedKindFilter(e.target.value as PortfolioWorkKind | "all")
                }
                className="form-input text-sm"
              >
                <option value="all">All types</option>
                <option value="assignment">Assignments</option>
                <option value="quiz">Quizzes</option>
                <option value="discussion">Discussions</option>
                <option value="external">External projects</option>
              </select>
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <AppEmptyState
            variant="list"
            studio={viewingOther ? "student" : studentView ? "student" : "instructor"}
            title="No featured work yet"
            subtitle={
              viewingOther
                ? "This student hasn’t featured any work."
                : "Add course submissions or external projects (GitHub, websites, files)."
            }
          />
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-arc-mute">No featured items match these filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEntries.map((entry) => {
              const meta = KIND_META[entry.kind];
              const course =
                entry.courseId !== PERSONAL_PORTFOLIO_COURSE_ID
                  ? courseById.get(entry.courseId)
                  : undefined;
              const workMeta = resolveEntryMeta(entry, catalog, subjectId);
              const orderIndex = entries.findIndex((e) => e.id === entry.id);
              const canMoveUp = canEdit && orderIndex > 0;
              const canMoveDown = canEdit && orderIndex >= 0 && orderIndex < entries.length - 1;

              return (
                <article
                  key={entry.id}
                  className="relative flex flex-col bg-arc-ivory p-5 ring-1 ring-arc-ink/10 hover:shadow-lift"
                >
                  <span className="absolute right-4 top-4 font-display text-xs tracking-[0.18em] text-arc-mute">
                    {String(orderIndex + 1).padStart(2, "0")}
                  </span>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}
                    >
                      {entry.kind === "external" ? (
                        <ExternalTypeIcon type={entry.externalType} />
                      ) : (
                        <Icon name={meta.icon} size={12} />
                      )}
                      {entry.kind === "external"
                        ? EXTERNAL_TYPE_META[entry.externalType ?? "link"].label
                        : meta.label}
                    </span>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={!canMoveUp}
                          onClick={() => movePortfolioEntry(entry.id, -1, subjectId)}
                          className="rounded p-1 text-arc-mute hover:bg-arc-paper disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <Icon name="chevronUp" size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveDown}
                          onClick={() => movePortfolioEntry(entry.id, 1, subjectId)}
                          className="rounded p-1 text-arc-mute hover:bg-arc-paper disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <Icon name="chevronDown" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removePortfolioEntry(entry.id, subjectId);
                            showToast("Removed from ArcFolio", "neutral");
                          }}
                          className="rounded p-1 text-arc-mute hover:bg-red-50 hover:text-arc-brick"
                          aria-label="Remove"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <ArcFolioCardPreview
                    entry={entry}
                    studentId={subjectId}
                    onOpenPreview={() => setPreviewEntryId(entry.id)}
                  />

                  <button
                    type="button"
                    onClick={() => setPreviewEntryId(entry.id)}
                    className="text-left text-base font-semibold text-arc-ink hover:text-arc-copper"
                  >
                    {entry.title}
                    {entry.kind === "external" && entry.externalType !== "file" && (
                      <Icon name="arrowUpRight" size={12} className="ml-1 inline align-text-top opacity-60" />
                    )}
                  </button>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-arc-mute">
                    {course ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: course.color }}
                        />
                        {course.short_name}
                      </span>
                    ) : entry.kind === "external" ? (
                      <span>Personal project</span>
                    ) : null}
                    {workMeta.submittedAt && (
                      <span>
                        {entry.kind === "external" ? "Added" : "Submitted"}{" "}
                        {formatSubmitted(workMeta.submittedAt)}
                      </span>
                    )}
                    {workMeta.scoreLabel && (
                      <span className="rounded-full bg-arc-copper/15 px-1.5 py-0.5 font-semibold tabular-nums text-arc-copper">
                        {workMeta.scoreLabel}
                      </span>
                    )}
                  </p>
                  {workMeta.subtitle && (
                    <p className="mt-1 text-xs text-arc-mute">{workMeta.subtitle}</p>
                  )}

                  {editingNoteId === entry.id && canEdit ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={3}
                        className="form-input w-full text-sm"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveNote} className="btn-canvas-primary text-xs">
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="btn-canvas-secondary text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex-1">
                      {entry.note ? (
                        <p className="whitespace-pre-wrap text-sm text-arc-mute">{entry.note}</p>
                      ) : (
                        canEdit && <p className="text-sm italic text-arc-mute">No note yet</p>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEditNote(entry)}
                          className="mt-2 text-xs text-arc-copper hover:underline"
                        >
                          {entry.note ? "Edit note" : "Add note"}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {previewEntry && (
        <ArcFolioPreviewModal
          entry={previewEntry}
          studentId={subjectId}
          onClose={() => setPreviewEntryId(null)}
        />
      )}
    </div>
    </div>
  );
}
