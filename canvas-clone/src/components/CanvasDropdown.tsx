import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ReactNode } from "react";

export type CanvasDropdownEntry =
  | {
      type?: "item";
      label: string;
      onClick: () => void;
      variant?: "danger";
      disabled?: boolean;
      icon?: ReactNode; // ✅ NEW
    }
  | {
      type: "separator";
    };

interface CanvasDropdownProps {
  anchorRef?: RefObject<HTMLElement | null>;
  position?: { x: number; y: number };
  items: CanvasDropdownEntry[];
  onClose: () => void;
}

function CanvasDropdown({
  anchorRef,
  position,
  items,
  onClose,
}: CanvasDropdownProps) {
  const [closing, setClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const estimatedMenuHeight = useMemo(() => {
    const ITEM_H = 38;
    const SEP_H = 10;
    const PADDING = 16;

    return (
      items.reduce(
        (sum, it) => sum + (it.type === "separator" ? SEP_H : ITEM_H),
        0,
      ) + PADDING
    );
  }, [items]);

  function computePosition() {
    const rect = anchorRef?.current?.getBoundingClientRect();
    const GAP = 6;

    const bottomY = rect ? rect.bottom + window.scrollY : (position?.y ?? 0);
    const rightX = rect ? rect.right : (position?.x ?? 0);
    const spaceBelow = window.innerHeight - bottomY;
    const openUp = spaceBelow < estimatedMenuHeight;

    return {
      top: openUp ? bottomY - estimatedMenuHeight - GAP : bottomY + GAP,
      left: rightX - 160,
    };
  }

  const { top, left } = computePosition();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  }

  return (
    <div
      ref={menuRef}
      className={`fixed z-[999999] w-40 rounded-md border border-gray-200 bg-white text-[#2D3B45] shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all ${
        closing ? "animate-fadeOutUp" : "animate-fadeInUp"
      }`}
      style={{
        top,
        left,
        backgroundColor: "#FFFFFF",
        isolation: "isolate",
      }}
    >
      {items.map((it, i) => {
        if (it.type === "separator") {
          return (
            <div
              key={`sep-${i}`}
              className="my-1 mx-2 border-t border-gray-200"
              aria-hidden="true"
            />
          );
        }

        const disabled = !!it.disabled;
        const base =
          it.variant === "danger"
            ? "text-red-600 hover:bg-red-50"
            : "text-gray-700 hover:bg-gray-100";
        const disabledCls = disabled
          ? "opacity-50 cursor-not-allowed hover:bg-white"
          : "cursor-pointer";

        return (
          <button
            key={`item-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              handleClose();
              setTimeout(it.onClick, 150);
            }}
            className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm bg-white ${base} ${disabledCls} transition-colors`}
          >
            {/* fixed-width icon slot for alignment */}
            <span className="inline-flex w-4 h-4 items-center justify-center text-current">
              {it.icon ?? null}
            </span>
            <span className="min-w-0 truncate">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default CanvasDropdown;
