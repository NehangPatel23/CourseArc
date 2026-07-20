export const KEYBOARD_SHORTCUTS = [
  { keys: "/", description: "Focus course search" },
  { keys: "⌘K / Ctrl+K", description: "Open global search" },
  { keys: "?", description: "Open keyboard shortcuts" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function KeyboardShortcutsSheet({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold text-canvas-grayDark">
          Keyboard shortcuts
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          {KEYBOARD_SHORTCUTS.map((row) => (
            <li key={row.keys}>
              <kbd className="rounded bg-gray-100 px-1.5">{row.keys}</kbd> {row.description}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function KeyboardShortcutsList({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-2 text-sm text-gray-600 ${className}`}>
      {KEYBOARD_SHORTCUTS.map((row) => (
        <li key={row.keys} className="flex items-start gap-3">
          <kbd className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
            {row.keys}
          </kbd>
          <span>{row.description}</span>
        </li>
      ))}
    </ul>
  );
}
