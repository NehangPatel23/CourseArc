import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ClipboardList,
  Copy,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import GradeIconLink from "../components/GradeIconLink";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { htmlPreview } from "../utils/htmlPreview";
import {
  autoPublishAssignment,
  duplicateAssignment,
  formatAssignmentDueDate,
  formatAvailabilityColumn,
  isAssignmentClosedToStudents,
  isAssignmentNotYetAvailable,
  isStudentViewableAssignment,
  loadAssignments,
  saveAssignments,
  type Assignment,
} from "../utils/assignments";
import { getPendingSubmissionsForCourse } from "../utils/assignmentSubmissions";
import { getPendingAssignmentCount } from "../utils/gradingCounts";

type SortKey = "due" | "title" | "points";
type FilterKey = "all" | "published" | "draft";

const GRID_STUDENT =
  "grid-cols-[minmax(0,1fr)_minmax(0,160px)_minmax(0,200px)_90px]";
const GRID_INSTRUCTOR =
  "grid-cols-[minmax(0,1fr)_minmax(0,160px)_minmax(0,200px)_90px_100px_minmax(140px,auto)]";

export default function AssignmentsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const { showToast } = useToast();

  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    loadAssignments(effectiveCourseId).map(autoPublishAssignment),
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [, setGradeRefresh] = useState(0);

  useEffect(() => {
    const bump = () => setGradeRefresh((n) => n + 1);
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", bump);
    return () => window.removeEventListener("canvasClone:assignmentSubmissionsChanged", bump);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const all = loadAssignments(effectiveCourseId).map(autoPublishAssignment);
      const raw = loadAssignments(effectiveCourseId);
      if (all.some((a, i) => a.status !== raw[i]?.status)) {
        saveAssignments(effectiveCourseId, all);
      }
      setAssignments(all);
    };
    refresh();
    window.addEventListener("canvasClone:assignmentsChanged", refresh);
    return () => window.removeEventListener("canvasClone:assignmentsChanged", refresh);
  }, [effectiveCourseId]);

  const pendingCount = getPendingSubmissionsForCourse(effectiveCourseId).length;

  const filtered = useMemo(() => {
    let list = studentView
      ? assignments.filter(isStudentViewableAssignment)
      : assignments;

    if (!studentView && filter === "published") {
      list = list.filter((a) => a.status === "published" || a.published);
    } else if (!studentView && filter === "draft") {
      list = list.filter((a) => a.status === "draft" || !a.published);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          htmlPreview(a.description).text.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "points") return (b.points ?? 0) - (a.points ?? 0);
      return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    });
  }, [assignments, studentView, search, sort, filter]);

  const published = studentView
    ? filtered
    : filtered.filter((a) => a.status === "published" || a.published);
  const drafts = studentView ? [] : filtered.filter((a) => a.status === "draft" || !a.published);

  const { upcomingAssignments, pastAssignments } = useMemo(() => {
    if (!studentView) {
      return { upcomingAssignments: published, pastAssignments: [] as Assignment[] };
    }
    const now = Date.now();
    const upcoming: Assignment[] = [];
    const past: Assignment[] = [];
    for (const a of published) {
      if (isAssignmentClosedToStudents(a, now)) past.push(a);
      else upcoming.push(a);
    }
    past.sort((a, b) => (b.dueAt ?? 0) - (a.dueAt ?? 0));
    return { upcomingAssignments: upcoming, pastAssignments: past };
  }, [published, studentView]);

  const remove = (id: string) => {
    saveAssignments(
      effectiveCourseId,
      assignments.filter((a) => a.id !== id),
    );
    setDeleteId(null);
    showToast("Assignment deleted", "neutral");
  };

  const handleDuplicate = (a: Assignment) => {
    const copy = duplicateAssignment(a);
    saveAssignments(effectiveCourseId, [copy, ...assignments]);
    showToast("Assignment duplicated", "positive");
  };

  const handlePublish = (a: Assignment) => {
    const next = assignments.map((x) =>
      x.id === a.id
        ? { ...x, status: "published" as const, published: true, publishAt: undefined }
        : x,
    );
    saveAssignments(effectiveCourseId, next);
    showToast("Assignment published", "positive");
  };

  const handleUnpublish = (a: Assignment) => {
    const next = assignments.map((x) =>
      x.id === a.id
        ? { ...x, status: "draft" as const, published: false, publishAt: undefined }
        : x,
    );
    saveAssignments(effectiveCourseId, next);
    showToast("Assignment unpublished", "neutral");
  };

  const AssignmentTable = ({
    items,
    emptyMessage,
  }: {
    items: Assignment[];
    emptyMessage: string;
  }) => (
    <div className="overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
      {items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-gray-600">{emptyMessage}</div>
      ) : (
        <>
          <AssignmentTableHeader />
          {items.map((a) => (
            <AssignmentRow key={a.id} a={a} />
          ))}
        </>
      )}
    </div>
  );
  const AssignmentTableHeader = () => (
    <div
      className={[
        "grid items-center gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
        studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
      ].join(" ")}
    >
      <span>Assignment</span>
      <span>Due Date</span>
      <span>Availability</span>
      <span>Points</span>
      {!studentView && <span>Status</span>}
      {!studentView && <span className="text-right">Actions</span>}
    </div>
  );

  const AssignmentRow = ({ a }: { a: Assignment }) => {
    const preview = htmlPreview(a.description);
    const availability = formatAvailabilityColumn(a);
    const isPublished = a.status === "published" || a.published;
    const notYetAvailable = studentView && isAssignmentNotYetAvailable(a);

    return (
      <div
        className={[
          "grid items-center gap-4 border-b border-canvas-border px-5 py-4 last:border-0",
          studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
        ].join(" ")}
      >
        <Link
          to={`/courses/${effectiveCourseId}/assignments/${a.id}`}
          className="min-w-0 text-left hover:underline"
        >
          <div className="text-sm font-semibold text-canvas-grayDark">{a.title}</div>
          {notYetAvailable && (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Not yet available
            </span>
          )}
          {preview.text && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{preview.text}</p>
          )}
        </Link>

        <div className="min-w-0 text-sm text-gray-700">
          {a.dueAt ? (
            formatAssignmentDueDate(a.dueAt)
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        <div className="min-w-0 text-sm text-gray-700">
          {availability.length > 0 ? (
            <div className="space-y-0.5">
              {availability.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        <div className="text-sm text-gray-700">
          {a.points != null ? (
            `${a.points} pts`
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {!studentView && (
          <div>
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                isPublished
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>
        )}

        {!studentView && (
          <div className="flex shrink-0 items-center justify-end gap-1">
            {!isPublished ? (
              <Tooltip label="Publish">
                <button
                  type="button"
                  onClick={() => handlePublish(a)}
                  aria-label="Publish assignment"
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Unpublish">
                <button
                  type="button"
                  onClick={() => handleUnpublish(a)}
                  aria-label="Unpublish assignment"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label="Edit">
              <Link
                to={`/courses/${effectiveCourseId}/assignments/${a.id}/edit`}
                aria-label="Edit assignment"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Tooltip>
            <Tooltip label="Grade">
              <GradeIconLink
                to={`/courses/${effectiveCourseId}/assignments/${a.id}/grade`}
                pendingCount={getPendingAssignmentCount(effectiveCourseId, a.id)}
                label="Grade assignment"
              />
            </Tooltip>
            <Tooltip label="Duplicate">
              <button
                type="button"
                onClick={() => handleDuplicate(a)}
                aria-label="Duplicate assignment"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Copy className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                onClick={() => setDeleteId(a.id)}
                aria-label="Delete assignment"
                className="rounded-md p-1.5 text-canvas-red hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">Assignments</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {studentView
                  ? "View and submit course assignments."
                  : "Create, publish, and manage assignments."}
              </p>
            </div>
            {!studentView && (
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <span className="text-xs text-canvas-red">{pendingCount} to grade</span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${effectiveCourseId}/assignments/new`)}
                  className="btn-canvas-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Assignment
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assignments…"
                className="w-full rounded-lg border border-canvas-border py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {!studentView && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterKey)}
                className="rounded-lg border border-canvas-border px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-canvas-border px-3 py-2 text-sm"
            >
              <option value="due">Sort by due date</option>
              <option value="title">Sort by title</option>
              <option value="points">Sort by points</option>
            </select>
          </div>

          {studentView ? (
            <>
              <div className="mt-6">
                <AssignmentTable
                  items={upcomingAssignments}
                  emptyMessage={
                    pastAssignments.length > 0
                      ? "No upcoming assignments."
                      : "No assignments yet."
                  }
                />
              </div>
              {pastAssignments.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold text-canvas-grayDark">Past Assignments</h2>
                  <AssignmentTable
                    items={pastAssignments}
                    emptyMessage="No past assignments."
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-6">
                <AssignmentTable items={published} emptyMessage="No assignments yet." />
              </div>

              {drafts.length > 0 && filter !== "published" && (
                <div className="mt-6 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
                  <div className="border-b border-canvas-border px-5 py-3 text-sm font-semibold text-canvas-grayMuted">
                    Drafts
                  </div>
                  <AssignmentTableHeader />
                  {drafts.map((a) => (
                    <AssignmentRow key={a.id} a={a} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-700">Delete this assignment? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="btn-canvas-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => remove(deleteId)} className="btn-canvas-primary bg-canvas-red hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
