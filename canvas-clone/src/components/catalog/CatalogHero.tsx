import Icon from "../../icons/Icon";
import type { StatItem } from "../dashboard/DashboardHero";
import type { HeroStatAction } from "../../utils/courseAlerts";
import PageHelpLink from "../PageHelpLink";

function toneValue(tone?: StatItem["tone"]) {
  if (tone === "positive") return "text-arc-sage";
  if (tone === "negative") return "text-arc-brick";
  return "text-arc-ink";
}

type Props = {
  studentView: boolean;
  stats: StatItem[];
  onStatAction?: (action: HeroStatAction) => void;
  canCompose?: boolean;
};

export default function CatalogHero({ studentView, stats, onStatAction, canCompose = false }: Props) {
  const roleKey = studentView ? "student" : "instructor";

  return (
    <section className="relative">
      <div className="relative w-full px-8 pt-10 lg:px-14 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-arc-ink/15 pb-4">
          <p className="kicker text-arc-ink/55">Index</p>
          <div className="flex items-center gap-5">
            <p className="kicker text-arc-copper">
              {studentView ? "Enrolled plates" : "Full catalog"}
            </p>
            <PageHelpLink />
          </div>
        </div>

        <div className="mt-9 max-w-3xl">
          <p className="font-display text-lg italic text-arc-mute">Every studio,</p>
          <h1 className="font-display mt-1 text-[2.75rem] font-medium leading-[0.98] tracking-tight text-arc-ink sm:text-5xl lg:text-[3.6rem]">
            The catalog.
          </h1>
          <span className="mt-5 block h-px w-14 bg-arc-copper/70" aria-hidden />
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-arc-ink/70">
            {studentView
              ? "Pinned plates first, then every enrolled course by term. Bookmark a studio or give it a nickname from the menu."
              : "Published first, then drafts. Pin a course, set a nickname, or compose a new plate for the term."}
          </p>
          {!studentView && canCompose && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("canvasClone:composeCourse"))}
              className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-arc-copper transition-colors hover:text-arc-copper-dark"
            >
              <Icon name="plus" size={12} />
              Compose a course
            </button>
          )}
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
