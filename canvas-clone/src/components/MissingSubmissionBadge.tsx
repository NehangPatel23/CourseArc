type MissingSubmissionBadgeProps = {
  className?: string;
  variant?: "default" | "dark";
};

export default function MissingSubmissionBadge({
  className = "",
  variant = "default",
}: MissingSubmissionBadgeProps) {
  const styles =
    variant === "dark"
      ? "border-amber-300/40 bg-amber-400/20 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${styles} ${className}`}
    >
      Missing
    </span>
  );
}
