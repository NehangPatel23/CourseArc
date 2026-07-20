import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import ConfirmActionModal from "./ConfirmActionModal";
import {
  getStudentGradePublishStatus,
  isColumnGradeVisible,
  isGradeVisibleToStudent,
  setStudentGradePublished,
  setStudentItemGradePublished,
  toggleStudentGradeVisibility,
} from "../utils/gradeVisibility";
import { useToast } from "./ui/Toast";

export default function GradePublishButton({
  courseId,
  studentId,
  columnKey,
  variant = "dark",
  onChange,
  confirm = true,
}: {
  courseId: string;
  studentId: string;
  /** When set, posts/hides only this item for the student. */
  columnKey?: string;
  variant?: "dark" | "light";
  onChange?: () => void;
  confirm?: boolean;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<"post" | "hide" | null>(null);

  const visible = columnKey
    ? isColumnGradeVisible(courseId, columnKey, studentId)
    : isGradeVisibleToStudent(courseId, studentId);
  const status = getStudentGradePublishStatus(courseId, studentId);

  const apply = (nextVisible: boolean) => {
    if (columnKey) {
      setStudentItemGradePublished(courseId, studentId, columnKey, nextVisible);
      showToast(
        nextVisible ? "Item grade posted for student" : "Item grade hidden from student",
        "positive",
      );
    } else if (nextVisible) {
      setStudentGradePublished(courseId, studentId, true);
      showToast("Grade posted for student", "positive");
    } else {
      setStudentGradePublished(courseId, studentId, false);
      showToast("Grade hidden from student", "positive");
    }
    onChange?.();
  };

  const handleClick = () => {
    const next = !visible;
    if (confirm) {
      setPending(next ? "post" : "hide");
      return;
    }
    apply(next);
  };

  const btnClass =
    variant === "dark"
      ? "rounded px-2 py-1 text-xs hover:bg-white/10"
      : "rounded p-1.5 text-gray-500 hover:bg-gray-100";

  const label =
    status === "published"
      ? "Posted"
      : status === "hidden"
        ? "Hidden"
        : visible
          ? "Visible"
          : "Not posted";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 ${btnClass}`}
        title={visible ? "Hide grade from student" : "Post grade for student"}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        <span className="hidden sm:inline">{label}</span>
      </button>

      <ConfirmActionModal
        isOpen={pending != null}
        title={pending === "post" ? "Post grade for student?" : "Hide grade from student?"}
        description={
          pending === "post"
            ? "This student will be able to see this grade and feedback."
            : "This student will no longer see this grade or instructor feedback."
        }
        confirmText={pending === "post" ? "Post grade" : "Hide grade"}
        tone={pending === "hide" ? "danger" : "primary"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) apply(pending === "post");
        }}
      />
    </>
  );
}

export function GradePublishRowButton({
  courseId,
  studentId,
  onChange,
  confirm = true,
}: {
  courseId: string;
  studentId: string;
  onChange?: () => void;
  confirm?: boolean;
}) {
  const visible = isGradeVisibleToStudent(courseId, studentId);
  const status = getStudentGradePublishStatus(courseId, studentId);
  const [open, setOpen] = useState(false);

  const apply = () => {
    toggleStudentGradeVisibility(courseId, studentId);
    onChange?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (confirm) setOpen(true);
          else apply();
        }}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
        title={
          status === "published"
            ? "Individually posted — click to hide"
            : status === "hidden"
              ? "Individually hidden — click to reset"
              : visible
                ? "Following class post — click to hide"
                : "Not posted — click to post for student"
        }
      >
        {visible ? (
          <Eye className="h-4 w-4 text-canvas-green" />
        ) : (
          <EyeOff className="h-4 w-4 text-gray-400" />
        )}
      </button>

      <ConfirmActionModal
        isOpen={open}
        title={visible ? "Hide grades for this student?" : "Post grades for this student?"}
        description={
          visible
            ? "This student will no longer see their grades until visibility is restored."
            : "This student will be able to see their grades for this course."
        }
        confirmText={visible ? "Hide grades" : "Post grades"}
        tone={visible ? "danger" : "primary"}
        onClose={() => setOpen(false)}
        onConfirm={apply}
      />
    </>
  );
}
