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
      <div className="rounded-lg border border-dashed border-arc-ink/15 bg-arc-paper px-4 py-6 text-center">
        <p className="text-sm font-medium text-arc-ink">Not graded yet</p>
        <p className="mt-1 text-xs text-arc-mute">
          Your instructor hasn&apos;t posted a score for this item.
        </p>
      </div>
    );
  }

  const pct = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;

  return (
    <div className="border border-arc-ink/10 bg-arc-ivory px-4 py-4 text-center">
      <p className="font-display text-3xl font-medium tabular-nums text-arc-ink">
        {score}
        <span className="text-lg font-normal text-arc-mute"> / {maxPoints}</span>
      </p>
      <p className="mt-1 text-xs text-arc-mute">{pct}% score</p>
    </div>
  );
}
