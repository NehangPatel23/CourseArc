import { Routes, Route, Outlet } from "react-router-dom";
import GlobalNav from "./components/GlobalNav";
import DashboardPage from "./pages/DashboardPage";
import CourseLayout from "./layouts/CourseLayout";
import CourseHomePage from "./pages/CourseHomePage";
import ModulesPage from "./pages/ModulesPage";
import PagesPage from "./pages/PagesPage";
import FilesPage from "./pages/FilesPage";
import PageEditorPage from "./pages/PageEditorPage";
import FilePreviewPage from "./pages/FilePreviewPage";
import PageViewerPage from "./pages/PageViewerPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import AnnouncementEditorPage from "./pages/AnnouncementEditorPage";
import AnnouncementViewerPage from "./pages/AnnouncementViewerPage";

function MainLayout() {
  return (
    <div className="flex min-h-screen bg-canvas-grayLight text-gray-900">
      <GlobalNav />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<DashboardPage />} />

        <Route path="/courses/:courseId" element={<CourseLayout />}>
          <Route path="home" element={<CourseHomePage />} />
          <Route index element={<CourseHomePage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="pages/:pageId" element={<PageEditorPage />} />
          <Route path="pages/:pageId/view" element={<PageViewerPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="files/:fileId" element={<FilePreviewPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route
            path="announcements/new"
            element={<AnnouncementEditorPage />}
          />
          <Route
            path="announcements/:announcementId/edit"
            element={<AnnouncementEditorPage />}
          />
          // ✅ NEW: View announcement page (Feature #3)
          <Route
            path="announcements/:announcementId"
            element={<AnnouncementViewerPage />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
