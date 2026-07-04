import { useEffect } from "react";

type ShortcutHandler = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
};

export function useKeyboardShortcuts(handlers: ShortcutHandler[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
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
