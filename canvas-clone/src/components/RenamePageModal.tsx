import { useEffect, useState } from "react";
import CanvasModal from "./CanvasModal";

type Props = {
  isOpen: boolean;
  initialTitle: string;
  initialModuleTitle: string;
  onClose: () => void;
  onRename: (newTitle: string) => void;
};

export default function RenamePageModal({
  isOpen,
  initialTitle,
  initialModuleTitle,
  onClose,
  onRename,
}: Props) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTitle);
    const t = window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("#rename-page-title")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen, initialTitle]);

  if (!isOpen) return null;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onClose();
  };

  return (
    <CanvasModal title="Rename Page" onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Current module:{" "}
            <span className="font-medium text-gray-700">
              {initialModuleTitle}
            </span>
          </div>

          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            New page title
          </label>
          <input
            id="rename-page-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
            placeholder="Enter new page name"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-canvas-grayDark bg-white hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
