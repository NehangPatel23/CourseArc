import { useEffect, useState } from "react";
import Icon from "../icons/Icon";

interface CanvasModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "preview"; // adaptive sizing
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  /** Stack above another modal (Find appointment → slot details). */
  layer?: "base" | "raised";
}

export default function CanvasModal({
  title,
  children,
  onClose,
  size = "sm",
  footer,
  headerActions,
  layer = "base",
}: CanvasModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after short delay
    const timer = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const sizeClasses = {
    sm: "w-[420px] max-w-full",
    md: "w-[520px] max-w-full",
    lg: "w-[640px] max-w-full",
    xl: "w-[780px] max-w-full",
    preview: "w-[960px] max-w-full",
  }[size];

  const isPreview = size === "preview";

  return (
    <div
      className={`fixed inset-0 ${layer === "raised" ? "z-[1100]" : "z-[999]"} flex items-center justify-center p-6 sm:p-10 lg:p-14 transition-colors duration-200 ${
        visible ? "bg-arc-moss/45" : "bg-transparent"
      }`}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest?.(".tox, .tox-tinymce-aux, .tox-dialog, .tox-menu, .tox-silver-sink")) {
          return;
        }
        handleClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-modal-title"
        className={`paper-grain relative flex min-h-0 max-h-[calc(100dvh-3rem)] flex-col overflow-hidden bg-arc-paper shadow-lift ring-1 ring-arc-ink/10 sm:max-h-[calc(100dvh-5rem)] lg:max-h-[calc(100dvh-7rem)] ${sizeClasses} transform transition-all duration-200 ease-out ${
          visible
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-1"
        }`}
      >
        {/* Header */}
        <div
          className={`flex shrink-0 items-center justify-between ${
            isPreview
              ? "border-b border-arc-ink/10 px-5 py-4"
              : "border-b border-arc-ink/10 px-6 pt-5 pb-3"
          }`}
        >
          <h2
            id="canvas-modal-title"
            className="min-w-0 truncate pr-3 font-display text-lg font-medium text-arc-ink"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-0.5">
            {headerActions}
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 rounded-md p-1.5 text-arc-mute transition-colors hover:bg-arc-ivory hover:text-arc-ink"
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className={
            isPreview
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 overflow-y-auto overscroll-contain px-6 py-4"
          }
        >
          {children}
        </div>

        {footer != null && (
          <div className="shrink-0 border-t border-arc-ink/10 bg-arc-paper px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
