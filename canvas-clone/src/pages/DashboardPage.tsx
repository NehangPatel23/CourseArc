import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { mockDashboardEvents } from "../data/mockData";
import { getTermGPA } from "../data/mockData";
import DashboardHero, { getGreeting } from "../components/dashboard/DashboardHero";
import CourseGrid from "../components/dashboard/CourseGrid";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardTour from "../components/dashboard/DashboardTour";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import { useDashboardCourses } from "../hooks/useDashboardCourses";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useSettings } from "../hooks/useSettings";
import { countDueThisWeek } from "../utils/dashboard";
import { countDraftCourses } from "../utils/courseHealth";
import { getFirstName } from "../utils/userStore";
import { useStudentView } from "../utils/studentView";
import { getHeroStatTone, getHeroStatAction, type HeroStatAction } from "../utils/courseAlerts";
import type { StatItem } from "../components/dashboard/DashboardHero";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { studentView } = useStudentView();
  const settings = useSettings();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

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

  const { layout, toggleCollapsed, changeViewMode, reorder, toggleVisibility, reset } =
    useDashboardLayout(studentView);

  const dueThisWeek = countDueThisWeek(mockDashboardEvents);
  const roleKey = studentView ? "student" : "instructor";
  const firstName = getFirstName();
  const displayTerm = activeTerm ?? terms[0] ?? "Fall 2025";

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

  const heroStats: StatItem[] = useMemo(() => {
    const build = (items: Omit<StatItem, "tone" | "action">[]): StatItem[] =>
      items.map((s) => ({
        ...s,
        tone: getHeroStatTone(s.label, s.value, studentView),
        action: getHeroStatAction(s.label, studentView, displayTerm),
      }));

    if (studentView) {
      return build([
        { icon: BookOpen, value: visibleCourses.length, label: "Enrolled courses", iconClass: "text-canvas-blueLight" },
        { icon: ClipboardList, value: dueThisWeek, label: "Due this week", iconClass: "text-amber-400" },
        { icon: GraduationCap, value: displayTerm, label: "Current term", iconClass: "text-emerald-400" },
        { icon: TrendingUp, value: getTermGPA(), label: "Term GPA", iconClass: "text-canvas-blueLight" },
      ]);
    }
    const drafts = countDraftCourses();
    return build([
      { icon: BookOpen, value: totalCount, label: "Total courses", iconClass: "text-canvas-blueLight" },
      { icon: TrendingUp, value: publishedCount, label: "Published", iconClass: "text-emerald-400" },
      { icon: GraduationCap, value: drafts, label: drafts === 1 ? "Draft needs publishing" : "Drafts", iconClass: "text-amber-400" },
    ]);
  }, [studentView, visibleCourses.length, dueThisWeek, totalCount, publishedCount, displayTerm]);

  const handleStatAction = (action: HeroStatAction) => {
    if (action.type === "navigate") navigate(action.href);
    if (action.type === "filter") setFilter(action.filter);
    if (action.type === "term") setActiveTerm(action.term);
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div
      className={`min-h-full bg-canvas-grayLight transition-shadow duration-300 dark:bg-canvas-surface ${
        studentView ? "ring-2 ring-inset ring-canvas-blue/20" : ""
      }`}
      data-tour="dashboard"
    >
      <DashboardTour />
      {studentView && (
        <div className="flex items-center justify-center gap-2 border-b border-canvas-blue/20 bg-canvas-blue/5 px-4 py-2 text-xs font-semibold text-canvas-blue dark:bg-canvas-blue/10 dark:text-canvas-blueLight">
          <Eye className="h-3.5 w-3.5" />
          Student View — seeing courses and content as a student would
        </div>
      )}

      <DashboardHero
        greeting={getGreeting()}
        firstName={firstName}
        studentView={studentView}
        stats={heroStats}
        roleKey={roleKey}
        onStatAction={handleStatAction}
      />

      <section className="relative mx-auto max-w-7xl px-8 pb-12 pt-2 lg:px-12 lg:pb-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            <div data-tour="course-grid">
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

          <DashboardSidebar
            widgets={layout.widgets}
            hidden={layout.hidden}
            collapsed={layout.collapsed}
            studentView={studentView}
            onToggle={toggleCollapsed}
            onReorder={reorder}
            onToggleVisibility={toggleVisibility}
            onReset={reset}
          />
        </div>
      </section>
    </div>
  );
}
