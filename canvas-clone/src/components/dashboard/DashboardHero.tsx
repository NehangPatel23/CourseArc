import type { LucideIcon } from "lucide-react";
import type { AlertTone } from "../../utils/alertTypes";
import type { HeroStatAction } from "../../utils/courseAlerts";
import { statToneBorder, statToneIcon } from "../ui/StatusAlert";

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

function StatCard({
  icon: Icon,
  value,
  label,
  iconClass,
  tone,
  action,
  onAction,
}: StatItem & { onAction?: (action: HeroStatAction) => void }) {
  const className = `flex min-w-[148px] flex-1 flex-col rounded-2xl border px-5 py-4 text-left backdrop-blur-sm transition-all sm:max-w-[200px] ${statToneBorder(tone)} ${
    action ? "cursor-pointer hover:scale-[1.02] hover:border-white/20 hover:bg-white/10" : ""
  }`;

  const inner = (
    <>
      <Icon className={`mb-2.5 h-5 w-5 ${tone ? statToneIcon(tone) : iconClass}`} />
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-white">{value}</span>
      <span className="mt-0.5 text-xs leading-snug text-gray-400">{label}</span>
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
    <section className="relative overflow-hidden bg-canvas-grayDark pb-16">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-canvas-blue/20 via-transparent to-canvas-blueLight/5"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-canvas-blue/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-canvas-blueLight/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-canvas-grayLight dark:to-canvas-surface"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-8 pt-12 lg:px-12 lg:pt-14">
        <div className="flex flex-col gap-10">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-canvas-blueLight">{formatToday()}</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight text-white lg:text-[2.75rem] lg:leading-tight">
              {greeting},{" "}
              <span className="font-semibold">{firstName}</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-400">
              {studentView
                ? "Jump into your enrolled courses and keep up with assignments."
                : "Manage your courses, publish content, and track student progress."}
            </p>
          </div>

          <div key={roleKey} className="-mb-6 flex flex-wrap gap-3">
            {stats.map((stat) => (
              <StatCard key={`${roleKey}-${stat.label}`} {...stat} onAction={onStatAction} />
            ))}
          </div>
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
