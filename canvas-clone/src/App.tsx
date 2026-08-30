import { useCallback, useEffect, useState } from "react";
import { Routes, Route, Outlet, Navigate, useLocation, useParams } from "react-router-dom";
import GlobalNav, { focusGlobalNavSearch, openGlobalSearch } from "./components/GlobalNav";
import KeyboardShortcutsSheet from "./components/KeyboardShortcutsSheet";
import StudioTour from "./components/dashboard/DashboardTour";
import SplashScreen from "./components/SplashScreen";
import DashboardPage from "./pages/DashboardPage";
import CoursesCatalogPage from "./pages/CoursesCatalogPage";
import CalendarPage from "./pages/CalendarPage";
import InboxPage from "./pages/InboxPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LoginPage from "./pages/LoginPage";
import HelpPage from "./pages/HelpPage";
import PlannerPage from "./pages/PlannerPage";
import PortfolioPage from "./pages/PortfolioPage";
import PublicPortfolioPage from "./pages/PublicPortfolioPage";
import CourseLayout from "./layouts/CourseLayout";
import CourseHomePage from "./pages/CourseHomePage";
import CourseSettingsPage from "./pages/CourseSettingsPage";
import ModulesPage from "./pages/ModulesPage";
import ModuleItemUnavailablePage from "./pages/ModuleItemUnavailablePage";
import PagesPage from "./pages/PagesPage";
import FilesPage from "./pages/FilesPage";
import PageEditorPage from "./pages/PageEditorPage";
import FilePreviewPage from "./pages/FilePreviewPage";
import PageViewerPage from "./pages/PageViewerPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import AnnouncementEditorPage from "./pages/AnnouncementEditorPage";
import AnnouncementViewerPage from "./pages/AnnouncementViewerPage";
import { useGlobalKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUser } from "./hooks/useUser";
import { ToastProvider } from "./components/ui/Toast";
import AuthGate from "./components/AuthGate";
import AppErrorBoundary from "./components/AppErrorBoundary";
import SettingsPage from "./pages/SettingsPage";
import GradesPage from "./pages/GradesPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import AssignmentEditorPage from "./pages/AssignmentEditorPage";
import AssignmentViewerPage from "./pages/AssignmentViewerPage";
import AssignmentGradePage from "./pages/AssignmentGradePage";
import AssignmentSubmissionDetailsPage from "./pages/AssignmentSubmissionDetailsPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import DiscussionEditorPage from "./pages/DiscussionEditorPage";
import DiscussionTopicPage from "./pages/DiscussionTopicPage";
import DiscussionGradePage from "./pages/DiscussionGradePage";
import QuizzesPage from "./pages/QuizzesPage";
import QuestionBanksPage from "./pages/QuestionBanksPage";
import QuestionBankEditorPage from "./pages/QuestionBankEditorPage";
import QuizEditorPage from "./pages/QuizEditorPage";
import QuizViewerPage from "./pages/QuizViewerPage";
import QuizTakePage from "./pages/QuizTakePage";
import QuizStatisticsPage from "./pages/QuizStatisticsPage";
import QuizSpeedGraderPage from "./pages/QuizSpeedGraderPage";
import QuizSimilarityReportPage from "./pages/QuizSimilarityReportPage";
import QuizSubmissionDetailsPage from "./pages/QuizSubmissionDetailsPage";
import QuizModeratePage from "./pages/QuizModeratePage";
import PeoplePage from "./pages/PeoplePage";
import PeopleAccommodationsPage from "./pages/PeopleAccommodationsPage";
import PeopleSectionsPage from "./pages/PeopleSectionsPage";
import PeopleGroupsPage from "./pages/PeopleGroupsPage";
import SyllabusPage from "./pages/SyllabusPage";
import RubricsPage from "./pages/RubricsPage";
import GroupHomePage from "./pages/GroupHomePage";
import AttendancePage from "./pages/AttendancePage";
import CollaborationsPage from "./pages/CollaborationsPage";
import { runAppointmentReminders } from "./utils/appointmentReminders";

function MainLayout() {
  const [helpOpen, setHelpOpen] = useState(false);
  const user = useUser();
  const location = useLocation();

  const onFocusSearch = useCallback(() => focusGlobalNavSearch(), []);
  const onOpenGlobalSearch = useCallback(() => openGlobalSearch(), []);

  useGlobalKeyboardShortcuts({
    onFocusSearch,
    onOpenHelp: () => setHelpOpen(true),
    onOpenGlobalSearch,
  });

  useEffect(() => {
    runAppointmentReminders();
    const id = window.setInterval(() => runAppointmentReminders(), 60_000);
    return () => window.clearInterval(id);
  }, [user.id]);

  return (
    <AuthGate>
      <ToastProvider>
        <div className="app-shell paper-grain flex min-h-screen flex-col bg-arc-paper text-arc-ink md:flex-row">
          <div className="print-hide">
            <GlobalNav />
          </div>
          <main className="app-main min-h-0 min-w-0 flex-1 overflow-auto">
            {/* Remount route tree when demo persona / effective user changes */}
            <AppErrorBoundary
              key={location.pathname}
              fallbackTitle="This view hit an error"
            >
              <Outlet key={user.id} />
            </AppErrorBoundary>
          </main>
          <StudioTour />
          <KeyboardShortcutsSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
        </div>
      </ToastProvider>
    </AuthGate>
  );
}

function CourseCalendarRedirect() {
  const { courseId } = useParams();
  const search = courseId ? `?course=${encodeURIComponent(courseId)}` : "";
  return <Navigate to={`/calendar${search}`} replace />;
}

export default function App() {
  return (
    <>
      <SplashScreen />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/portfolio/:studentId/public" element={<PublicPortfolioPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesCatalogPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/help" element={<HelpPage />} />

          <Route path="/courses/:courseId" element={<CourseLayout />}>
            <Route path="home" element={<CourseHomePage />} />
            <Route index element={<CourseHomePage />} />
            <Route path="modules" element={<ModulesPage />} />
            <Route path="modules/unavailable" element={<ModuleItemUnavailablePage />} />
            <Route path="pages" element={<PagesPage />} />
            <Route path="pages/:pageId" element={<PageEditorPage />} />
            <Route path="pages/:pageId/view" element={<PageViewerPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="files/:fileId" element={<FilePreviewPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="announcements/new" element={<AnnouncementEditorPage />} />
            <Route
              path="announcements/:announcementId/edit"
              element={<AnnouncementEditorPage />}
            />
            <Route path="announcements/:announcementId" element={<AnnouncementViewerPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="assignments/new" element={<AssignmentEditorPage />} />
            <Route path="assignments/:assignmentId/edit" element={<AssignmentEditorPage />} />
            <Route path="assignments/:assignmentId/submission" element={<AssignmentSubmissionDetailsPage />} />
            <Route path="assignments/:assignmentId/grade" element={<AssignmentGradePage />} />
            <Route path="assignments/:assignmentId" element={<AssignmentViewerPage />} />
            <Route path="quizzes" element={<QuizzesPage />} />
            <Route path="question-banks" element={<QuestionBanksPage />} />
            <Route path="question-banks/:bankId" element={<QuestionBankEditorPage />} />
            <Route path="quizzes/new" element={<QuizEditorPage />} />
            <Route path="quizzes/:quizId/edit" element={<QuizEditorPage />} />
            <Route path="quizzes/:quizId/take" element={<QuizTakePage />} />
            <Route path="quizzes/:quizId/submission" element={<QuizSubmissionDetailsPage />} />
            <Route path="quizzes/:quizId/statistics" element={<QuizStatisticsPage />} />
            <Route path="quizzes/:quizId/similarity" element={<QuizSimilarityReportPage />} />
            <Route path="quizzes/:quizId/moderate" element={<QuizModeratePage />} />
            <Route path="quizzes/:quizId/grade" element={<QuizSpeedGraderPage />} />
            <Route path="quizzes/:quizId" element={<QuizViewerPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="discussions/new" element={<DiscussionEditorPage />} />
            <Route path="discussions/:topicId/edit" element={<DiscussionEditorPage />} />
            <Route path="discussions/:topicId/grade" element={<DiscussionGradePage />} />
            <Route path="discussions/:topicId" element={<DiscussionTopicPage />} />
            <Route path="grades" element={<GradesPage />} />
            <Route path="syllabus" element={<SyllabusPage />} />
            <Route path="rubrics" element={<RubricsPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/sections" element={<PeopleSectionsPage />} />
            <Route path="people/groups" element={<PeopleGroupsPage />} />
            <Route path="people/accommodations" element={<PeopleAccommodationsPage />} />
            <Route path="groups/:groupId" element={<GroupHomePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="collaborations" element={<CollaborationsPage />} />
            <Route path="calendar" element={<CourseCalendarRedirect />} />
            <Route path="settings" element={<CourseSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
