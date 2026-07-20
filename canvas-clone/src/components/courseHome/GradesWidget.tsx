import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff, GraduationCap } from "lucide-react";
import HiddenGradeIndicator from "../HiddenGradeIndicator";
import { buildStudentGrades } from "../../utils/gradebook";
import { GRADE_PUBLISH_CHANGED_EVENT } from "../../utils/gradeVisibility";

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-sm font-semibold text-canvas-grayDark">{title}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
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
        <p className="text-sm text-gray-600">No grade data available yet.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              {grades.showLetterGrades && (
                <p className="text-2xl font-bold text-canvas-grayDark">
                  {grades.letterVisible ? (
                    grades.letter
                  ) : (
                    <HiddenGradeIndicator label="Letter grade not posted" />
                  )}
                </p>
              )}
              {grades.showOverallPercent && (
                <p
                  className={`text-sm text-gray-500 ${
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
                <p className="text-sm text-gray-600">Overall summary hidden</p>
              )}
            </div>
            <GraduationCap className="h-8 w-8 text-canvas-blue opacity-60" />
          </div>
          {!(grades.overallPercentVisible || grades.letterVisible || grades.gradesVisible) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
              <EyeOff className="h-3 w-3" />
              Grades not posted yet
            </p>
          )}
          {showGradesLink && (
            <Link
              to={`/courses/${courseId}/grades`}
              className="mt-3 inline-block text-sm text-canvas-blue hover:underline"
            >
              View gradebook →
            </Link>
          )}
        </>
      )}
    </WidgetCard>
  );
}
