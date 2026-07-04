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
        {description && <p className="text-sm text-gray-600">{description}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-canvas-grayDark bg-white hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
