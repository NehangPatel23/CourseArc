import { Link } from "react-router-dom";
import { getGradeSnapshot } from "../../../data/mockData";
import { loadCourses } from "../../../utils/coursesStore";

export default function GradesSnapshot({ studentView }: { studentView: boolean }) {
  if (!studentView) return null;

  const courses = loadCourses().filter((c) => c.published && !c.archived);

  return (
    <ul className="space-y-2">
      {courses.map((c) => {
        const grade = getGradeSnapshot(c.id);
        return (
          <li key={c.id}>
            <Link
              to={`/courses/${c.id}/grades`}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-canvas-grayLight dark:hover:bg-gray-800"
            >
              <span className="truncate text-gray-600 dark:text-gray-300">{c.short_name}</span>
              <span className="font-semibold tabular-nums text-canvas-grayDark dark:text-white">
                {grade.letter}{" "}
                <span className="text-xs font-normal text-gray-400">({grade.percent}%)</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
