import { Link } from "react-router-dom";
import EmptyGradeDoodle from "./EmptyGradeDoodle";

function ListDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="148" rx="56" ry="8" fill="#E8ECF0" />
      <rect x="40" y="28" width="120" height="100" rx="12" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="56" y="48" width="64" height="8" rx="4" fill="#E2E8F0" />
      <rect x="56" y="66" width="88" height="6" rx="3" fill="#E2E8F0" />
      <rect x="56" y="82" width="72" height="6" rx="3" fill="#E2E8F0" />
      <rect x="56" y="98" width="80" height="6" rx="3" fill="#E2E8F0" />
      <circle cx="148" cy="44" r="10" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" />
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
      <ellipse cx="100" cy="148" rx="56" ry="8" fill="#E8ECF0" />
      <rect x="48" y="36" width="104" height="92" rx="10" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="48" y="36" width="104" height="24" rx="10" fill="#EEF2FF" />
      <rect x="48" y="48" width="104" height="12" fill="#EEF2FF" />
      <circle cx="72" cy="48" r="4" fill="#93C5FD" />
      <circle cx="128" cy="48" r="4" fill="#93C5FD" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={62 + col * 20}
            y={72 + row * 16}
            width="10"
            height="10"
            rx="2"
            fill={row === 1 && col === 2 ? "#BFDBFE" : "#E2E8F0"}
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
      <ellipse cx="100" cy="148" rx="56" ry="8" fill="#E8ECF0" />
      <path
        d="M40 55 L100 95 L160 55 L160 120 Q160 128 152 128 L48 128 Q40 128 40 120 Z"
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="2"
      />
      <path d="M40 55 L100 95 L160 55" stroke="#93C5FD" strokeWidth="2" strokeLinejoin="round" />
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
}: {
  variant?: keyof typeof DOODLES;
  title: string;
  subtitle?: string;
  ctaTo?: string;
  ctaLabel?: string;
  compact?: boolean;
}) {
  const Doodle = DOODLES[variant];

  return (
    <div
      className={`mx-auto flex flex-col items-center justify-center text-center ${
        compact
          ? "px-4 py-8"
          : "max-w-lg rounded-xl border border-gray-200 bg-white px-6 py-12 shadow-sm"
      }`}
    >
      <Doodle className={compact ? "h-28 w-28" : "h-40 w-40"} />
      <h2
        className={`font-semibold text-canvas-grayDark ${
          compact ? "mt-3 text-base" : "mt-5 text-lg"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 max-w-sm text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>
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
