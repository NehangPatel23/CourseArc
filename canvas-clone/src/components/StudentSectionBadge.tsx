import { getSectionForStudent } from "../utils/courseSections";
import { loadUser } from "../utils/userStore";

export default function StudentSectionBadge({
  courseId,
  studentView,
}: {
  courseId: string;
  studentView: boolean;
}) {
  if (!studentView) return null;
  const section = getSectionForStudent(courseId, loadUser().id);
  if (!section) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-canvas-blueTint px-2.5 py-0.5 text-xs font-semibold text-canvas-blue"
      data-testid="student-section-chip"
    >
      You’re in {section.name}
    </span>
  );
}
