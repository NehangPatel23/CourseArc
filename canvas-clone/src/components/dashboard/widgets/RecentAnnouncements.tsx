import { Link } from "react-router-dom";
import { useState } from "react";
import {
  loadAnnouncements,
  isStudentVisibleAnnouncement,
} from "../../../utils/announcements";
import { markAnnouncementRead } from "../../../utils/activity";
import { getUnreadAnnouncementCount } from "../../../utils/activity";
import { loadCourses } from "../../../utils/coursesStore";
import StatusAlert from "../../ui/StatusAlert";

export default function RecentAnnouncements({ studentView }: { studentView: boolean }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const courses = loadCourses().filter((c) => (studentView ? c.published : true));

  const items = courses
    .flatMap((c) => {
      const unread = getUnreadAnnouncementCount(c.id);
      return loadAnnouncements(c.id)
        .filter((a) => (studentView ? isStudentVisibleAnnouncement(a) : true))
        .map((a) => ({ ...a, courseId: c.id, courseName: c.short_name, unreadCount: unread }));
    })
    .sort((a, b) => b.postedAt - a.postedAt);

  const filtered = unreadOnly
    ? items.filter((a) => {
        const read = getUnreadAnnouncementCount(a.courseId);
        return read > 0;
      })
    : items;

  const display = filtered.slice(0, 5);
  const totalUnread = courses.reduce((s, c) => s + getUnreadAnnouncementCount(c.id), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        {totalUnread > 0 ? (
          <StatusAlert tone="negative">{totalUnread} unread</StatusAlert>
        ) : (
          <StatusAlert tone="positive">All read</StatusAlert>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Unread only
        </label>
      </div>
      {!display.length ? (
        <p className="text-sm text-gray-500">No announcements.</p>
      ) : (
        <ul className="space-y-2">
          {display.map((a) => (
            <li key={`${a.courseId}-${a.id}`}>
              <Link
                to={`/courses/${a.courseId}/announcements/${a.id}`}
                onClick={() => markAnnouncementRead(a.courseId, a.id)}
                className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas-grayLight"
              >
                <span className="font-medium text-canvas-grayDark">{a.title}</span>
                <span className="ml-2 text-xs text-gray-400">{a.courseName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
