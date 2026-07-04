import { useState, type ReactNode } from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
};

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/**
 * Lightweight hover/focus tooltip. Wrap any trigger element; the label is shown
 * on hover or keyboard focus. Use for icon-only controls throughout the app.
 */
export default function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  if (!label) return <>{children}</>;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-[60] whitespace-nowrap rounded bg-canvas-grayDark px-2 py-1 text-xs font-medium text-white shadow-md ${SIDE_CLASSES[side]}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
