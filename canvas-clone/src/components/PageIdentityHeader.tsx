import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  /** Blue page name shown as the main heading. */
  label: string;
  /**
   * Optional secondary title under the label (e.g. person name on ArcFolio).
   * Omitted from display when it matches `label` (case-insensitive).
   */
  title?: ReactNode;
  description?: ReactNode;
  /** Replaces the default circular icon badge (e.g. UserAvatar). */
  leading?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Visual scale — global pages use lg; course tool pages use md. */
  size?: "lg" | "md" | "sm";
  titleAs?: "h1" | "h2";
};

const SIZE = {
  lg: {
    gap: "gap-4",
    circle: "h-14 w-14",
    circleIcon: "h-6 w-6",
    title: "text-3xl font-semibold tracking-tight",
    secondary: "mt-1 text-xl font-semibold text-canvas-grayDark",
    description: "mt-2 text-sm text-gray-600",
  },
  md: {
    gap: "gap-3.5",
    circle: "h-12 w-12",
    circleIcon: "h-5 w-5",
    title: "text-2xl font-semibold tracking-tight",
    secondary: "mt-1 text-lg font-semibold text-canvas-grayDark",
    description: "mt-1 text-sm text-gray-600",
  },
  sm: {
    gap: "gap-3",
    circle: "h-10 w-10",
    circleIcon: "h-[18px] w-[18px]",
    title: "text-lg font-semibold tracking-tight",
    secondary: "mt-0.5 text-base font-semibold text-canvas-grayDark",
    description: "mt-0.5 text-xs text-gray-500",
  },
} as const;

function titleMatchesLabel(title: ReactNode, label: string): boolean {
  return typeof title === "string" && title.trim().toLowerCase() === label.trim().toLowerCase();
}

/**
 * Shared page identity header: circular icon + large blue sentence-case label.
 */
export default function PageIdentityHeader({
  icon: Icon,
  label,
  title,
  description,
  leading,
  badge,
  actions,
  className = "",
  size = "lg",
  titleAs = "h1",
}: Props) {
  const s = SIZE[size];
  const TitleTag = titleAs;
  const showSecondary =
    title != null && title !== "" && !titleMatchesLabel(title, label);

  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className={`flex min-w-0 flex-1 items-start ${s.gap}`}>
        {leading ?? (
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue ring-2 ring-white shadow-sm ${s.circle}`}
            aria-hidden
          >
            <Icon className={s.circleIcon} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TitleTag className={`${s.title} text-canvas-blue`}>{label}</TitleTag>
            {badge}
          </div>
          {showSecondary && <p className={s.secondary}>{title}</p>}
          {description != null && description !== "" && (
            <div className={s.description}>{description}</div>
          )}
        </div>
      </div>
      {actions != null && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
