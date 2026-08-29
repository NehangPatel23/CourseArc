import { CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";
import { useLiveCourse } from "../hooks/useLiveCourse";
import { toggleCoursePublished } from "../utils/coursesStore";
import Tooltip from "./ui/Tooltip";
import { useToast } from "./ui/Toast";
import { usePermissions } from "../utils/permissions";

export type CoursePublishControlVariant = "icon" | "inline" | "settings";

function publishButtonClasses(
  published: boolean,
  variant: CoursePublishControlVariant,
): string {
  const publishedClasses =
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-green-200 bg-green-50 font-medium text-green-700 transition-colors hover:border-green-300 hover:bg-green-100";
  const unpublishedClasses =
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100";
  const tone = published ? publishedClasses : unpublishedClasses;

  if (variant === "icon") return `${tone} h-9 w-9`;
  if (variant === "settings") return `${tone} shrink-0 px-4 py-2 text-sm`;
  return `${tone} px-3 py-1.5 text-sm`;
}

export function useCoursePublishToggle(courseId: string) {
  const { showToast } = useToast();

  return () => {
    const next = toggleCoursePublished(courseId);
    if (next == null) return;
    showToast(next ? "Course published" : "Course unpublished", next ? "positive" : "negative");
  };
}

type Props = {
  courseId: string;
  variant?: CoursePublishControlVariant;
  className?: string;
};

export default function CoursePublishControl({
  courseId,
  variant = "inline",
  className = "",
}: Props) {
  const course = useLiveCourse(courseId);
  const toggle = useCoursePublishToggle(courseId);
  const { canPublishCourse } = usePermissions();
  if (!course || !canPublishCourse) return null;

  const published = course.published;
  const title = published
    ? "Published — click to unpublish"
    : "Unpublished — click to publish";
  const ariaLabel = published ? "Unpublish course" : "Publish course";

  const button = (
    <button
      type="button"
      onClick={toggle}
      title={variant === "icon" ? undefined : title}
      aria-label={ariaLabel}
      className={`${publishButtonClasses(published, variant)} ${className}`.trim()}
    >
      {variant === "icon" ? (
        published ? (
          <Eye className="h-4 w-4" aria-hidden />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden />
        )
      ) : variant === "settings" ? (
        published ? (
          <>
            <EyeOff className="h-4 w-4" aria-hidden />
            Unpublish course
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" aria-hidden />
            Publish course
          </>
        )
      ) : published ? (
        <>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Published
        </>
      ) : (
        <>
          <Circle className="h-4 w-4" aria-hidden />
          Publish
        </>
      )}
    </button>
  );

  if (variant === "icon") {
    return <Tooltip label={title}>{button}</Tooltip>;
  }

  return button;
}
