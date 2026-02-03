import CanvasModal from "./CanvasModal";
import type { ModuleRequirementsMode } from "../utils/modules";

export default function RequirementsModal({
  moduleTitle,
  initialMode,
  onClose,
  onSave,
}: {
  moduleTitle: string;
  initialMode: ModuleRequirementsMode;
  onClose: () => void;
  onSave: (mode: ModuleRequirementsMode) => void;
}) {
  return (
    <CanvasModal
      title={`Module Requirements — ${moduleTitle}`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Set how students progress through items in this module.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              defaultChecked={initialMode === "none"}
              onChange={() => onSave("none")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">No requirements</div>
              <div className="text-sm text-gray-600">
                All items are available; completion is optional.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              defaultChecked={initialMode === "all"}
              onChange={() => onSave("all")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">
                Complete all items
              </div>
              <div className="text-sm text-gray-600">
                Items can be completed in any order, but the module is not
                complete until all are done.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              defaultChecked={initialMode === "sequential"}
              onChange={() => onSave("sequential")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">
                Complete items sequentially
              </div>
              <div className="text-sm text-gray-600">
                Only the next incomplete item is unlocked; later items are
                locked until it is completed.
              </div>
            </div>
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
