import { useEffect, useState, type ReactNode } from "react";
import Icon from "../../icons/Icon";
import { useSearchParams } from "react-router-dom";
import CourseCard from "../CourseCard";
import CourseListRow from "./CourseListRow";
import CreateCourseModal from "../CreateCourseModal";
import EditCourseModal from "../EditCourseModal";
import DeleteCourseModal from "../DeleteCourseModal";
import BulkActionBar from "./BulkActionBar";
import { getCourseProgressPercent, splitCoursesByPublishStatus, type CourseSort } from "../../utils/dashboard";
import { getPinnedIds } from "../../utils/pinnedCourses";
import { loadCourses, type Course } from "../../utils/coursesStore";
import { StatusAlertBanner } from "../ui/StatusAlert";
import { usePermissions } from "../../utils/permissions";
import ComposeCourseDoodle from "./ComposeCourseDoodle";

type Props = {
  studentView: boolean;
  filteredCourses: Course[];
  groupedByTerm: [string, Course[]][];
  sort: CourseSort;
  setSort: (s: CourseSort) => void;
  query: string;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  terms: string[];
  activeTerm: string | null;
  onTermChange: (term: string | null) => void;
  showHeading?: boolean;
};

export default function CourseGrid({
  studentView,
  filteredCourses,
  groupedByTerm,
  sort,
  setSort,
  query,
  viewMode,
  onViewModeChange,
  terms,
  activeTerm,
  onTermChange,
  showHeading = true,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, setPinTick] = useState(0);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { canCreateCourses } = usePermissions();

  useEffect(() => {
    if (!canCreateCourses) return;
    const open = () => setShowCreate(true);
    window.addEventListener("canvasClone:composeCourse", open);
    return () => window.removeEventListener("canvasClone:composeCourse", open);
  }, [canCreateCourses]);

  const totalCourses = loadCourses().length;

  const pinnedIds = new Set(getPinnedIds());
  const pinnedCourses = filteredCourses.filter((c) => pinnedIds.has(c.id));

  const catalogIndex = new Map(filteredCourses.map((c, i) => [c.id, i + 1]));

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const showSearchEmpty = query.trim() && filteredCourses.length === 0;
  const showStudentEmpty = studentView && !query.trim() && filteredCourses.length === 0;
  const showInstructorEmpty =
    canCreateCourses && !query.trim() && totalCourses === 0;
  const roleKey = studentView ? "student" : "instructor";

  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setShowDeleteModal(true);
  };

  const courseActions = (course: Course) =>
    canCreateCourses
      ? {
          onEdit: () => setEditCourse(course),
          onDelete: () => openDelete([course.id]),
        }
      : {};

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const renderCourse = (c: Course, i: number) => {
    const progress = studentView ? getCourseProgressPercent(c.id) : undefined;
    const index = catalogIndex.get(c.id) ?? i + 1;
    if (viewMode === "list") {
      return (
        <CourseListRow
          key={c.id}
          course={c}
          studentView={studentView}
          progressPercent={progress}
          catalogIndex={index}
          selected={selected.has(c.id)}
          onSelect={handleSelect}
          showCheckbox={canCreateCourses}
          {...courseActions(c)}
        />
      );
    }
    return (
      <div
        key={c.id}
        className="relative animate-fadeInUp"
        style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
      >
        <CourseCard
          course={c}
          progressPercent={progress}
          studentView={studentView}
          catalogIndex={index}
          selected={selected.has(c.id)}
          onSelect={handleSelect}
          showCheckbox={canCreateCourses}
          onPinChange={() => setPinTick((n) => n + 1)}
          {...courseActions(c)}
        />
      </div>
    );
  };

  const { published, unpublished, archived } = splitCoursesByPublishStatus(filteredCourses);

  const renderSection = (
    title: string,
    courses: Course[],
    opts?: { id?: string; prominent?: boolean; extra?: ReactNode },
  ) => {
    if (!courses.length && !opts?.extra) return null;
    return (
      <section key={opts?.id ?? title} id={opts?.id} className="mb-12 scroll-mt-6" aria-label={title}>
        <div className="mb-5 flex items-baseline justify-between border-b border-arc-ink/10 pb-2">
          <h3
            className={
              opts?.prominent
                ? "font-display text-xl font-medium text-arc-ink"
                : "kicker"
            }
          >
            {title}
          </h3>
          {opts?.prominent && (
            <span className="font-display text-sm tabular-nums italic text-arc-mute">
              {String(courses.length).padStart(2, "0")}
            </span>
          )}
        </div>
        <div
          className={
            viewMode === "grid"
              ? "grid gap-6 sm:grid-cols-2"
              : "flex flex-col"
          }
        >
          {courses.map(renderCourse)}
          {opts?.extra}
        </div>
      </section>
    );
  };

  const createTile =
    canCreateCourses && viewMode === "grid" ? (
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        data-compose-course
        className="group flex min-h-[280px] w-full flex-col items-start overflow-hidden border border-dashed border-arc-ink/20 bg-transparent px-6 py-6 text-left transition-colors duration-300 hover:border-arc-copper/45 hover:bg-arc-ivory/60"
      >
        <span className="kicker">Compose</span>
        <div className="flex w-full flex-1 items-center justify-center py-2">
          <ComposeCourseDoodle className="h-[9.75rem] w-[11rem] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-2 sm:h-[10.5rem] sm:w-[12rem]" />
        </div>
        <div className="max-w-[16rem]">
          <span className="mb-4 flex h-9 w-9 items-center justify-center text-arc-copper">
            <Icon name="plus" size={18} />
          </span>
          <p className="font-display text-2xl font-medium text-arc-ink">A new course</p>
          <p className="mt-1 text-sm leading-relaxed text-arc-mute">
            Open a studio for the term.
          </p>
        </div>
      </button>
    ) : null;

  return (
    <>
      <div id="catalog-plates" className="mb-8 scroll-mt-6">
        {showHeading && (
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-arc-ink/15 pb-4">
            <div>
              <p className="kicker">Catalog</p>
              <h2 className="font-display mt-1 text-3xl font-medium tracking-tight text-arc-ink">
                {studentView ? "Your courses" : "Courses"}
              </h2>
            </div>
            <p className="font-display text-sm italic text-arc-mute">
              {query.trim() ? (
                <>
                  {filteredCourses.length} for “{query.trim()}”
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="ml-2 inline-flex items-center gap-1 text-arc-copper not-italic hover:underline"
                  >
                    Clear
                    <Icon name="close" size={11} />
                  </button>
                </>
              ) : (
                <>
                  {String(filteredCourses.length).padStart(2, "0")} shown
                </>
              )}
            </p>
          </div>
        )}

        <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${showHeading ? "mt-5" : "border-b border-arc-ink/10 pb-4"}`}>
          <nav className="flex flex-wrap items-baseline gap-x-6 gap-y-2" aria-label="Filter by term">
            <button
              type="button"
              onClick={() => onTermChange(null)}
              className={activeTerm == null ? "catalog-tab-active" : "catalog-tab"}
            >
              All terms
            </button>
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTermChange(t)}
                className={activeTerm === t ? "catalog-tab-active" : "catalog-tab"}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-5">
            {!showHeading && (
              <p className="font-display text-sm italic text-arc-mute">
                {query.trim() ? (
                  <>
                    {filteredCourses.length} for “{query.trim()}”
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="ml-2 inline-flex items-center gap-1 text-arc-copper not-italic hover:underline"
                    >
                      Clear
                      <Icon name="close" size={11} />
                    </button>
                  </>
                ) : (
                  <>{String(filteredCourses.length).padStart(2, "0")} shown</>
                )}
              </p>
            )}
            <label className="flex items-center gap-2 text-arc-mute">
              <span className="kicker hidden sm:inline">Layout</span>
              <select
                value={viewMode}
                onChange={(e) => onViewModeChange(e.target.value as "grid" | "list")}
                className="dashboard-control min-w-[7.5rem]"
                aria-label="Catalog layout"
              >
                <option value="grid">Plates</option>
                <option value="list">Index</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-arc-mute">
              <span className="kicker hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CourseSort)}
                className="dashboard-control min-w-[9rem]"
                aria-label="Sort courses"
              >
                <option value="updated">Recently updated</option>
                <option value="name">Name A–Z</option>
                <option value="term">Term</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {canCreateCourses && selected.size > 0 && (
        <BulkActionBar
          selectedIds={[...selected]}
          onClear={() => setSelected(new Set())}
          onDelete={() => openDelete([...selected])}
        />
      )}

      {showSearchEmpty && (
        <div className="border border-dashed border-arc-ink/15 px-8 py-16 text-center">
          <Icon name="emptySearch" size={28} className="mx-auto text-arc-mute/50" />
          <p className="font-display mt-4 text-xl text-arc-ink">
            Nothing matches “{query.trim()}”
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-5 text-sm text-arc-copper hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {showStudentEmpty && (
        <div className="border border-dashed border-arc-ink/15 px-8 py-16 text-center">
          <Icon name="emptyBook" size={28} className="mx-auto text-arc-mute/50" />
          <p className="font-display mt-4 text-xl text-arc-ink">No published courses yet</p>
          <p className="mt-2 text-sm text-arc-mute">When a studio opens, it will appear here.</p>
        </div>
      )}

      {showInstructorEmpty && (
        <StatusAlertBanner tone="positive" className="px-8 py-16 text-center">
          <Icon name="plus" size={22} className="mx-auto mb-4 text-arc-sage" />
          <p className="font-display text-xl text-arc-ink">The catalog is empty</p>
          <p className="mt-1 text-sm text-arc-mute">Compose the first course to open the term.</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            data-compose-course
            className="btn-canvas-primary mt-5"
          >
            Compose a course
          </button>
        </StatusAlertBanner>
      )}

      {!showSearchEmpty && !showStudentEmpty && !showInstructorEmpty && (
        <div key={`${roleKey}-${query}-${sort}-${viewMode}`}>
          {studentView ? (
            <>
              {renderSection("Pinned", pinnedCourses)}
              {groupedByTerm.map(([term, courses]) => {
                const termCourses = courses.filter((c) => !pinnedIds.has(c.id));
                return renderSection(term, termCourses);
              })}
            </>
          ) : (
            <>
              {renderSection("Published", published, {
                id: "dashboard-published",
                prominent: true,
                extra: unpublished.length ? undefined : createTile,
              })}
              {renderSection("Unpublished", unpublished, {
                id: "dashboard-unpublished",
                prominent: true,
                extra: unpublished.length ? createTile : undefined,
              })}
              {renderSection("Archived", archived, {
                id: "dashboard-archived",
                prominent: true,
              })}
              {canCreateCourses && viewMode === "list" && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  data-compose-course
                  className="mt-2 flex items-center gap-2 py-3 text-sm text-arc-copper hover:underline"
                >
                  <Icon name="plus" size={14} />
                  Compose a course
                </button>
              )}
            </>
          )}
        </div>
      )}

      <CreateCourseModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditCourseModal
        open={!!editCourse}
        course={editCourse}
        onClose={() => setEditCourse(null)}
      />
      <DeleteCourseModal
        open={showDeleteModal}
        courseIds={deleteIds}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteIds([]);
        }}
        onDeleted={() => setSelected(new Set())}
      />
    </>
  );
}
