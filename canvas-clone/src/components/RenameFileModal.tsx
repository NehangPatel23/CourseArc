import { useEffect, useState } from "react";
import CanvasModal from "./CanvasModal";

type Props = {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
};

function splitName(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

export default function RenameFileModal({
  isOpen,
  initialName,
  onClose,
  onRename,
}: Props) {
  const { base, ext } = splitName(initialName);

  const [baseName, setBaseName] = useState(base);

  useEffect(() => {
    if (!isOpen) return;
    setBaseName(base);
    const t = window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("#rename-file-name")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen, base, initialName]);

  if (!isOpen) return null;

  const submit = () => {
    const trimmed = baseName.trim();
    if (!trimmed) return;
    onRename(`${trimmed}${ext}`);
    onClose();
  };

  return (
    <CanvasModal title="Rename File" onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-canvas-grayDark mb-1">
            File name
          </label>

          <div className="flex items-center gap-2">
            <input
              id="rename-file-name"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue outline-none"
              placeholder="Enter new file name"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            {ext ? (
              <span className="text-sm text-gray-500 select-none whitespace-nowrap">
                {ext}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Extension is kept to avoid breaking file type detection.
          </p>
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
            disabled={!baseName.trim()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
