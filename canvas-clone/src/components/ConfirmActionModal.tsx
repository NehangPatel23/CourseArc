import type { ReactNode } from "react";
import CanvasModal from "./CanvasModal";

type Tone = "danger" | "primary" | "neutral";

type Props = {
  isOpen: boolean;
  title: string;
  description?: string;
  /** Optional rich body (lists, links). Rendered under description. */
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const confirmClass: Record<Tone, string> = {
  danger:
    "px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-all",
  primary:
    "px-4 py-2 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-blue-700 transition-all",
  neutral:
    "px-4 py-2 text-sm font-medium rounded-md bg-canvas-grayDark text-white hover:bg-gray-800 transition-all",
};

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "primary",
  confirmDisabled = false,
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen) return null;

  return (
    <CanvasModal
      title={title}
      onClose={onClose}
      size="md"
      layer="raised"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-canvas-grayDark bg-arc-paper hover:bg-gray-100 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDisabled) return;
              onConfirm();
              onClose();
            }}
            disabled={confirmDisabled}
            className={`${confirmClass[tone]} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      {(description || children) && (
        <div className="space-y-4">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {children}
        </div>
      )}
    </CanvasModal>
  );
}
