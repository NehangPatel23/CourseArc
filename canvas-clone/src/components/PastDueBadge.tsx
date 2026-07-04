type PastDueBadgeProps = {
  className?: string;
};

export default function PastDueBadge({ className = "" }: PastDueBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 ${className}`}
    >
      Past due
    </span>
  );
}
