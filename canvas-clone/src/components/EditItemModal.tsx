import { useState, useEffect } from "react";

interface EditItemModalProps {
  initialLabel: string;
  onClose: () => void;
  onSave: (newLabel: string) => void;
}

export default function EditItemModal({
  initialLabel,
  onClose,
  onSave,
}: EditItemModalProps) {
  const [newLabel, setNewLabel] = useState(initialLabel);
  const [closing, setClosing] = useState(false);

  const handleSave = () => {
    if (newLabel.trim()) {
      setClosing(true);
      setTimeout(() => {
        onSave(newLabel.trim());
      }, 200);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[999] transition-opacity duration-200 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-[420px] p-6 transform transition-all duration-200 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <h2 className="text-lg font-semibold text-canvas-grayDark mb-4">
          Edit Item
        </h2>

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Item Label
        </label>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white appearance-none focus:ring-2 focus:ring-canvas-blue focus:border-canvas-blue text-gray-900 outline-none transition"
          placeholder="Enter new item name"
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 bg-white transition-all"
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
    </div>
  );
}
