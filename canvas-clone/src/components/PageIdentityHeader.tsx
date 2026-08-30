import type { ReactNode } from "react";
import Icon, { type IconName } from "../icons/Icon";

type Props = {
  icon: IconName;
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
    icon: 18,
    title: "font-display text-3xl font-medium tracking-tight text-arc-ink",
    secondary: "mt-1 font-display text-xl font-medium italic text-arc-ink/70",
    description: "mt-2 max-w-2xl text-sm leading-relaxed text-arc-ink/65",
  },
  md: {
    gap: "gap-3.5",
    icon: 16,
    title: "font-display text-2xl font-medium tracking-tight text-arc-ink",
    secondary: "mt-1 font-display text-lg font-medium italic text-arc-ink/70",
    description: "mt-1 max-w-2xl text-sm leading-relaxed text-arc-ink/65",
  },
  sm: {
    gap: "gap-3",
    icon: 14,
    title: "font-display text-lg font-medium tracking-tight text-arc-ink",
    secondary: "mt-0.5 font-display text-base font-medium italic text-arc-ink/70",
    description: "mt-0.5 max-w-2xl text-xs leading-relaxed text-arc-ink/60",
  },
} as const;

function titleMatchesLabel(title: ReactNode, label: string): boolean {
  return typeof title === "string" && title.trim().toLowerCase() === label.trim().toLowerCase();
}

/** Shared page identity: kicker + Fraunces title, matching the dashboard hero. */
export default function PageIdentityHeader({
  icon,
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
  const showSecondary = title != null && title !== "" && !titleMatchesLabel(title, label);

  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className={`flex min-w-0 flex-1 items-start ${s.gap}`}>
        {leading ?? (
          <span className="mt-1 text-arc-copper" aria-hidden>
            <Icon name={icon} size={s.icon} className="block" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="kicker text-arc-copper">{label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TitleTag className={s.title}>{showSecondary ? title : label}</TitleTag>
            {badge}
          </div>
          {description != null && description !== "" && (
            <div className={s.description}>{description}</div>
          )}
        </div>
      </div>
      {actions != null && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
