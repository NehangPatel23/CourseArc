export type WidgetId =
  | "quickActions"
  | "thisWeek"
  | "recentAnnouncements"
  | "priorityTodo"
  | "recentActivity"
  | "courseHealth"
  | "gradingQueue"
  | "progressOverview"
  | "gradesSnapshot"
  | "upcomingDeadlines"
  | "analyticsSnapshot"
  | "tip";

export type DashboardLayoutPrefs = {
  /** Visible widgets in display order */
  widgets: WidgetId[];
  /** Hidden widget ids (not shown in sidebar) */
  hidden: WidgetId[];
  collapsed: WidgetId[];
  viewMode: "grid" | "list";
};

const LAYOUT_KEY = "canvasClone:dashboardLayout";

const DEFAULT_STUDENT: WidgetId[] = [
  "quickActions",
  "priorityTodo",
  "progressOverview",
  "gradesSnapshot",
  "thisWeek",
  "upcomingDeadlines",
  "recentAnnouncements",
  "tip",
];

const DEFAULT_INSTRUCTOR: WidgetId[] = [
  "quickActions",
  "analyticsSnapshot",
  "courseHealth",
  "gradingQueue",
  "thisWeek",
  "upcomingDeadlines",
  "tip",
];

const STUDENT_AVAILABLE: WidgetId[] = [
  "quickActions",
  "priorityTodo",
  "progressOverview",
  "gradesSnapshot",
  "thisWeek",
  "upcomingDeadlines",
  "recentAnnouncements",
  "tip",
];

const INSTRUCTOR_AVAILABLE: WidgetId[] = [
  "quickActions",
  "analyticsSnapshot",
  "courseHealth",
  "gradingQueue",
  "thisWeek",
  "upcomingDeadlines",
  "tip",
];

export function getDefaultWidgets(studentView: boolean): WidgetId[] {
  return studentView ? [...DEFAULT_STUDENT] : [...DEFAULT_INSTRUCTOR];
}

export function getAvailableWidgets(studentView: boolean): WidgetId[] {
  return studentView ? [...STUDENT_AVAILABLE] : [...INSTRUCTOR_AVAILABLE];
}

function normalizeLayout(
  studentView: boolean,
  parsed: Partial<DashboardLayoutPrefs>,
): DashboardLayoutPrefs {
  const available = new Set(getAvailableWidgets(studentView));
  const defaultWidgets = getDefaultWidgets(studentView);

  let widgets = (parsed.widgets?.length ? parsed.widgets : defaultWidgets).filter((id) =>
    available.has(id),
  );
  let hidden = (parsed.hidden ?? []).filter((id) => available.has(id));

  // Migrate layouts saved before hidden existed: hidden = available not in widgets
  if (!parsed.hidden && parsed.widgets?.length) {
    hidden = getAvailableWidgets(studentView).filter((id) => !widgets.includes(id));
  }

  // Ensure every available widget is either visible or hidden
  for (const id of available) {
    if (!widgets.includes(id) && !hidden.includes(id)) {
      widgets.push(id);
    }
  }

  // Remove duplicates from hidden that are visible
  hidden = hidden.filter((id) => !widgets.includes(id));

  if (!widgets.length) {
    widgets = defaultWidgets.filter((id) => !hidden.includes(id));
  }

  const collapsed = (parsed.collapsed ?? []).filter(
    (id) => widgets.includes(id) && available.has(id),
  );

  return {
    widgets,
    hidden,
    collapsed,
    viewMode: parsed.viewMode ?? "grid",
  };
}

export function loadDashboardLayout(studentView: boolean): DashboardLayoutPrefs {
  try {
    const key = studentView ? `${LAYOUT_KEY}:student` : `${LAYOUT_KEY}:instructor`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {
        widgets: getDefaultWidgets(studentView),
        hidden: [],
        collapsed: [],
        viewMode: "grid",
      };
    }
    const parsed = JSON.parse(raw) as Partial<DashboardLayoutPrefs>;
    return normalizeLayout(studentView, parsed);
  } catch {
    return {
      widgets: getDefaultWidgets(studentView),
      hidden: [],
      collapsed: [],
      viewMode: "grid",
    };
  }
}

export function saveDashboardLayout(studentView: boolean, prefs: DashboardLayoutPrefs) {
  try {
    const key = studentView ? `${LAYOUT_KEY}:student` : `${LAYOUT_KEY}:instructor`;
    window.localStorage.setItem(key, JSON.stringify(prefs));
    window.dispatchEvent(new Event("canvasClone:dashboardLayoutChanged"));
  } catch {}
}

export function toggleWidgetCollapsed(
  studentView: boolean,
  widgetId: WidgetId,
): DashboardLayoutPrefs {
  const prefs = loadDashboardLayout(studentView);
  const collapsed = new Set(prefs.collapsed);
  if (collapsed.has(widgetId)) collapsed.delete(widgetId);
  else collapsed.add(widgetId);
  const next = { ...prefs, collapsed: [...collapsed] };
  saveDashboardLayout(studentView, next);
  return next;
}

export function setViewMode(
  studentView: boolean,
  viewMode: "grid" | "list",
): DashboardLayoutPrefs {
  const prefs = { ...loadDashboardLayout(studentView), viewMode };
  saveDashboardLayout(studentView, prefs);
  return prefs;
}

export function reorderWidgets(
  studentView: boolean,
  widgets: WidgetId[],
): DashboardLayoutPrefs {
  const prefs = loadDashboardLayout(studentView);
  const hidden = new Set(prefs.hidden);
  const nextVisible = widgets.filter((id) => !hidden.has(id));
  const next = { ...prefs, widgets: nextVisible };
  saveDashboardLayout(studentView, next);
  return next;
}

export function setWidgetVisible(
  studentView: boolean,
  widgetId: WidgetId,
  visible: boolean,
): DashboardLayoutPrefs {
  const prefs = loadDashboardLayout(studentView);
  const available = getAvailableWidgets(studentView);
  if (!available.includes(widgetId)) return prefs;

  let widgets = [...prefs.widgets];
  let hidden = [...prefs.hidden];

  if (visible) {
    hidden = hidden.filter((id) => id !== widgetId);
    if (!widgets.includes(widgetId)) widgets.push(widgetId);
  } else {
    widgets = widgets.filter((id) => id !== widgetId);
    if (!hidden.includes(widgetId)) hidden.push(widgetId);
    hidden = hidden.filter((id) => available.includes(id));
  }

  const collapsed = prefs.collapsed.filter((id) => widgets.includes(id));
  const next = { widgets, hidden, collapsed, viewMode: prefs.viewMode };
  saveDashboardLayout(studentView, next);
  return next;
}

export function toggleWidgetVisible(
  studentView: boolean,
  widgetId: WidgetId,
): DashboardLayoutPrefs {
  const prefs = loadDashboardLayout(studentView);
  const isVisible = prefs.widgets.includes(widgetId);
  return setWidgetVisible(studentView, widgetId, !isVisible);
}

export function resetDashboardLayout(studentView: boolean): DashboardLayoutPrefs {
  const prefs: DashboardLayoutPrefs = {
    widgets: getDefaultWidgets(studentView),
    hidden: [],
    collapsed: [],
    viewMode: "grid",
  };
  saveDashboardLayout(studentView, prefs);
  return prefs;
}
