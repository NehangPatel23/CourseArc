import { useState, useEffect } from "react";
import CanvasModal from "./CanvasModal";

interface EditModuleModalProps {
  initialTitle: string;
  onClose: () => void;
  onSave: (newTitle: string) => void;
}

export default function EditModuleModal({
  initialTitle,
  onClose,
  onSave,
}: EditModuleModalProps) {
  const [newTitle, setNewTitle] = useState(initialTitle);

  const handleSave = () => {
    if (newTitle.trim()) {
      onSave(newTitle.trim());
      onClose();
    }
  };

  // Autofocus on open
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("#edit-module-title");
    input?.focus();
  }, []);

  return (
    <CanvasModal title="Edit Module Name" onClose={onClose} size="sm">
      <div>
        {/* Input field */}
        <label
          htmlFor="edit-module-title"
          className="block text-sm font-medium text-canvas-grayDark mb-1"
        >
          Module Name
        </label>
        <input
          id="edit-module-title"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
          placeholder="Enter new module title"
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-300 rounded-md text-canvas-grayDark bg-white hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md bg-canvas-blue text-white font-medium hover:bg-[#007ACC] transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
