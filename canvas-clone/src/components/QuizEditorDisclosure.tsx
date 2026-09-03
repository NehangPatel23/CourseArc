import { useEffect, useState, type ReactNode } from "react";
import Icon from "../icons/Icon";

type Props = {
  title: string;
  children: ReactNode;
  /** Open on first mount when true. */
  defaultOpen?: boolean;
  /** Keep open while true (e.g. non-default advanced settings). */
  forceOpen?: boolean;
  /** Small badge next to the title (e.g. “3 active”). */
  badge?: string;
  className?: string;
};

/** Collapsible section for quiz / question editor Advanced panels. */
export default function QuizEditorDisclosure({
  title,
  children,
  defaultOpen = false,
  forceOpen = false,
  badge,
  className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className={`bg-arc-ivory ring-1 ring-arc-ink/10 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-arc-ink hover:bg-arc-paper/80"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span>{title}</span>
          {badge ? (
            <span className="rounded-full bg-arc-copper/10 px-2 py-0.5 text-[11px] font-medium text-arc-copper">
              {badge}
            </span>
          ) : null}
        </span>
        <Icon name="chevronDown" size={16} className={`shrink-0 text-arc-mute transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-arc-ink/10 px-5 py-5">{children}</div>
      ) : null}
    </div>
  );
}
