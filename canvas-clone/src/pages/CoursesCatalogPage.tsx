import { useEffect, useMemo, useState } from "react";
import CatalogHero from "../components/catalog/CatalogHero";
import CourseGrid from "../components/dashboard/CourseGrid";
import StudentViewBanner from "../components/StudentViewBanner";
import type { StatItem } from "../components/dashboard/DashboardHero";
import { useDashboardCourses } from "../hooks/useDashboardCourses";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { getHeroStatTone, type HeroStatAction } from "../utils/courseAlerts";
import { getPinnedIds, PINNED_CHANGED_EVENT } from "../utils/pinnedCourses";

export default function CoursesCatalogPage() {
  const { studentView } = useStudentView();
  const { canCreateCourses } = usePermissions();
  const [, setPinTick] = useState(0);

  const {
    query,
    sort,
    setSort,
    filteredCourses,
    groupedByTerm,
    visibleCourses,
    publishedCount,
    draftCount,
    terms,
    activeTerm,
    setActiveTerm,
  } = useDashboardCourses(studentView);

  const { layout, changeViewMode } = useDashboardLayout(studentView);

  useEffect(() => {
    const onPin = () => setPinTick((n) => n + 1);
    window.addEventListener(PINNED_CHANGED_EVENT, onPin);
    return () => window.removeEventListener(PINNED_CHANGED_EVENT, onPin);
  }, []);

  const displayTerm = activeTerm ?? terms[0] ?? "Fall 2025";
  const pinnedCount = getPinnedIds().filter((id) =>
    visibleCourses.some((c) => c.id === id),
  ).length;

  const heroStats: StatItem[] = useMemo(() => {
    if (studentView) {
      return [
        {
          icon: "book",
          value: visibleCourses.length,
          label: "Enrolled",
          tone: getHeroStatTone("Enrolled courses", visibleCourses.length, true),
          action: { type: "scroll", targetId: "catalog-plates" } satisfies HeroStatAction,
        },
        {
          icon: "pin",
          value: pinnedCount,
          label: "Pinned",
          action: { type: "scroll", targetId: "catalog-plates" } satisfies HeroStatAction,
        },
        {
          icon: "cap",
          value: displayTerm,
          label: "Current term",
          action: { type: "term", term: displayTerm } satisfies HeroStatAction,
        },
      ];
    }
    return [
      {
        icon: "book",
        value: filteredCourses.length,
        label: "Plates",
        action: { type: "scroll", targetId: "catalog-plates" } satisfies HeroStatAction,
      },
      {
        icon: "trend",
        value: publishedCount,
        label: "Published",
        tone: getHeroStatTone("Published", publishedCount, false),
        action: { type: "scroll", targetId: "dashboard-published" } satisfies HeroStatAction,
      },
      {
        icon: "cap",
        value: draftCount,
        label: "Unpublished",
        tone: getHeroStatTone("Unpublished", draftCount, false),
        action: { type: "scroll", targetId: "dashboard-unpublished" } satisfies HeroStatAction,
      },
      {
        icon: "calendar",
        value: terms.length,
        label: "Terms",
      },
    ];
  }, [
    studentView,
    visibleCourses.length,
    pinnedCount,
    displayTerm,
    filteredCourses.length,
    publishedCount,
    draftCount,
    terms.length,
  ]);

  const handleStatAction = (action: HeroStatAction) => {
    if (action.type === "scroll") {
      document.getElementById(action.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.type === "term") setActiveTerm(action.term);
  };

  return (
    <div className="min-h-full bg-transparent" data-tour="catalog">
      {studentView && (
        <StudentViewBanner label="Viewing as a student — enrolled courses only" />
      )}

      <CatalogHero
        studentView={studentView}
        stats={heroStats}
        onStatAction={handleStatAction}
        canCompose={canCreateCourses}
      />

      <section className="relative w-full px-8 pb-12 pt-12 lg:px-14 lg:pb-16">
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
          showHeading={false}
        />
      </section>
    </div>
  );
}
