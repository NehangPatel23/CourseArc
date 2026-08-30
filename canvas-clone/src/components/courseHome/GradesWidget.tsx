import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../icons/Icon";
import HiddenGradeIndicator from "../HiddenGradeIndicator";
import { buildStudentGrades } from "../../utils/gradebook";
import { GRADE_PUBLISH_CHANGED_EVENT } from "../../utils/gradeVisibility";

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-arc-ink/10 pb-5">
      <h3 className="font-display text-lg font-medium italic text-arc-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function GradesWidget({
  courseId,
  showGradesLink,
}: {
  courseId: string;
  showGradesLink: boolean;
}) {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  const grades = useMemo(
    () => buildStudentGrades(courseId),
    [courseId, refreshTick],
  );

  return (
    <WidgetCard title="Grades">
      {grades.columns.length === 0 ? (
        <p className="text-sm text-arc-mute">No grade data available yet.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              {grades.showLetterGrades && (
                <p className="text-2xl font-bold text-arc-ink">
                  {grades.letterVisible ? (
                    grades.letter
                  ) : (
                    <HiddenGradeIndicator label="Letter grade not posted" />
                  )}
                </p>
              )}
              {grades.showOverallPercent && (
                <p
                  className={`text-sm text-arc-mute ${
                    grades.showLetterGrades ? "mt-0.5" : ""
                  }`}
                >
                  {grades.overallPercentVisible ? (
                    <>{grades.overallPercent}% overall</>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <HiddenGradeIndicator label="Average not posted" />
                      <span className="text-xs">overall hidden</span>
                    </span>
                  )}
                </p>
              )}
              {!grades.showLetterGrades && !grades.showOverallPercent && (
                <p className="text-sm text-arc-mute">Overall summary hidden</p>
              )}
            </div>
            <Icon name="cap" size={28} className="text-arc-copper opacity-60" />
          </div>
          {!(grades.overallPercentVisible || grades.letterVisible || grades.gradesVisible) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
              <Icon name="eyeOff" size={12} />
              Grades not posted yet
            </p>
          )}
          {showGradesLink && (
            <Link
              to={`/courses/${courseId}/grades`}
              className="mt-3 inline-block text-sm text-arc-copper hover:underline"
            >
              View gradebook →
            </Link>
          )}
        </>
      )}
    </WidgetCard>
  );
}
