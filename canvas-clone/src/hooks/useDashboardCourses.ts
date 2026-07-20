import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadCourses, getDistinctTerms, type Course } from "../utils/coursesStore";
import {
  filterCoursesByQuery,
  sortCourses,
  type CourseSort,
} from "../utils/dashboard";
import { sortWithPinsFirst } from "../utils/pinnedCourses";
import { loadSettings } from "../utils/settingsStore";
import { useUser } from "./useUser";

export type CourseFilter = "all" | "published" | "unpublished" | "archived";

export function useDashboardCourses(studentView: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [sort, setSort] = useState<CourseSort>("updated");
  const [courses, setCourses] = useState<Course[]>(() => loadCourses(true));
  const query = searchParams.get("q") ?? "";
  const termParam = searchParams.get("term") ?? "";
  const settings = loadSettings();
  const activeTerm = settings.activeTerm || termParam || null;
  const user = useUser();

  useEffect(() => {
    setFilter("all");
  }, [studentView]);

  useEffect(() => {
    const refresh = () => setCourses(loadCourses(true));
    window.addEventListener("canvasClone:coursesChanged", refresh);
    window.addEventListener("canvasClone:settingsChanged", refresh);
    return () => {
      window.removeEventListener("canvasClone:coursesChanged", refresh);
      window.removeEventListener("canvasClone:settingsChanged", refresh);
    };
  }, []);

  const terms = useMemo(() => getDistinctTerms(), [courses]);

  const visibleCourses = useMemo(() => {
    let list = courses;
    if (!settings.showArchivedCourses) {
      list = list.filter((c) => !c.archived);
    }
    if (studentView) {
      list = list.filter((c) => c.published);
      list = list.filter((c) => user.enrolledCourseIds.includes(c.id));
    }
    if (activeTerm) {
      list = list.filter((c) => c.term === activeTerm);
    }
    return list;
  }, [courses, studentView, user.enrolledCourseIds, activeTerm, settings.showArchivedCourses]);

  const publishedCount = courses.filter((c) => c.published && !c.archived).length;
  const draftCount = courses.filter((c) => !c.published && !c.archived).length;
  const archivedCount = courses.filter((c) => c.archived).length;

  const filteredCourses = useMemo(() => {
    let result = visibleCourses.filter((c) => {
      if (filter === "published") return c.published && !c.archived;
      if (filter === "unpublished") return !c.published && !c.archived;
      if (filter === "archived") return c.archived;
      return !c.archived || settings.showArchivedCourses;
    });
    result = filterCoursesByQuery(result, query);
    result = sortCourses(result, sort);
    result = sortWithPinsFirst(result);
    return result;
  }, [visibleCourses, filter, query, sort, settings.showArchivedCourses]);

  const groupedByTerm = useMemo(() => {
    const groups = new Map<string, Course[]>();
    for (const c of filteredCourses) {
      const term = c.term || "Other";
      const list = groups.get(term) ?? [];
      list.push(c);
      groups.set(term, list);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredCourses]);

  const setActiveTerm = (term: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (term) next.set("term", term);
    else next.delete("term");
    setSearchParams(next, { replace: true });
  };

  return {
    query,
    filter,
    setFilter,
    sort,
    setSort,
    courses,
    visibleCourses,
    filteredCourses,
    groupedByTerm,
    publishedCount,
    draftCount,
    archivedCount,
    totalCount: courses.filter((c) => !c.archived).length,
    terms,
    activeTerm,
    setActiveTerm,
  };
}
