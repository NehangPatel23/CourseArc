import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "../icons/Icon";

type Props = {
  exitTo: string;
  title: string;
  subtitle?: string;
  stats?: ReactNode;
  toolbar?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

function isBlockingModalOpen(): boolean {
  return Boolean(document.querySelector('[class*="z-[999]"], [data-gradepro-overlay]'));
}

/** Never close back onto a GradePro route. */
export function gradeProExitPath(path: string): string {
  const raw = path.trim() || "/";
  try {
    const url = new URL(raw, window.location.origin);
    const pathname = url.pathname.replace(/\/grade\/?$/, "") || "/";
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return raw.replace(/\/grade\/?$/, "") || "/";
  }
}

function leaveGradePro(path: string) {
  window.location.replace(gradeProExitPath(path));
}

/** Shared GradePro overlay: moss chrome, paper stage, Streamline close. */
export default function GradeProShell({
  exitTo,
  title,
  subtitle,
  stats,
  toolbar,
  trailing,
  children,
}: Props) {
  const dest = gradeProExitPath(exitTo);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.querySelectorAll("[data-gradepro-shell]").forEach((node) => {
      if (node !== rootRef.current) node.remove();
    });
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest?.("[data-gradepro-close]")) return;
      e.preventDefault();
      e.stopPropagation();
      leaveGradePro(dest);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isBlockingModalOpen()) return;
      e.preventDefault();
      leaveGradePro(dest);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [dest]);

  const shell = (
    <div
      ref={rootRef}
      data-gradepro-shell
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-arc-moss"
    >
      <header className="relative z-20 shrink-0 border-b border-white/10 text-arc-cream">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <a
              href={dest}
              data-gradepro-close
              className="relative z-20 shrink-0 rounded p-1.5 text-arc-cream/80 hover:bg-white/10 hover:text-arc-cream"
              title="Close GradePro"
              aria-label="Close GradePro"
            >
              <Icon name="close" size={20} className="pointer-events-none" />
            </a>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-medium">{title}</p>
              {subtitle ? (
                <p className="truncate text-xs text-arc-cream/60">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {trailing ? (
            <div className="flex shrink-0 items-center gap-2">{trailing}</div>
          ) : null}
        </div>

        {stats || toolbar ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-2 text-xs text-arc-cream/80">
            {stats ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{stats}</div>
            ) : null}
            {toolbar}
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-arc-paper text-arc-ink">
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return shell;
  return createPortal(shell, document.body);
}

export const gradeProNavBtnClass =
  "rounded p-1.5 text-arc-cream/80 hover:bg-white/10 hover:text-arc-cream disabled:opacity-40";

export const gradeProChipClass =
  "flex items-center gap-2 rounded bg-white/10 px-3 py-1.5";

export const gradeProSegClass = "flex items-center gap-1 rounded bg-white/10 p-0.5";

export function gradeProSegBtnClass(active: boolean): string {
  return `rounded px-2 py-1 text-[11px] font-medium transition ${
    active ? "bg-arc-copper text-white" : "text-arc-cream/80 hover:bg-white/10"
  }`;
}
