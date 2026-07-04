import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { deleteCourses, getCourseById } from "../utils/coursesStore";
import { useToast } from "./ui/Toast";

type Props = {
  open: boolean;
  courseIds: string[];
  onClose: () => void;
  onDeleted?: () => void;
};

export default function DeleteCourseModal({
  open,
  courseIds,
  onClose,
  onDeleted,
}: Props) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");

  if (!open || courseIds.length === 0) return null;

  const courses = courseIds
    .map((id) => getCourseById(id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const isBulk = courses.length > 1;
  const requiredConfirm = isBulk ? "DELETE" : (courses[0]?.code ?? "");
  const canDelete =
    confirmText.trim().toUpperCase() === requiredConfirm.toUpperCase();

  const handleDelete = () => {
    if (!canDelete) return;
    const ids = courses.map((c) => c.id);
    deleteCourses(ids);
    showToast(
      isBulk ? `${ids.length} courses deleted` : `"${courses[0].title}" deleted`,
      "negative",
    );
    setConfirmText("");
    onClose();
    onDeleted?.();

    const onDeletedCourse = ids.some((id) =>
      window.location.pathname.startsWith(`/courses/${id}`),
    );
    if (onDeletedCourse) navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-canvas-grayDark">
            Delete {isBulk ? `${courses.length} courses` : "course"}?
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          This permanently removes the course{courses.length > 1 ? "s" : ""} and related local
          data. This cannot be undone.
        </div>

        <ul className="mb-4 max-h-32 space-y-1 overflow-y-auto text-sm text-gray-600">
          {courses.map((c) => (
            <li key={c.id}>
              <span className="font-medium text-canvas-grayDark">{c.title}</span>
              <span className="text-gray-400"> · {c.code}</span>
            </li>
          ))}
        </ul>

        <label className="block text-sm">
          <span className="font-medium text-gray-700">
            Type <strong>{requiredConfirm}</strong> to confirm
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            autoFocus
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
