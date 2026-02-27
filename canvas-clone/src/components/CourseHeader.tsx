// src/components/CourseHeader.tsx

import { useParams, useLocation, useNavigate } from "react-router-dom";
import { mockCourses } from "../data/mockData";
import { useState } from "react";
import { Eye } from "lucide-react";
import { useStudentView } from "../utils/studentView";

export default function CourseHeader() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  if (!courseId) return null;

  const course = mockCourses.find((c) => String(c.id) === courseId);
  const [isPublished, setIsPublished] = useState(true);

  const { studentView, toggleStudentView } = useStudentView(courseId);

  if (!course) return null;

  const handleToggleStudentView = () => {
    const nextStudentView = !studentView;

    // 1) Flip the global student view state
    toggleStudentView();

    // 2) If we're on a page route, swap between editor <-> viewer
    //    /courses/:courseId/pages/:pageId         (editor)
    //    /courses/:courseId/pages/:pageId/view    (viewer)
    const path = location.pathname;

    const pageEditorRe = new RegExp(`^/courses/${courseId}/pages/([^/]+)$`);
    const pageViewerRe = new RegExp(
      `^/courses/${courseId}/pages/([^/]+)/view$`,
    );

    const viewerMatch = path.match(pageViewerRe);
    const editorMatch = path.match(pageEditorRe);

    if (nextStudentView) {
      // Turning student view ON -> ensure we're on /view if currently on a page editor
      if (editorMatch) {
        const pid = editorMatch[1]; // already URL-safe
        navigate(`/courses/${courseId}/pages/${pid}/view`, { replace: true });
      }
      // If not on a page, stay put (Modules etc. can remain as-is).
      return;
    }

    // Turning student view OFF -> ensure we're on editor if currently on page viewer
    if (viewerMatch) {
      const pid = viewerMatch[1];
      navigate(`/courses/${courseId}/pages/${pid}`, { replace: true });
    }
  };

  return (
    <div className="bg-white border-b border-canvas-border px-10 py-6 flex items-center justify-between shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-canvas-grayDark">
          {course.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {course.term} • {course.code}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* ✅ Student view global button */}
        <button
          type="button"
          onClick={handleToggleStudentView}
          className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-all flex items-center gap-2 ${
            studentView
              ? "bg-[#008EE2] border-[#008EE2] text-white hover:bg-[#0079C2]"
              : "border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
          }`}
          title={
            studentView
              ? "Student view ON (enforces gating + progress behavior)"
              : "Student view OFF (instructor preview: ignores gating, no progress writes)"
          }
        >
          <Eye className="w-4 h-4" />
          {studentView ? "Exit Student View" : "Enter Student View"}
        </button>

        <div className="h-5 w-px bg-gray-300 mx-1"></div>

        <button
          onClick={() => setIsPublished(!isPublished)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-all ${
            isPublished
              ? "border-canvas-blue text-canvas-blue bg-white hover:bg-canvas-blue hover:text-white"
              : "border-canvas-green text-canvas-green bg-white hover:bg-canvas-green hover:text-white"
          }`}
        >
          {isPublished ? "Unpublish" : "Publish"}
        </button>

        {isPublished ? (
          <div className="flex items-center gap-2 text-sm font-medium text-canvas-green">
            <span className="w-2.5 h-2.5 rounded-full bg-canvas-green inline-block shadow-sm"></span>
            Published
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block shadow-sm"></span>
            Unpublished
          </div>
        )}

        <div className="h-5 w-px bg-gray-300 mx-1"></div>

        <button className="px-4 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition-all">
          Settings
        </button>

        <button className="px-4 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition-all">
          Edit
        </button>
      </div>
    </div>
  );
}
