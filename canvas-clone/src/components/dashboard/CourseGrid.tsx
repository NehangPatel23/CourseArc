import { useState } from "react";
import { BookX, LayoutGrid, List, Plus, SearchX, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import CourseCard from "../CourseCard";
import CourseListRow from "./CourseListRow";
import CreateCourseModal from "../CreateCourseModal";
import EditCourseModal from "../EditCourseModal";
import DeleteCourseModal from "../DeleteCourseModal";
import BulkActionBar from "./BulkActionBar";
import { getCourseProgressPercent, type CourseSort } from "../../utils/dashboard";
import { getPinnedIds } from "../../utils/pinnedCourses";
import { loadCourses, type Course } from "../../utils/coursesStore";
import type { CourseFilter } from "../../hooks/useDashboardCourses";
import { StatusAlertBanner } from "../ui/StatusAlert";

type Props = {
  studentView: boolean;
  filteredCourses: Course[];
  groupedByTerm: [string, Course[]][];
  filter: CourseFilter;
  setFilter: (f: CourseFilter) => void;
  sort: CourseSort;
  setSort: (s: CourseSort) => void;
  query: string;
  filters: { key: CourseFilter; label: string; count: number }[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  terms: string[];
  activeTerm: string | null;
  onTermChange: (term: string | null) => void;
};

export default function CourseGrid({
  studentView,
  filteredCourses,
  groupedByTerm,
  filter,
  setFilter,
  sort,
  setSort,
  query,
  filters,
  viewMode,
  onViewModeChange,
  terms,
  activeTerm,
  onTermChange,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, setPinTick] = useState(0);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const totalCourses = loadCourses().length;

  const pinnedIds = new Set(getPinnedIds());
  const pinnedCourses = filteredCourses.filter((c) => pinnedIds.has(c.id));

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const showSearchEmpty = query.trim() && filteredCourses.length === 0;
  const showStudentEmpty = studentView && !query.trim() && filteredCourses.length === 0;
  const showInstructorEmpty =
    !studentView && !query.trim() && totalCourses === 0;
  const roleKey = studentView ? "student" : "instructor";

  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setShowDeleteModal(true);
  };

  const courseActions = (course: Course) =>
    !studentView
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

  const renderCourse = (c: Course) => {
    const progress = studentView ? getCourseProgressPercent(c.id) : undefined;
    if (viewMode === "list") {
      return (
        <CourseListRow
          key={c.id}
          course={c}
          studentView={studentView}
          progressPercent={progress}
          selected={selected.has(c.id)}
          onSelect={handleSelect}
          showCheckbox={!studentView}
          {...courseActions(c)}
        />
      );
    }
    return (
      <div key={c.id} className="relative">
        {!studentView && (
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={(e) => handleSelect(c.id, e.target.checked)}
            className="absolute left-3 top-3 z-10 h-4 w-4 rounded border-gray-300 text-canvas-blue"
            aria-label={`Select ${c.title}`}
          />
        )}
        <CourseCard
          course={c}
          progressPercent={progress}
          studentView={studentView}
          onPinChange={() => setPinTick((n) => n + 1)}
          {...courseActions(c)}
        />
      </div>
    );
  };

  const renderSection = (title: string, courses: Course[]) => {
    if (!courses.length) return null;
    return (
      <div className="mb-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </h3>
        <div
          className={
            viewMode === "grid"
              ? "grid gap-5 sm:grid-cols-2"
              : "flex flex-col gap-3"
          }
        >
          {courses.map(renderCourse)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-canvas-grayDark dark:text-gray-100">
            {studentView ? "My Courses" : "Your Courses"}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {query.trim() ? (
              <>
                {filteredCourses.length} result
                {filteredCourses.length !== 1 ? "s" : ""} for &ldquo;{query.trim()}&rdquo;
                <button
                  type="button"
                  onClick={clearSearch}
                  className="ml-2 inline-flex items-center gap-0.5 text-canvas-blue hover:underline"
                >
                  Clear
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                {filteredCourses.length} course
                {filteredCourses.length !== 1 ? "s" : ""} shown
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="dashboard-control flex p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`rounded-md p-2 transition-colors ${viewMode === "grid" ? "bg-canvas-grayLight text-canvas-blue dark:bg-white/10 dark:text-canvas-blueLight" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`rounded-md p-2 transition-colors ${viewMode === "list" ? "bg-canvas-grayLight text-canvas-blue dark:bg-white/10 dark:text-canvas-blueLight" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <select
            value={activeTerm ?? ""}
            onChange={(e) => onTermChange(e.target.value || null)}
            className="dashboard-control px-3 py-2 focus:border-canvas-blue focus:outline-none focus:ring-2 focus:ring-canvas-blue/20"
            aria-label="Filter by term"
          >
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as CourseSort)}
            className="dashboard-control px-3 py-2 focus:border-canvas-blue focus:outline-none focus:ring-2 focus:ring-canvas-blue/20"
            aria-label="Sort courses"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="term">Term</option>
          </select>

          {!studentView && filters.length > 1 && (
            <div className="flex gap-1 rounded-xl bg-gray-100/80 p-1 dark:bg-white/[0.06]">
              {filters.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    filter === key
                      ? "bg-white text-canvas-grayDark shadow-sm dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-1 dark:ring-white/10"
                      : "text-gray-500 hover:text-canvas-grayDark dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-xs text-gray-400">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!studentView && selected.size > 0 && (
        <BulkActionBar
          selectedIds={[...selected]}
          onClear={() => setSelected(new Set())}
          onDelete={() => openDelete([...selected])}
        />
      )}

      {showSearchEmpty && (
        <div className="rounded-2xl border border-canvas-border bg-white p-12 text-center">
          <SearchX className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 font-medium text-canvas-grayDark">
            No courses match &ldquo;{query.trim()}&rdquo;
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-4 rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white hover:bg-canvas-blue/90"
          >
            Clear search
          </button>
        </div>
      )}

      {showStudentEmpty && (
        <div className="rounded-2xl border border-canvas-border bg-white p-12 text-center">
          <BookX className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 font-medium text-canvas-grayDark">No published courses yet</p>
        </div>
      )}

      {showInstructorEmpty && (
        <StatusAlertBanner tone="positive" className="p-12 text-center">
          <Plus className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
          <p className="font-medium">No courses yet</p>
          <p className="mt-1 text-sm opacity-80">Create your first course to get started.</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Create New Course
          </button>
        </StatusAlertBanner>
      )}

      {!showSearchEmpty && !showStudentEmpty && !showInstructorEmpty && (
        <div key={`${roleKey}-${query}-${sort}-${filter}-${viewMode}`}>
          {renderSection("Pinned", pinnedCourses)}
          {groupedByTerm.map(([term, courses]) => {
            const termCourses = courses.filter((c) => !pinnedIds.has(c.id));
            return renderSection(term, termCourses);
          })}
          {!studentView && viewMode === "grid" && (
            <div className="sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="group flex h-full min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-canvas-blue/30 bg-gradient-to-br from-canvas-blue/[0.04] to-transparent p-8 text-center transition-all duration-300 hover:border-canvas-blue/60 hover:from-canvas-blue/[0.08] hover:shadow-canvas-hover"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-canvas-blue/10 text-canvas-blue transition-transform duration-300 group-hover:scale-110 group-hover:bg-canvas-blue group-hover:text-white">
                  <Plus className="h-8 w-8" strokeWidth={2} />
                </div>
                <span className="text-lg font-semibold text-canvas-grayDark">Create New Course</span>
              </button>
            </div>
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
