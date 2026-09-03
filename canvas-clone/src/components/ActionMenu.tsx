import { useEffect, useRef } from "react";

interface ActionMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
  x?: number;
  y?: number;
}

export default function ActionMenu({ onEdit, onDelete, onClose, x, y }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        top: y ?? 0,
        left: x ?? 0,
      }}
      className="absolute bg-arc-paper border border-gray-200 rounded-md shadow-lg w-36 z-50 animate-fadeIn"
    >
      <button
        onClick={() => {
          onEdit?.();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700 transition-all"
      >
        Edit
      </button>
      <button
        onClick={() => {
          onDelete?.();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 transition-all"
      >
        Delete
      </button>
    </div>
  );
}
