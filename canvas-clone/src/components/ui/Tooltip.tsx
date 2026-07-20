import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
  /** Extra gap (px) between trigger and tooltip. */
  gap?: number;
};

const GAP_DEFAULT = 8;

/**
 * Lightweight hover/focus tooltip. Renders in a portal with fixed positioning so
 * it is not clipped or offset by overflow/transform ancestors.
 */
export default function Tooltip({
  label,
  children,
  side = "top",
  className = "",
  gap = GAP_DEFAULT,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;

    const rect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (side) {
      case "right":
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - gap;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        break;
      case "top":
      default:
        top = rect.top - tipRect.height - gap;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        break;
    }

    // Keep inside the viewport with a small margin.
    const margin = 6;
    top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

    setCoords({ top, left });
  }, [gap, side]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, label, side, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!label) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={
              coords
                ? { position: "fixed", top: coords.top, left: coords.left, zIndex: 10000 }
                : { position: "fixed", top: 0, left: 0, zIndex: 10000, visibility: "hidden" }
            }
            className="pointer-events-none whitespace-nowrap rounded bg-canvas-grayDark px-2 py-1 text-xs font-medium text-white shadow-md ring-1 ring-white/10"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
