import { Eye } from "lucide-react";
import CourseGrid from "../components/dashboard/CourseGrid";
import { useDashboardCourses } from "../hooks/useDashboardCourses";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useSettings } from "../hooks/useSettings";
import { useStudentView } from "../utils/studentView";

export default function CoursesCatalogPage() {
  const { studentView } = useStudentView();
  const settings = useSettings();

  const {
    query,
    filter,
    setFilter,
    sort,
    setSort,
    filteredCourses,
    groupedByTerm,
    visibleCourses,
    publishedCount,
    draftCount,
    archivedCount,
    totalCount,
    terms,
    activeTerm,
    setActiveTerm,
  } = useDashboardCourses(studentView);

  const { layout, changeViewMode } = useDashboardLayout(studentView);

  const filters = studentView
    ? [{ key: "all" as const, label: "Enrolled", count: visibleCourses.length }]
    : [
        { key: "all" as const, label: "All", count: totalCount },
        { key: "published" as const, label: "Published", count: publishedCount },
        { key: "unpublished" as const, label: "Drafts", count: draftCount },
        ...(archivedCount > 0 || settings.showArchivedCourses
          ? [{ key: "archived" as const, label: "Archived", count: archivedCount }]
          : []),
      ];

  return (
    <div
      className={`min-h-full bg-canvas-grayLight ${
        studentView ? "ring-2 ring-inset ring-canvas-blue/20" : ""
      }`}
    >
      {studentView && (
        <div className="flex items-center justify-center gap-2 border-b border-canvas-blue/20 bg-canvas-blue/5 px-4 py-2 text-xs font-semibold text-canvas-blue">
          <Eye className="h-3.5 w-3.5" />
          Student View — seeing enrolled courses only
        </div>
      )}

      <div className="w-full px-8 py-10 lg:px-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-canvas-grayDark">Courses</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse, search, and manage your courses.
          </p>
        </div>

        <CourseGrid
          studentView={studentView}
          filteredCourses={filteredCourses}
          groupedByTerm={groupedByTerm}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          query={query}
          filters={filters}
          viewMode={layout.viewMode}
          onViewModeChange={changeViewMode}
          terms={terms}
          activeTerm={activeTerm}
          onTermChange={setActiveTerm}
        />
      </div>
    </div>
  );
}
