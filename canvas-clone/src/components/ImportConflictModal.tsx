import CanvasModal from "./CanvasModal";
import type { ImportConflictMode } from "../utils/quizImportFormats";

type Props = {
  open: boolean;
  /** Title that already exists in this course. */
  conflictTitle: string;
  /** What is being imported, e.g. "quiz" or "question bank". */
  kind: string;
  /** Explains what Replace does for this kind. */
  replaceHint: string;
  onResolve: (mode: ImportConflictMode) => void;
  onClose: () => void;
};

export default function ImportConflictModal({
  open,
  conflictTitle,
  kind,
  replaceHint,
  onResolve,
  onClose,
}: Props) {
  if (!open) return null;

  const choose = (mode: ImportConflictMode) => {
    onResolve(mode);
    onClose();
  };

  return (
    <CanvasModal title={`A ${kind} named “${conflictTitle}” already exists`} onClose={onClose} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose how to handle the imported {kind}.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="rounded-lg border border-gray-200 p-3">
            <span className="font-medium text-canvas-grayDark">Rename</span>
            <p className="mt-0.5 text-xs text-gray-500">
              Import as “{conflictTitle} (imported)” and keep the existing {kind}.
            </p>
          </li>
          <li className="rounded-lg border border-gray-200 p-3">
            <span className="font-medium text-canvas-grayDark">Replace</span>
            <p className="mt-0.5 text-xs text-gray-500">{replaceHint}</p>
          </li>
          <li className="rounded-lg border border-gray-200 p-3">
            <span className="font-medium text-canvas-grayDark">Skip</span>
            <p className="mt-0.5 text-xs text-gray-500">
              Cancel the import and leave everything as it is.
            </p>
          </li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={() => choose("skip")} className="btn-canvas-secondary text-sm">
            Skip
          </button>
          <button type="button" onClick={() => choose("replace")} className="btn-canvas-secondary text-sm">
            Replace
          </button>
          <button type="button" onClick={() => choose("rename")} className="btn-canvas-primary text-sm">
            Rename
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
