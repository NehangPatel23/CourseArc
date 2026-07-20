import GradesHiddenState from "./GradesHiddenState";
import { isItemGradeVisible } from "../utils/gradeVisibility";
import { loadUser } from "../utils/userStore";

export default function StudentGradeProScoreSection({
  courseId,
  columnKey,
  maxPoints,
  score,
  isGraded,
  studentId = loadUser().id,
}: {
  courseId: string;
  /** Gradebook column key, e.g. assignment:{id} */
  columnKey: string;
  maxPoints: number;
  score: number | null;
  isGraded: boolean;
  studentId?: string;
}) {
  const gradesVisible = isItemGradeVisible(courseId, columnKey, studentId);

  if (!gradesVisible) {
    return <GradesHiddenState courseId={courseId} studentId={studentId} compact />;
  }

  if (!isGraded || score == null) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-canvas-grayDark">Not graded yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Your instructor hasn&apos;t posted a score for this item.
        </p>
      </div>
    );
  }

  const pct = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-canvas-blueTint/40 to-white px-4 py-4 text-center">
      <p className="text-3xl font-semibold tabular-nums text-canvas-grayDark">
        {score}
        <span className="text-lg font-normal text-gray-400"> / {maxPoints}</span>
      </p>
      <p className="mt-1 text-xs text-gray-500">{pct}% score</p>
    </div>
  );
}
