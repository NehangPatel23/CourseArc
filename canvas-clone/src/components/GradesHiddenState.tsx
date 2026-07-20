import GradeEmptyState from "./GradeEmptyState";
import { getStudentGradePublishStatus } from "../utils/gradeVisibility";

export default function GradesHiddenState({
  courseId,
  studentId,
  compact = false,
}: {
  courseId: string;
  studentId: string;
  compact?: boolean;
}) {
  const status = getStudentGradePublishStatus(courseId, studentId);
  const individuallyHidden = status === "hidden";

  return (
    <GradeEmptyState
      compact={compact}
      title="Grades not posted yet"
      subtitle={
        individuallyHidden
          ? "Your grades are not currently visible. Contact your instructor if you have questions."
          : "Your instructor has not posted grades for this course. Check back later."
      }
    />
  );
}
