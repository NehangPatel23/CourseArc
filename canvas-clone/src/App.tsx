import { useCallback, useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import GlobalNav, { focusGlobalNavSearch, openGlobalSearch } from "./components/GlobalNav";
import KeyboardShortcutsSheet from "./components/KeyboardShortcutsSheet";
import SplashScreen from "./components/SplashScreen";
import DashboardPage from "./pages/DashboardPage";
import CoursesCatalogPage from "./pages/CoursesCatalogPage";
import CalendarPage from "./pages/CalendarPage";
import InboxPage from "./pages/InboxPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LoginPage from "./pages/LoginPage";
import HelpPage from "./pages/HelpPage";
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
import QuizEditorPage from "./pages/QuizEditorPage";
import QuizViewerPage from "./pages/QuizViewerPage";
import QuizTakePage from "./pages/QuizTakePage";
import QuizStatisticsPage from "./pages/QuizStatisticsPage";
import QuizSpeedGraderPage from "./pages/QuizSpeedGraderPage";
import QuizSubmissionDetailsPage from "./pages/QuizSubmissionDetailsPage";
import PeoplePage from "./pages/PeoplePage";

function MainLayout() {
  const [helpOpen, setHelpOpen] = useState(false);
  const user = useUser();

  const onFocusSearch = useCallback(() => focusGlobalNavSearch(), []);
  const onOpenGlobalSearch = useCallback(() => openGlobalSearch(), []);

  useGlobalKeyboardShortcuts({
    onFocusSearch,
    onOpenHelp: () => setHelpOpen(true),
    onOpenGlobalSearch,
  });

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-canvas-grayLight text-gray-900 md:flex-row">
        <GlobalNav />
        <main className="min-w-0 flex-1 overflow-auto">
          <AuthGate>
            {/* Remount route tree when demo persona / effective user changes */}
            <Outlet key={user.id} />
          </AuthGate>
        </main>
        <KeyboardShortcutsSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <>
      <SplashScreen />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesCatalogPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
            <Route path="quizzes/new" element={<QuizEditorPage />} />
            <Route path="quizzes/:quizId/edit" element={<QuizEditorPage />} />
            <Route path="quizzes/:quizId/take" element={<QuizTakePage />} />
            <Route path="quizzes/:quizId/submission" element={<QuizSubmissionDetailsPage />} />
            <Route path="quizzes/:quizId/statistics" element={<QuizStatisticsPage />} />
            <Route path="quizzes/:quizId/grade" element={<QuizSpeedGraderPage />} />
            <Route path="quizzes/:quizId" element={<QuizViewerPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="discussions/new" element={<DiscussionEditorPage />} />
            <Route path="discussions/:topicId/edit" element={<DiscussionEditorPage />} />
            <Route path="discussions/:topicId/grade" element={<DiscussionGradePage />} />
            <Route path="discussions/:topicId" element={<DiscussionTopicPage />} />
            <Route path="grades" element={<GradesPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="settings" element={<CourseSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
