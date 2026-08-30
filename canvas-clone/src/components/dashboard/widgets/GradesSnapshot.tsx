import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../icons/Icon";
import { buildStudentGrades } from "../../../utils/gradebook";
import { loadCourses } from "../../../utils/coursesStore";
import { GRADE_PUBLISH_CHANGED_EVENT } from "../../../utils/gradeVisibility";
import { loadUser } from "../../../utils/userStore";

export default function GradesSnapshot({ studentView }: { studentView: boolean }) {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  const courses = useMemo(
    () => loadCourses().filter((c) => c.published && !c.archived),
    [refreshTick],
  );
  const user = loadUser();

  if (!studentView) return null;

  return (
    <ul>
      {courses.map((c) => {
        const grade = buildStudentGrades(c.id, user.id);
        return (
          <li key={c.id}>
            <Link
              to={`/courses/${c.id}/grades`}
              className="flex items-center justify-between py-2 text-sm hover:text-arc-copper"
            >
              <span className="truncate text-arc-ink/75">{c.short_name}</span>
              {grade.overallPercentVisible || grade.letterVisible ? (
                <span className="font-display tabular-nums text-arc-ink">
                  {grade.showLetterGrades && grade.letterVisible && <>{grade.letter} </>}
                  {grade.showOverallPercent && grade.overallPercentVisible && (
                    <span className="text-xs font-normal text-arc-mute">
                      ({grade.overallPercent}%)
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-arc-mute">
                  <Icon name="eyeOff" size={12} />
                  Hidden
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
