import CanvasModal from "./CanvasModal";

type Props = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteItemModal({
  isOpen,
  title,
  description,
  confirmText = "Delete",
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen) return null;

  return (
    <CanvasModal title={title} onClose={onClose} size="md">
      <div className="space-y-4">
        {description && <p className="text-sm text-arc-mute">{description}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="btn-canvas-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-md bg-arc-brick px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
