import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageSquare,
  PenLine,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteNotification,
  deleteReadNotifications,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type AppNotification,
  type NotificationKind,
} from "../utils/notifications";
import { getCourseById } from "../utils/coursesStore";
import { studentViewEventName, useStudentView } from "../utils/studentView";

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case "grades_posted":
      return GraduationCap;
    case "announcement":
      return Megaphone;
    case "assignment_due":
      return ClipboardList;
    case "submission_received":
      return PenLine;
    case "quiz_submitted":
      return ClipboardList;
    case "discussion_submitted":
      return MessageSquare;
    default:
      return Bell;
  }
}

function kindLabel(kind: NotificationKind) {
  switch (kind) {
    case "grades_posted":
      return "Grades";
    case "announcement":
      return "Announcement";
    case "assignment_due":
      return "Due soon";
    case "submission_received":
      return "Submission";
    case "quiz_submitted":
      return "Quiz";
    case "discussion_submitted":
      return "Discussion";
    default:
      return "System";
  }
}

export default function NotificationsPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { studentView } = useStudentView();
  const [items, setItems] = useState<AppNotification[]>(() => loadNotifications());

  useEffect(() => {
    if (!open) return;
    setItems(loadNotifications());
    const refresh = () => setItems(loadNotifications());
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener(studentViewEventName, refresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(studentViewEventName, refresh);
    };
  }, [open, studentView]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const unreadCount = items.filter((n) => n.unread).length;
  const readCount = items.filter((n) => !n.unread).length;
  const roleLabel = studentView ? "Student" : "Instructor";

  const openItem = (n: AppNotification) => {
    markNotificationRead(n.id);
    setItems(loadNotifications());
    if (n.href) {
      onClose();
      navigate(n.href);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-panel-title"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-canvas-border px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-canvas-blue" />
              <h2
                id="notifications-panel-title"
                className="text-lg font-semibold text-canvas-grayDark"
              >
                Notifications
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{roleLabel} alerts</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllNotificationsRead();
                  setItems(loadNotifications());
                }}
                className="text-xs text-canvas-blue hover:underline"
              >
                Mark all read
              </button>
            )}
            {readCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  deleteReadNotifications();
                  setItems(loadNotifications());
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Clear read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-canvas-grayLight hover:text-canvas-grayDark"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-canvas-grayDark">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-gray-500">
                {studentView
                  ? "Grade posts, announcements, and due reminders appear here."
                  : "Submissions to grade, plus confirmations when you release grades or publish announcements."}
              </p>
            </div>
          ) : (
            <ul>
              {items.map((n) => {
                const course = n.courseId ? getCourseById(n.courseId) : null;
                const Icon = kindIcon(n.kind);
                return (
                  <li key={n.id} className="group relative border-b border-canvas-border/60">
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`w-full px-4 py-3 pr-10 text-left hover:bg-canvas-grayLight ${
                        n.unread ? "bg-canvas-blue/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            n.unread ? "bg-canvas-blue/10 text-canvas-blue" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {n.unread && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-canvas-blue" />
                            )}
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {kindLabel(n.kind)}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 text-sm ${
                              n.unread
                                ? "font-semibold text-canvas-grayDark"
                                : "font-medium text-gray-700"
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {course ? `${course.code} · ` : ""}
                            {formatRelativeTime(n.timestamp)}
                          </p>
                        </div>
                      </div>
                    </button>
                    {!n.unread && (
                      <button
                        type="button"
                        title="Delete notification"
                        aria-label={`Delete ${n.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                          setItems(loadNotifications());
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-canvas-border px-4 py-3 text-center text-xs text-gray-500">
          Showing {roleLabel.toLowerCase()} alerts.{" "}
          <Link to="/inbox" onClick={onClose} className="text-canvas-blue hover:underline">
            Open Inbox for messages
          </Link>
        </div>
      </aside>
    </div>
  );
}
