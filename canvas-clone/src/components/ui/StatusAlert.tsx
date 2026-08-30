import type { ReactNode } from "react";

import type { AlertTone } from "../../utils/alertTypes";

const toneText: Record<AlertTone, string> = {
  positive: "text-arc-sage",
  negative: "text-arc-brick",
  neutral: "text-arc-mute",
};

const toneRule: Record<AlertTone, string> = {
  positive: "border-arc-sage/50",
  negative: "border-arc-brick/50",
  neutral: "border-arc-ink/15",
};

type Props = {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
  title?: string;
};

export default function StatusAlert({
  tone,
  children,
  className = "",
  size = "sm",
  title,
}: Props) {
  const sizeClass =
    size === "sm" ? "text-[10px] tracking-[0.14em]" : "text-xs tracking-[0.12em]";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 font-medium uppercase ${toneText[tone]} ${sizeClass} ${className}`}
    >
      <span className="h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function StatusAlertBanner({
  tone,
  children,
  className = "",
}: {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-l py-1.5 pl-3 ${toneRule[tone]} ${toneText[tone]} ${className}`}
      role="status"
    >
      {children}
    </div>
  );
}

export function statToneBorder(tone?: AlertTone) {
  if (tone === "positive") return "border-arc-sage/40 bg-arc-sage/5";
  if (tone === "negative") return "border-arc-brick/40 bg-arc-brick/5";
  return "border-arc-ink/10 bg-arc-ivory/40";
}

export function statToneIcon(tone?: AlertTone) {
  if (tone === "positive") return "text-arc-sage";
  if (tone === "negative") return "text-arc-brick";
  return "";
}
