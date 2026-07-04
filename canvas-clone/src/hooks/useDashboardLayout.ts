import { useCallback, useEffect, useState } from "react";
import {
  loadDashboardLayout,
  reorderWidgets,
  resetDashboardLayout,
  setViewMode,
  toggleWidgetCollapsed,
  toggleWidgetVisible,
  type DashboardLayoutPrefs,
  type WidgetId,
} from "../utils/dashboardLayout";

export function useDashboardLayout(studentView: boolean) {
  const [layout, setLayout] = useState<DashboardLayoutPrefs>(() =>
    loadDashboardLayout(studentView),
  );

  useEffect(() => {
    setLayout(loadDashboardLayout(studentView));
  }, [studentView]);

  useEffect(() => {
    const refresh = () => setLayout(loadDashboardLayout(studentView));
    window.addEventListener("canvasClone:dashboardLayoutChanged", refresh);
    return () =>
      window.removeEventListener("canvasClone:dashboardLayoutChanged", refresh);
  }, [studentView]);

  const toggleCollapsed = useCallback(
    (widgetId: WidgetId) => {
      setLayout(toggleWidgetCollapsed(studentView, widgetId));
    },
    [studentView],
  );

  const changeViewMode = useCallback(
    (mode: "grid" | "list") => {
      setLayout(setViewMode(studentView, mode));
    },
    [studentView],
  );

  const reorder = useCallback(
    (widgets: WidgetId[]) => {
      setLayout(reorderWidgets(studentView, widgets));
    },
    [studentView],
  );

  const toggleVisibility = useCallback(
    (widgetId: WidgetId) => {
      setLayout(toggleWidgetVisible(studentView, widgetId));
    },
    [studentView],
  );

  const reset = useCallback(() => {
    setLayout(resetDashboardLayout(studentView));
  }, [studentView]);

  return { layout, toggleCollapsed, changeViewMode, reorder, toggleVisibility, reset };
}
