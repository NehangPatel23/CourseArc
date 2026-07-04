import { updateCourse } from "../../utils/coursesStore";
import { archiveCourse } from "../../utils/coursesStore";
import { useToast } from "../ui/Toast";

type Props = {
  selectedIds: string[];
  onClear: () => void;
  onDelete: () => void;
};

export default function BulkActionBar({ selectedIds, onClear, onDelete }: Props) {
  const { showToast } = useToast();

  const publish = (published: boolean) => {
    for (const id of selectedIds) {
      updateCourse(id, { published });
    }
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
    showToast(
      published ? `${selectedIds.length} course(s) published` : `${selectedIds.length} course(s) unpublished`,
      published ? "positive" : "neutral",
    );
    onClear();
  };

  const archiveSelected = () => {
    for (const id of selectedIds) archiveCourse(id);
    showToast(`${selectedIds.length} course(s) archived`, "neutral");
    onClear();
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-canvas-blue/10 px-4 py-3 dark:bg-canvas-blue/20">
      <span className="text-sm font-medium text-canvas-grayDark dark:text-gray-200">
        {selectedIds.length} selected
      </span>
      <button type="button" onClick={() => publish(true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
        Publish
      </button>
      <button type="button" onClick={() => publish(false)} className="rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
        Unpublish
      </button>
      <button type="button" onClick={archiveSelected} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
        Archive
      </button>
      <button type="button" onClick={onDelete} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
        Delete selected
      </button>
      <button type="button" onClick={onClear} className="ml-auto text-sm text-gray-500 hover:text-canvas-grayDark dark:text-gray-400">
        Clear selection
      </button>
    </div>
  );
}
