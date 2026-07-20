import type { ReactNode } from "react";

import type { AlertTone } from "../../utils/alertTypes";

const toneClasses: Record<AlertTone, string> = {
  positive: "bg-emerald-50 text-emerald-800 ring-emerald-200   ",
  negative: "bg-red-50 text-red-800 ring-red-200   ",
  neutral: "bg-gray-50 text-gray-700 ring-gray-200   ",
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
  className ="",
  size = "sm",
  title,
}: Props) {
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] font-semibold"
      : "px-3 py-2 text-sm font-medium";

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full ring-1 ${toneClasses[tone]} ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusAlertBanner({
  tone,
  children,
  className ="",
}: {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ring-1 ${toneClasses[tone]} ${className}`}
      role="status"
    >
      {children}
    </div>
  );
}

export function statToneBorder(tone?: AlertTone) {
  if (tone === "positive") return "border-emerald-400/40 bg-emerald-500/10";
  if (tone === "negative") return "border-red-400/40 bg-red-500/10";
  return "border-white/10 bg-white/5";
}

export function statToneIcon(tone?: AlertTone) {
  if (tone === "positive") return "text-emerald-400";
  if (tone === "negative") return "text-red-400";
  return "";
}
