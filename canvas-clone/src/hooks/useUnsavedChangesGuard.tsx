import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmActionModal from "../components/ConfirmActionModal";

const DEFAULT_TITLE = "Unsaved changes";
const DEFAULT_MESSAGE =
  "You have unsaved accommodation changes. Leave without saving?";

type Options = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

/**
 * Warn on tab close/refresh (browser dialog) and intercept in-app link clicks
 * with ConfirmActionModal while `when` is true.
 *
 * Render the returned `leaveGuardModal` in the page.
 */
export function useUnsavedChangesGuard(
  when: boolean,
  options: Options = {},
): { leaveGuardModal: ReactNode } {
  const navigate = useNavigate();
  const title = options.title ?? DEFAULT_TITLE;
  const message = options.message ?? DEFAULT_MESSAGE;
  const confirmText = options.confirmText ?? "Leave without saving";
  const cancelText = options.cancelText ?? "Stay";
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when, message]);

  useEffect(() => {
    if (!when) {
      setPendingHref(null);
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;
      if (
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search &&
        nextUrl.hash === window.location.hash
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(nextUrl.pathname + nextUrl.search + nextUrl.hash);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [when]);

  const leaveGuardModal = (
    <ConfirmActionModal
      isOpen={pendingHref != null}
      title={title}
      description={message}
      confirmText={confirmText}
      cancelText={cancelText}
      tone="danger"
      onClose={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) navigate(href);
      }}
    />
  );

  return { leaveGuardModal };
}
