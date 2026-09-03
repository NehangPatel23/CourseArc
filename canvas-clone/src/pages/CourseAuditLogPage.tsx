import { Link, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import AuditLogPanel from "../components/AuditLogPanel";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";

export default function CourseAuditLogPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { canEditCourseContent: canEdit } = usePermissions();

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex h-full w-full flex-col bg-transparent">
        <CourseHeader />
        <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
          <p className="text-sm text-gray-600">The audit log is available to course staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon="clipboard"
          label="Audit log"
          title="Who changed what"
          description="Answer keys, regrades, and score overrides for this course. Kept in this browser — and in a sync room if you join one."
        />
        <div className="mt-8 max-w-5xl">
          <AuditLogPanel courseId={effectiveCourseId} />
        </div>
      </div>
    </div>
  );
}
