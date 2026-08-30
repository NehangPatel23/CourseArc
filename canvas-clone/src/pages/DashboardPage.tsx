import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentViewBanner from "../components/StudentViewBanner";
import { getTermGPA } from "../data/mockData";
import DashboardHero, { getGreeting } from "../components/dashboard/DashboardHero";
import CourseGrid from "../components/dashboard/CourseGrid";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import { useDashboardCourses } from "../hooks/useDashboardCourses";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useStudentView } from "../utils/studentView";
import { countDraftCourses } from "../utils/courseHealth";
import { getUpcomingDeadlines } from "../utils/deadlines";
import { getFirstName } from "../utils/userStore";
import { getHeroStatTone, getHeroStatAction, type HeroStatAction } from "../utils/courseAlerts";
import type { StatItem } from "../components/dashboard/DashboardHero";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { studentView } = useStudentView();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const {
    query,
    sort,
    setSort,
    filteredCourses,
    groupedByTerm,
    visibleCourses,
    publishedCount,
    totalCount,
    terms,
    activeTerm,
    setActiveTerm,
  } = useDashboardCourses(studentView);

  const { layout, toggleCollapsed, changeViewMode, reorder, toggleVisibility, reset } =
    useDashboardLayout(studentView);

  const dueThisWeek = getUpcomingDeadlines("week").filter((e) => e.type === "due").length;
  const roleKey = studentView ? "student" : "instructor";
  const firstName = getFirstName();
  const displayTerm = activeTerm ?? terms[0] ?? "Fall 2025";

  const heroStats: StatItem[] = useMemo(() => {
    const build = (items: Omit<StatItem, "tone" | "action">[]): StatItem[] =>
      items.map((s) => ({
        ...s,
        tone: getHeroStatTone(s.label, s.value, studentView),
        action: getHeroStatAction(s.label, studentView, displayTerm),
      }));

    if (studentView) {
      return build([
        { icon: "book", value: visibleCourses.length, label: "Enrolled courses" },
        { icon: "clipboard", value: dueThisWeek, label: "Due this week" },
        { icon: "cap", value: displayTerm, label: "Current term" },
        { icon: "trend", value: getTermGPA(), label: "Term GPA" },
      ]);
    }
    const drafts = countDraftCourses();
    return build([
        { icon: "book", value: totalCount, label: "Total courses" },
        { icon: "trend", value: publishedCount, label: "Published" },
        { icon: "cap", value: drafts, label: "Unpublished" },
    ]);
  }, [studentView, visibleCourses.length, dueThisWeek, totalCount, publishedCount, displayTerm]);

  const handleStatAction = (action: HeroStatAction) => {
    if (action.type === "navigate") navigate(action.href);
    if (action.type === "scroll") {
      document.getElementById(action.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.type === "filter") {
      document.querySelector('[data-tour="course-grid"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.type === "term") setActiveTerm(action.term);
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div
      className="min-h-full bg-transparent"
      data-tour="dashboard"
    >
      {studentView && <StudentViewBanner />}

      <DashboardHero
        greeting={getGreeting()}
        firstName={firstName}
        studentView={studentView}
        stats={heroStats}
        roleKey={roleKey}
        onStatAction={handleStatAction}
      />

      <section className="relative w-full px-8 pb-12 pt-12 lg:px-14 lg:pb-16">
        <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] xl:gap-16">
          <div>
            <div data-tour="course-grid">
              <CourseGrid
                studentView={studentView}
                filteredCourses={filteredCourses}
                groupedByTerm={groupedByTerm}
                sort={sort}
                setSort={setSort}
                query={query}
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
