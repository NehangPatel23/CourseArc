// src/pages/AnnouncementViewerPage.tsx
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import { Megaphone, Pencil, ArrowLeft } from "lucide-react";
import RichContentViewer from "../components/RichContentViewer";
import { useStudentView } from "../hooks/useStudentView";

import { getCourseById } from "../utils/coursesStore";
import { resolveStudentBackPath } from "../utils/courseNavigation";
import {
  autoPublishIfNeeded,
  isStudentVisibleAnnouncement,
  loadAnnouncements,
  saveAnnouncements,
  type Announcement,
} from "../utils/announcements";

export default function AnnouncementViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, announcementId } = useParams();

  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const course = getCourseById(effectiveCourseId);
  const backTo = resolveStudentBackPath(
    effectiveCourseId,
    "announcements",
    course,
    (location.state as { from?: string } | null)?.from ??
      `/courses/${effectiveCourseId}/announcements`,
  );

  const all = useMemo(
    () => loadAnnouncements(effectiveCourseId),
    [effectiveCourseId],
  );

  // Ensure scheduled items become published + persist
  useEffect(() => {
    const now = Date.now();
    const next = all.map((a) => autoPublishIfNeeded(a, now));

    const changed = next.some(
      (a, i) =>
        a.status !== all[i]?.status || a.publishedAt !== all[i]?.publishedAt,
    );

    if (changed) saveAnnouncements(effectiveCourseId, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCourseId, all]);

  const announcement: Announcement | undefined = useMemo(() => {
    if (!announcementId) return undefined;
    return all.find((a) => a.id === announcementId);
  }, [all, announcementId]);

  // Access control:
  // - If missing -> bounce back
  // - If studentView and not student-visible -> bounce back
  useEffect(() => {
    if (!announcement) {
      navigate(backTo, { replace: true });
      return;
    }

    if (studentView) {
      const now = Date.now();
      if (!isStudentVisibleAnnouncement(announcement, now)) {
        navigate(backTo, { replace: true });
        return;
      }
    }
  }, [announcement, studentView, navigate, backTo]);

  if (!announcement) return null;

  const isPublished = announcement.status === "published";
  const timestamp = isPublished
    ? (announcement.publishedAt ?? announcement.postedAt)
    : announcement.postedAt;

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">
                  {announcement.title}
                </h1>

                {!studentView && (
                  <span
                    className={[
                      "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                      isPublished
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-700 border-gray-200",
                    ].join(" ")}
                  >
                    {isPublished ? "Published" : "Draft"}
                  </span>
                )}
              </div>

              <div className="mt-1 text-sm text-gray-600">
                {isPublished ? "Posted" : "Saved"}{" "}
                {new Date(timestamp).toLocaleString()}
              </div>
            </div>

            {/* Instructor-only actions */}
            {studentView ? null : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/courses/${effectiveCourseId}/announcements/${announcement.id}/edit`,
                      { state: { from: location.pathname + location.search } },
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-canvas-blue hover:bg-canvas-blueDark text-white text-sm font-medium"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5">
              {announcement.body ? (
                <RichContentViewer html={announcement.body} courseId={effectiveCourseId} />
              ) : (
                <div className="text-sm text-gray-500">
                  No additional details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
