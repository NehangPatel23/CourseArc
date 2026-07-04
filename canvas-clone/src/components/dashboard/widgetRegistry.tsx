import QuickActionsWidget from "./widgets/QuickActionsWidget";
import ThisWeekWidget from "./widgets/ThisWeekWidget";
import RecentAnnouncements from "./widgets/RecentAnnouncements";
import PriorityTodoList from "./widgets/PriorityTodoList";
import RecentActivity from "./widgets/RecentActivity";
import CourseHealthPanel from "./widgets/CourseHealthPanel";
import GradingQueue from "./widgets/GradingQueue";
import ProgressOverview from "./widgets/ProgressOverview";
import GradesSnapshot from "./widgets/GradesSnapshot";
import UpcomingDeadlines from "./widgets/UpcomingDeadlines";
import TipWidget from "./widgets/TipWidget";
import AnalyticsSnapshot from "./widgets/AnalyticsSnapshot";
import type { WidgetId } from "../../utils/dashboardLayout";

export const WIDGET_REGISTRY: Record<
  WidgetId,
  React.ComponentType<{ studentView: boolean; collapsed?: boolean; onToggle?: () => void }>
> = {
  quickActions: QuickActionsWidget,
  thisWeek: ThisWeekWidget,
  recentAnnouncements: RecentAnnouncements,
  priorityTodo: PriorityTodoList,
  recentActivity: RecentActivity,
  courseHealth: CourseHealthPanel,
  gradingQueue: GradingQueue,
  progressOverview: ProgressOverview,
  gradesSnapshot: GradesSnapshot,
  upcomingDeadlines: UpcomingDeadlines,
  analyticsSnapshot: AnalyticsSnapshot,
  tip: TipWidget,
};

export const WIDGET_LABELS: Record<WidgetId, string> = {
  quickActions: "Quick Actions",
  thisWeek: "This Week",
  recentAnnouncements: "Announcements",
  priorityTodo: "Priority To-Do",
  recentActivity: "Recent Activity",
  courseHealth: "Course Health",
  gradingQueue: "Grading Queue",
  progressOverview: "Progress Overview",
  gradesSnapshot: "Grades",
  upcomingDeadlines: "Upcoming Deadlines",
  analyticsSnapshot: "Analytics",
  tip: "Tip",
};
