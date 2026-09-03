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
          className="mb-1 block text-sm font-medium text-arc-ink"
        >
          Module Name
        </label>
        <input
          id="edit-module-title"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="form-input"
          placeholder="Enter new module title"
        />

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-canvas-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-canvas-primary"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
