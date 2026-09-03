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
      "published",
    );
    onClear();
  };

  const archiveSelected = () => {
    for (const id of selectedIds) archiveCourse(id);
    showToast(`${selectedIds.length} course(s) archived`, "neutral", "saved");
    onClear();
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-arc-ink/10 py-3">
      <span className="font-display text-sm italic text-arc-ink">
        {selectedIds.length} selected
      </span>
      <button type="button" onClick={() => publish(true)} className="text-sm text-arc-sage hover:underline">
        Publish
      </button>
      <button type="button" onClick={() => publish(false)} className="text-sm text-arc-mute hover:text-arc-ink hover:underline">
        Unpublish
      </button>
      <button type="button" onClick={archiveSelected} className="text-sm text-arc-gold hover:underline">
        Archive
      </button>
      <button type="button" onClick={onDelete} className="text-sm text-arc-brick hover:underline">
        Delete
      </button>
      <button type="button" onClick={onClear} className="ml-auto text-sm text-arc-mute hover:text-arc-ink">
        Clear
      </button>
    </div>
  );
}
