import { useEffect } from "react";

type ShortcutHandler = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
};

const TYPING_SELECTOR =
  "input, textarea, select, [contenteditable='true'], .monaco-editor, .monaco-editor textarea, [role='textbox'], .ProseMirror, .ck-editor, .ck-content, .tox-edit-area";

/** True when keyboard focus is in a field that should own letter keys (not global shortcuts). */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest(TYPING_SELECTOR));
}

export function useKeyboardShortcuts(handlers: ShortcutHandler[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
        return;
      }

      for (const h of handlers) {
        const keyMatch = e.key.toLowerCase() === h.key.toLowerCase();
        if (!keyMatch) continue;

        if (h.meta && !e.metaKey) continue;
        if (h.ctrl && !e.ctrlKey) continue;
        if (h.shift && !e.shiftKey) continue;
        if (!h.meta && !h.ctrl && (e.metaKey || e.ctrlKey) && h.key.length === 1) continue;

        e.preventDefault();
        h.handler();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

export function useGlobalKeyboardShortcuts(opts: {
  onFocusSearch: () => void;
  onOpenHelp: () => void;
  onOpenGlobalSearch: () => void;
}) {
  useKeyboardShortcuts([
    { key: "/", handler: opts.onFocusSearch },
    { key: "?", shift: true, handler: opts.onOpenHelp },
    { key: "k", meta: true, handler: opts.onOpenGlobalSearch },
    { key: "k", ctrl: true, handler: opts.onOpenGlobalSearch },
  ]);
}
