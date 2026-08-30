// src/pages/AnnouncementsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { Plus, Trash2, Pencil, Pin, PinOff } from "lucide-react";
import Tooltip from "../components/ui/Tooltip";
import { useStudentView } from "../hooks/useStudentView";
import { usePermissions } from "../utils/permissions";
import {
  announcementPreview,
  announcementsKey,
  autoPublishIfNeeded,
  isStudentVisibleAnnouncement,
  loadAnnouncements,
  saveAnnouncements,
  type Announcement,
} from "../utils/announcements";

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";

  const studentView = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();

  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    loadAnnouncements(effectiveCourseId),
  );

  // Cross-tab sync + same-tab custom events
  useEffect(() => {
    const refresh = () =>
      setAnnouncements(loadAnnouncements(effectiveCourseId));

    const onStorage = (e: StorageEvent) => {
      if (e.key === announcementsKey(effectiveCourseId)) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:announcementsChanged", refresh as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:announcementsChanged",
        refresh as any,
      );
    };
  }, [effectiveCourseId]);

  // auto-publish tick (same tab)
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();

      setAnnouncements((prev) => {
        const next = prev.map((a) => autoPublishIfNeeded(a, now));

        const changed = next.some(
          (a, i) =>
            a.status !== prev[i]?.status ||
            a.publishedAt !== prev[i]?.publishedAt,
        );

        if (changed) saveAnnouncements(effectiveCourseId, next);
        return changed ? next : prev;
      });
    }, 15000);

    return () => window.clearInterval(id);
  }, [effectiveCourseId]);

  const fromHere = location.pathname + location.search;

  const published = useMemo(() => {
    const now = Date.now();

    const list = studentView
      ? announcements.filter((a) => isStudentVisibleAnnouncement(a, now))
      : announcements
          .map((a) => autoPublishIfNeeded(a, now))
          .filter((a) => a.status === "published");

    return [...list].sort((a, b) => {
      // pinned first
      if (!!a.pinned && !b.pinned) return -1;
      if (!a.pinned && !!b.pinned) return 1;
      return (b.publishedAt ?? b.postedAt) - (a.publishedAt ?? a.postedAt);
    });
  }, [announcements, studentView]);

  const drafts = useMemo(() => {
    if (studentView) return [];
    return [...announcements]
      .filter((a) => a.status === "draft")
      .sort((a, b) => b.postedAt - a.postedAt);
  }, [announcements, studentView]);

  const removeAnnouncement = (id: string) => {
    const next = announcements.filter((x) => x.id !== id);
    setAnnouncements(next);
    saveAnnouncements(effectiveCourseId, next);
  };

  const togglePinned = (id: string) => {
    const next = announcements.map((a) =>
      a.id === id ? { ...a, pinned: !a.pinned } : a,
    );
    setAnnouncements(next);
    saveAnnouncements(effectiveCourseId, next);
  };

  const openViewer = (a: Announcement) => {
    navigate(`/courses/${effectiveCourseId}/announcements/${a.id}`, {
      state: { from: fromHere },
    });
  };

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-8 py-8 overflow-y-auto bg-white">
        <div className="w-full">
          <PageIdentityHeader
            size="md"
            icon="megaphone"
            label="Announcements"
            title="Announcements"
            description={
              studentView
                ? "Course announcements."
                : "Create drafts, schedule, then publish when ready."
            }
            actions={
              canEdit ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/courses/${effectiveCourseId}/announcements/new`, {
                      state: { from: fromHere },
                    })
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-canvas-blue hover:bg-canvas-blueDark text-white text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  New Announcement
                </button>
              ) : undefined
            }
          />

          {/* Published */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="text-sm font-semibold text-canvas-grayDark">
                Published
              </div>
            </div>

            <div className="p-5">
              {published.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No published announcements yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {published.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                      onClick={() => openViewer(a)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openViewer(a);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-canvas-grayDark truncate">
                            {a.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(
                              a.publishedAt ?? a.postedAt,
                            ).toLocaleString()}
                          </div>
                        </div>

                        {canEdit && (
                          <div
                            className="flex items-center gap-2 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip label={a.pinned ? "Unpin" : "Pin"}>
                              <button
                                type="button"
                                onClick={() => togglePinned(a.id)}
                                aria-label={a.pinned ? "Unpin announcement" : "Pin announcement"}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                              >
                                {a.pinned ? (
                                  <PinOff className="h-4 w-4" />
                                ) : (
                                  <Pin className="h-4 w-4" />
                                )}
                              </button>
                            </Tooltip>

                            <Tooltip label="Edit">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/courses/${effectiveCourseId}/announcements/${a.id}/edit`,
                                    { state: { from: fromHere } },
                                  )
                                }
                                aria-label="Edit announcement"
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </Tooltip>

                            <Tooltip label="Delete">
                              <button
                                type="button"
                                onClick={() => removeAnnouncement(a.id)}
                                aria-label="Delete announcement"
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {a.body
                        ? (() => {
                            const p = announcementPreview(a.body, 240);

                            return (
                              <div className="mt-3 relative">
                                <div
                                  className={[
                                    "text-sm text-gray-700 whitespace-pre-wrap line-clamp-3",
                                    p.containsCode
                                      ? "font-mono text-[12px] bg-gray-50 border border-gray-200 rounded-md p-3"
                                      : "",
                                  ].join(" ")}
                                >
                                  {p.text}
                                </div>

                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />

                                {p.truncated && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openViewer(a);
                                    }}
                                    className="absolute right-0 bottom-0 translate-y-[22px] text-xs font-medium text-canvas-blue hover:underline"
                                  >
                                    View more →
                                  </button>
                                )}
                              </div>
                            );
                          })()
                        : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drafts (instructor only) */}
          {!studentView && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-canvas-grayDark">
                  Drafts
                </div>
                <div className="text-xs text-gray-500">
                  Visible to instructors only
                </div>
              </div>

              <div className="p-5">
                {drafts.length === 0 ? (
                  <div className="text-sm text-gray-600">No drafts.</div>
                ) : (
                  <div className="space-y-3">
                    {drafts.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                        onClick={() => openViewer(a)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") openViewer(a);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-canvas-grayDark truncate">
                                {a.title}
                              </div>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200">
                                Draft
                              </span>

                              {typeof a.publishAt === "number" &&
                                Number.isFinite(a.publishAt) && (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                                    Scheduled{" "}
                                    {new Date(a.publishAt).toLocaleString()}
                                  </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Saved {new Date(a.postedAt).toLocaleString()}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip label="Edit">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/courses/${effectiveCourseId}/announcements/${a.id}/edit`,
                                    { state: { from: fromHere } },
                                  )
                                }
                                aria-label="Edit announcement"
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </Tooltip>

                            <Tooltip label="Delete">
                              <button
                                type="button"
                                onClick={() => removeAnnouncement(a.id)}
                                aria-label="Delete announcement"
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>

                        {a.body
                          ? (() => {
                              const p = announcementPreview(a.body, 200);

                              return (
                                <div className="mt-3 relative">
                                  <div
                                    className={[
                                      "text-sm text-gray-700 whitespace-pre-wrap line-clamp-3",
                                      p.containsCode
                                        ? "font-mono text-[12px] bg-gray-50 border border-gray-200 rounded-md p-3"
                                        : "",
                                    ].join(" ")}
                                  >
                                    {p.text}
                                  </div>

                                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />

                                  {p.truncated && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openViewer(a);
                                      }}
                                      className="absolute right-0 bottom-0 translate-y-[22px] text-xs font-medium text-canvas-blue hover:underline"
                                    >
                                      View more →
                                    </button>
                                  )}
                                </div>
                              );
                            })()
                          : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
