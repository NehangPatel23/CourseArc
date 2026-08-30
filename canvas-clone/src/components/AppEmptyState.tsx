import { Link } from "react-router-dom";
import EmptyGradeDoodle from "./EmptyGradeDoodle";

const PAPER = "rgb(var(--arc-ivory))";
const LINE = "rgb(var(--arc-line))";
const MUTE = "rgb(var(--arc-mute))";
const COPPER = "rgb(var(--arc-copper))";
const TINT = "rgb(var(--arc-copper-tint))";

function ListDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="148" rx="56" ry="8" fill={LINE} opacity="0.5" />
      <rect x="40" y="28" width="120" height="100" rx="6" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="56" y="48" width="64" height="8" rx="2" fill={MUTE} opacity="0.35" />
      <rect x="56" y="66" width="88" height="6" rx="2" fill={MUTE} opacity="0.25" />
      <rect x="56" y="82" width="72" height="6" rx="2" fill={MUTE} opacity="0.25" />
      <rect x="56" y="98" width="80" height="6" rx="2" fill={MUTE} opacity="0.25" />
      <circle cx="148" cy="44" r="10" fill={TINT} stroke={COPPER} strokeWidth="2" />
    </svg>
  );
}

function CalendarDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="148" rx="56" ry="8" fill={LINE} opacity="0.5" />
      <rect x="48" y="36" width="104" height="92" rx="6" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="48" y="36" width="104" height="24" rx="6" fill={TINT} />
      <rect x="48" y="48" width="104" height="12" fill={TINT} />
      <circle cx="72" cy="48" r="4" fill={COPPER} />
      <circle cx="128" cy="48" r="4" fill={COPPER} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={62 + col * 20}
            y={72 + row * 16}
            width="10"
            height="10"
            rx="1"
            fill={row === 1 && col === 2 ? COPPER : LINE}
            opacity={row === 1 && col === 2 ? 1 : 0.55}
          />
        )),
      )}
    </svg>
  );
}

function InboxDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="148" rx="56" ry="8" fill={LINE} opacity="0.5" />
      <path
        d="M40 55 L100 95 L160 55 L160 120 Q160 128 152 128 L48 128 Q40 128 40 120 Z"
        fill={PAPER}
        stroke={LINE}
        strokeWidth="2"
      />
      <path d="M40 55 L100 95 L160 55" stroke={COPPER} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const DOODLES = {
  grades: EmptyGradeDoodle,
  inbox: InboxDoodle,
  calendar: CalendarDoodle,
  list: ListDoodle,
  generic: ListDoodle,
} as const;

export default function AppEmptyState({
  variant = "generic",
  title,
  subtitle,
  ctaTo,
  ctaLabel,
  compact = false,
  studio,
}: {
  variant?: keyof typeof DOODLES;
  title?: string;
  subtitle?: string;
  ctaTo?: string;
  ctaLabel?: string;
  compact?: boolean;
  studio?: "student" | "instructor";
}) {
  const Doodle = DOODLES[variant];
  const kicker =
    studio === "instructor" ? "Compose this plate" : studio === "student" ? "Nothing on the desk" : null;
  const headline = title ?? kicker ?? "Nothing here yet";

  return (
    <div
      className={`mx-auto flex flex-col items-center justify-center text-center ${
        compact
          ? "px-4 py-8"
          : "max-w-lg bg-arc-ivory/80 px-6 py-12 ring-1 ring-arc-ink/10"
      }`}
    >
      <Doodle className={compact ? "h-28 w-28" : "h-40 w-40"} />
      {kicker && title && <p className="kicker mt-5 text-arc-copper">{kicker}</p>}
      <h2
        className={`font-display font-medium text-arc-ink ${
          compact ? "mt-3 text-base" : kicker && title ? "mt-2 text-2xl" : "mt-5 text-2xl"
        }`}
      >
        {headline}
      </h2>
      {subtitle && (
        <p className={`mt-2 max-w-sm text-arc-ink/65 ${compact ? "text-xs" : "text-sm"}`}>
          {subtitle}
        </p>
      )}
      {ctaTo && ctaLabel && (
        <Link to={ctaTo} className="btn-canvas-primary mt-5 text-sm">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
