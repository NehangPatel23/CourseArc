import { Eye, EyeOff } from "lucide-react";
import {
  isColumnPublishedForAll,
  setColumnGradesPublished,
} from "../utils/gradeVisibility";
import { useToast } from "./ui/Toast";

export default function GradeColumnPublishButton({
  courseId,
  columnKey,
  columnLabel,
  onChange,
  onRequestConfirm,
}: {
  courseId: string;
  columnKey: string;
  columnLabel: string;
  onChange?: () => void;
  /** When provided, click asks parent to confirm before applying. */
  onRequestConfirm?: (nextPublished: boolean) => void;
}) {
  const { showToast } = useToast();
  const published = isColumnPublishedForAll(courseId, columnKey);

  const apply = (next: boolean) => {
    setColumnGradesPublished(courseId, columnKey, next);
    showToast(
      next
        ? `${columnLabel} posted for all students`
        : `${columnLabel} hidden from students`,
      "positive",
    );
    onChange?.();
  };

  return (
    <button
      type="button"
      onClick={() => {
        const next = !published;
        if (onRequestConfirm) {
          onRequestConfirm(next);
          return;
        }
        apply(next);
      }}
      className="mt-1 inline-flex items-center gap-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      title={
        published
          ? `Hide ${columnLabel} from all students`
          : `Post ${columnLabel} for all students`
      }
      aria-label={
        published
          ? `Hide ${columnLabel} from all students`
          : `Post ${columnLabel} for all students`
      }
    >
      {published ? (
        <Eye className="h-3.5 w-3.5 text-canvas-green" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function applyColumnPublish(
  courseId: string,
  columnKey: string,
  published: boolean,
) {
  setColumnGradesPublished(courseId, columnKey, published);
}
