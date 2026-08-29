import type { LucideIcon } from "lucide-react";
import { Home } from "lucide-react";
import type { AlertTone } from "../../utils/alertTypes";
import type { HeroStatAction } from "../../utils/courseAlerts";

export type StatItem = {
  icon: LucideIcon;
  value: string | number;
  label: string;
  iconClass: string;
  tone?: AlertTone;
  action?: HeroStatAction;
};

function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function toneSurface(tone?: AlertTone) {
  if (tone === "positive") {
    return {
      card: "border-emerald-200/90 bg-emerald-50/90 hover:border-emerald-300",
      icon: "text-emerald-600",
      value: "text-emerald-950",
      label: "text-emerald-800/70",
    };
  }
  if (tone === "negative") {
    return {
      card: "border-red-200/90 bg-red-50/90 hover:border-red-300",
      icon: "text-red-600",
      value: "text-red-950",
      label: "text-red-800/70",
    };
  }
  return {
    card: "border-canvas-border/80 bg-white hover:border-canvas-blue/30",
    icon: "text-canvas-blue",
    value: "text-canvas-grayDark",
    label: "text-gray-500",
  };
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
  action,
  onAction,
}: StatItem & { onAction?: (action: HeroStatAction) => void }) {
  const t = toneSurface(tone);
  const className = `flex min-w-[140px] flex-1 flex-col rounded-2xl border px-5 py-4 text-left shadow-sm transition-all sm:max-w-[220px] ${t.card} ${
    action ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
  }`;

  const inner = (
    <>
      <Icon className={`mb-2.5 h-5 w-5 ${t.icon}`} />
      <span className={`text-2xl font-semibold tabular-nums tracking-tight ${t.value}`}>
        {value}
      </span>
      <span className={`mt-0.5 text-xs leading-snug ${t.label}`}>{label}</span>
    </>
  );

  if (action && onAction) {
    return (
      <button type="button" className={className} onClick={() => onAction(action)}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

type Props = {
  greeting: string;
  firstName: string;
  studentView: boolean;
  stats: StatItem[];
  roleKey: string;
  onStatAction?: (action: HeroStatAction) => void;
};

export default function DashboardHero({
  greeting,
  firstName,
  studentView,
  stats,
  roleKey,
  onStatAction,
}: Props) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-canvas-blueTint/70 via-canvas-blueTint/25 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-canvas-blue/10 blur-3xl"
        aria-hidden
      />

      <div className="relative w-full px-8 pb-2 pt-10 lg:px-12 lg:pt-12">
        <div className="mb-8 flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue shadow-sm ring-2 ring-white"
            aria-hidden
          >
            <Home className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-canvas-blue">
              Dashboard
            </h1>
            <p className="mt-1 text-xl font-semibold text-canvas-grayDark">
              {greeting}, {firstName}
            </p>
            <p className="mt-1 text-sm text-gray-500">{formatToday()}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">
              {studentView
                ? "Jump into your enrolled courses and keep up with assignments."
                : "Manage your courses, publish content, and track student progress."}
            </p>
          </div>
        </div>

        <div key={roleKey} className="flex flex-wrap gap-3">
          {stats.map((stat) => (
            <StatCard key={`${roleKey}-${stat.label}`} {...stat} onAction={onStatAction} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
