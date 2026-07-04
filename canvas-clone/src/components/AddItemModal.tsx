import { useState } from "react";
import CanvasModal from "./CanvasModal";

interface AddItemModalProps {
  onClose: () => void;
  onAdd: (item: { type: string; label: string; url?: string }) => void;
}

export default function AddItemModal({ onClose, onAdd }: AddItemModalProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("page");
  const [url, setUrl] = useState("");

  function handleSubmit() {
    if (!label.trim()) return;

    if (type === "link" && !url.trim()) {
      alert("Please enter a valid URL for the link item.");
      return;
    }

    onAdd({ type, label, url: type === "link" ? url.trim() : undefined });
    onClose();
  }

  return (
    <CanvasModal title="Add New Item" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            Item Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
            placeholder="Enter item title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none bg-white"
          >
            <option value="page">Page</option>
            <option value="file">File</option>
            <option value="link">Link</option>
          </select>
        </div>

        {type === "link" && (
          <div>
            <label className="block text-sm font-medium text-canvas-grayDark mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
              placeholder="https://example.com"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-canvas-grayDark bg-white hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark transition-all"
          >
            Add Item
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
