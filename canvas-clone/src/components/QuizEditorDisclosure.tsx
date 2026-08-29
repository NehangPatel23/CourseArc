import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-canvas-grayDark hover:bg-gray-50/80"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span>{title}</span>
          {badge ? (
            <span className="rounded-full bg-canvas-blueTint px-2 py-0.5 text-[11px] font-medium text-canvas-blueDark">
              {badge}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-gray-100 px-5 py-5">{children}</div>
      ) : null}
    </div>
  );
}
