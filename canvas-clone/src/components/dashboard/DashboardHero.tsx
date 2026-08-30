import Icon, { type IconName } from "../../icons/Icon";
import type { AlertTone } from "../../utils/alertTypes";
import type { HeroStatAction } from "../../utils/courseAlerts";

export type StatItem = {
  icon: IconName;
  value: string | number;
  label: string;
  iconClass?: string;
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

function toneValue(tone?: AlertTone) {
  if (tone === "positive") return "text-arc-sage";
  if (tone === "negative") return "text-arc-brick";
  return "text-arc-ink";
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
  const hour = new Date().getHours();
  const timeWord =
    hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    <section className="relative">
      <div className="relative w-full px-8 pt-10 lg:px-14 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-arc-ink/15 pb-4">
          <p className="kicker text-arc-ink/55">{formatToday()}</p>
          <p className="kicker text-arc-copper">
            {studentView ? "Student studio" : "Instructor studio"}
          </p>
        </div>

        <div className="mt-9 max-w-3xl">
          <p className="font-display text-lg italic text-arc-mute">{timeWord},</p>
          <h1 className="font-display mt-1 text-[2.75rem] font-medium leading-[0.98] tracking-tight text-arc-ink sm:text-5xl lg:text-[3.6rem]">
            {firstName}.
          </h1>
          <span className="mt-5 block h-px w-14 bg-arc-copper/70" aria-hidden />
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-arc-ink/70">
            {studentView
              ? "Pick up where you left off. Courses, deadlines, and the week ahead — arranged as a catalog."
              : "Publish, grade, and keep the term moving. Your courses are plated below."}
          </p>
          <span className="sr-only">
            {greeting}, {firstName}
          </span>
        </div>

        <div
          key={roleKey}
          className="mt-10 flex flex-wrap gap-0 border-y border-arc-ink/10"
        >
          {stats.map((stat, i) => {
            const clickable = Boolean(stat.action && onStatAction);
            const className = `flex min-w-[140px] flex-1 flex-col gap-1.5 px-0 py-6 text-left sm:px-6 ${
              i > 0 ? "sm:border-l sm:border-arc-ink/10" : ""
            } ${clickable ? "cursor-pointer transition-colors hover:bg-arc-ivory/70" : ""}`;

            const inner = (
              <>
                <span className="flex items-center gap-2 text-arc-mute">
                  <Icon name={stat.icon} size={13} className="opacity-70" />
                  <span className="kicker">{stat.label}</span>
                </span>
                <span
                  className={`font-display text-[2rem] font-medium tabular-nums tracking-tight ${toneValue(stat.tone)}`}
                >
                  {stat.value}
                </span>
              </>
            );

            if (clickable && stat.action && onStatAction) {
              return (
                <button
                  key={`${roleKey}-${stat.label}`}
                  type="button"
                  className={className}
                  onClick={() => onStatAction(stat.action!)}
                >
                  {inner}
                </button>
              );
            }

            return (
              <div key={`${roleKey}-${stat.label}`} className={className}>
                {inner}
              </div>
            );
          })}
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
